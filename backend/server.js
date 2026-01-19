import express from "express";
import cors from "cors";
import multer from "multer";
import { WebSocketServer } from "ws";
import { TDLib } from "tdl-tdlib-addon";
import { Client } from "tdl";
import fs from "node:fs";
import path from "node:path";

// Konfiguration aus Umgebungsvariablen
const API_ID = Number(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const PHONE_NUMBER_DEFAULT = process.env.PHONE_NUMBER || "";
const PORT = Number(process.env.PORT) || 1993;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

if (!API_ID || !API_HASH) {
  console.error("❌ API_ID oder API_HASH fehlt in .env!");
  process.exit(1);
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// TDLib Client initialisieren
const client = new Client(new TDLib("/app/tdlib/libtdjson.so"), {
  apiId: API_ID,
  apiHash: API_HASH,
  databaseDirectory: "/app/session_data",
  filesDirectory: "/app/session_data/files",
  useFileDatabase: true,
  useChatInfoDatabase: true,
  useMessageDatabase: true
});

await client.connect();
console.log("✅ TDLib gestartet.");

// Login State Management
let resolvePhone = null;
let resolveCode = null;
let resolvePassword = null;
let loginTimeout = null;

function clearLoginState() {
  if (loginTimeout) clearTimeout(loginTimeout);
  resolvePhone = null;
  resolveCode = null;
  resolvePassword = null;
}

// REST: Auth Status
app.get("/auth/status", async (req, res) => {
  try {
    const me = await client.invoke({ "@type": "getMe" }).catch(() => null);
    res.json({ authenticated: !!me, me });
  } catch (e) {
    res.json({ authenticated: false, error: e.message });
  }
});

// REST: Login Start
app.post("/auth/start", async (req, res) => {
  try {
    const me = await client.invoke({ "@type": "getMe" }).catch(() => null);
    if (me) return res.json({ next: "done", me });
  } catch {}

  clearLoginState();
  startLogin().catch(err => {
    console.error("❌ Login error:", err);
    clearLoginState();
  });
  
  res.json({ next: "phone" });
});

// REST: Phone
app.post("/auth/phone", (req, res) => {
  const { phone } = req.body;
  
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({ ok: false, error: "Ungültige Telefonnummer" });
  }

  if (resolvePhone) {
    resolvePhone(phone);
    resolvePhone = null;
    return res.json({ ok: true, next: "code" });
  }
  
  res.status(400).json({ ok: false, error: "Kein aktiver Login-Prozess" });
});

// REST: Code
app.post("/auth/code", (req, res) => {
  const { code } = req.body;
  
  if (!code || typeof code !== "string") {
    return res.status(400).json({ ok: false, error: "Ungültiger Code" });
  }

  if (resolveCode) {
    resolveCode(code);
    resolveCode = null;
    return res.json({ ok: true, next: "maybe_password" });
  }
  
  res.status(400).json({ ok: false, error: "Kein aktiver Login-Prozess" });
});

// REST: Password (2FA)
app.post("/auth/password", (req, res) => {
  const { password } = req.body;
  
  if (!password || typeof password !== "string") {
    return res.status(400).json({ ok: false, error: "Ungültiges Passwort" });
  }

  if (resolvePassword) {
    resolvePassword(password);
    resolvePassword = null;
    return res.json({ ok: true, next: "done" });
  }
  
  res.status(400).json({ ok: false, error: "Kein aktiver Login-Prozess" });
});

// Login Orchestrierung mit Timeout
async function startLogin() {
  try {
    await client.login(() => ({
      type: "user",
      getPhoneNumber: () =>
        new Promise((resolve, reject) => {
          resolvePhone = resolve;
          loginTimeout = setTimeout(() => {
            reject(new Error("Phone timeout"));
            clearLoginState();
          }, 300000); // 5 Minuten
          
          if (PHONE_NUMBER_DEFAULT) {
            resolve(PHONE_NUMBER_DEFAULT);
            clearLoginState();
          }
        }),
      getAuthCode: () =>
        new Promise((resolve, reject) => {
          resolveCode = resolve;
          loginTimeout = setTimeout(() => {
            reject(new Error("Code timeout"));
            clearLoginState();
          }, 300000);
        }),
      getPassword: () =>
        new Promise((resolve, reject) => {
          resolvePassword = resolve;
          loginTimeout = setTimeout(() => {
            reject(new Error("Password timeout"));
            clearLoginState();
          }, 300000);
        })
    }));

    clearLoginState();
    console.log("✅ Login abgeschlossen.");
  } catch (error) {
    console.error("❌ Login fehlgeschlagen:", error);
    clearLoginState();
    throw error;
  }
}

// HTTP Server starten
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});

// WebSocket für Updates & Befehle
const wss = new WebSocketServer({ server });
let wsRequestId = 0;

wss.on("connection", (ws) => {
  console.log("✅ WebSocket Client verbunden");
  
  ws.on("message", async (raw) => {
    let request;
    try {
      request = JSON.parse(raw.toString());
    } catch (e) {
      return ws.send(JSON.stringify({ 
        ok: false, 
        error: "Ungültiges JSON",
        requestId: null 
      }));
    }

    const requestId = request.requestId || wsRequestId++;

    try {
      const result = await client.invoke(request);
      ws.send(JSON.stringify({ ok: true, result, requestId }));
    } catch (e) {
      ws.send(JSON.stringify({ 
        ok: false, 
        error: e.message, 
        requestId 
      }));
    }
  });

  ws.on("close", () => {
    console.log("❌ WebSocket Client getrennt");
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket Fehler:", error);
  });
});

// TDLib Updates an alle Clients broadcasten
client.on("update", (update) => {
  const msg = JSON.stringify({ update });
  wss.clients.forEach((c) => {
    if (c.readyState === 1) { // OPEN
      c.send(msg);
    }
  });
});

// Dateien bereitstellen (Downloads, Thumbnails)
app.use("/files", express.static("/app/session_data/files"));

// Upload Endpoint mit Validierung
const uploadDir = "/app/uploads";
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ 
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB Limit
});

app.post("/upload", upload.single("file"), async (req, res) => {
  const { chat_id, type } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ ok: false, error: "Keine Datei hochgeladen" });
  }

  // Validierung
  const chatId = Number(chat_id);
  if (!chatId || isNaN(chatId)) {
    fs.unlinkSync(req.file.path); // Cleanup
    return res.status(400).json({ ok: false, error: "Ungültige Chat-ID" });
  }

  if (!["photo", "document"].includes(type)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ ok: false, error: "Ungültiger Typ" });
  }

  const filePath = req.file.path;
  
  try {
    let content;
    if (type === "photo") {
      content = {
        "@type": "inputMessagePhoto",
        "photo": { "@type": "inputFileLocal", "path": filePath }
      };
    } else {
      content = {
        "@type": "inputMessageDocument",
        "document": { "@type": "inputFileLocal", "path": filePath }
      };
    }
    
    const result = await client.invoke({
      "@type": "sendMessage",
      "chat_id": chatId,
      "input_message_content": content
    });
    
    // Cleanup nach erfolgreichem Upload
    setTimeout(() => {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn("Konnte temporäre Datei nicht löschen:", e);
      }
    }, 5000);
    
    res.json({ ok: true, result });
  } catch (e) {
    // Cleanup bei Fehler
    try {
      fs.unlinkSync(filePath);
    } catch {}
    
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Graceful Shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM empfangen, fahre herunter...");
  server.close(() => {
    console.log("✅ Server geschlossen");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT empfangen, fahre herunter...");
  server.close(() => {
    console.log("✅ Server geschlossen");
    process.exit(0);
  });
});
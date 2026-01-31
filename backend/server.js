import express from "express";
import cors from "cors";
import multer from "multer";
import { WebSocketServer } from "ws";
import { Client } from "tdl"; 
import fs from "node:fs";

import tdl from 'tdl';
import { getTdjson } from 'prebuilt-tdlib';


// Konfiguration aus Umgebungsvariablen
const rawApiId = process.env.API_ID ?? '';
const API_ID = parseInt(String(rawApiId).trim().replace(/^"+|"+$/g, ''), 10);

const rawApiHash = process.env.API_HASH ?? '';
const API_HASH = String(rawApiHash).trim().replace(/^"+|"+$/g, ''); 

const PHONE_NUMBER_DEFAULT = process.env.PHONE_NUMBER || "";
const PORT = Number(process.env.PORT) || 1993;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// Validierung
if (!API_ID || Number.isNaN(API_ID)) {
  console.error('❌ FATAL: API_ID fehlt oder ist keine Zahl. Bitte .env/Compose prüfen.');
  process.exit(1);
}
if (!API_HASH || API_HASH.length < 10) {
  console.error('❌ FATAL: API_HASH fehlt oder ist offensichtlich ungültig.');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

console.log(`[BOOT] API_ID=${API_ID}, API_HASH[0..5]=${API_HASH.slice(0,6)}...`);

tdl.configure({ tdjson: getTdjson() });


// TDLib Client initialisieren (7.x-/8.x-Stil)
const client = tdl.createClient({
  apiId: API_ID,            // number (du castest weiter oben korrekt)
  apiHash: API_HASH,        // string

  tdlibParameters: {
    api_id: API_ID,
    api_hash: API_HASH,
    database_directory: '/app/session_data',
    files_directory: '/app/session_data/files',
    use_file_database: true,
    use_chat_info_database: true,
    use_message_database: true,
    system_language_code: 'en',
    device_model: 'server',
    system_version: '1.0',
    application_version: '1.0',
    enable_storage_optimizer: true,
    ignore_file_names: false
  }
});


console.log("🔄 Verbinde zu TDLib...");
await client.connect();
console.log("✅ TDLib verbunden!");

// Login State Management
let resolvePhone = null;
let resolveCode = null;
let resolvePassword = null;
let loginTimeout = null;
let loginInProgress = false;

function clearLoginState() {
  if (loginTimeout) clearTimeout(loginTimeout);
  resolvePhone = null;
  resolveCode = null;
  resolvePassword = null;
  loginInProgress = false;
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

  if (loginInProgress) {
    return res.json({ next: "phone", message: "Login bereits gestartet" });
  }

  clearLoginState();
  loginInProgress = true;
  
  // Starte Login-Prozess asynchron
  startLogin().catch(err => {
    console.error("❌ Login error:", err);
    clearLoginState();
  });
  
  // Warte kurz, damit startLogin() die Promise-Handler initialisieren kann
  await new Promise(resolve => setTimeout(resolve, 200));
  
  res.json({ next: "phone" });
});

// REST: Phone
app.post("/auth/phone", (req, res) => {
  const { phone } = req.body;
  
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({ ok: false, error: "Ungültige Telefonnummer" });
  }

  if (!resolvePhone) {
    return res.status(400).json({ 
      ok: false, 
      error: "Kein aktiver Login-Prozess. Bitte /auth/start zuerst aufrufen." 
    });
  }

  console.log(`📱 Telefonnummer erhalten: ${phone}`);
  resolvePhone(phone);
  resolvePhone = null;
  
  res.json({ ok: true, next: "code" });
});

// REST: Code
app.post("/auth/code", (req, res) => {
  const { code } = req.body;
  
  if (!code || typeof code !== "string") {
    return res.status(400).json({ ok: false, error: "Ungültiger Code" });
  }

  if (!resolveCode) {
    return res.status(400).json({ 
      ok: false, 
      error: "Kein aktiver Code-Schritt" 
    });
  }

  console.log(`🔑 Code erhalten: ${code}`);
  resolveCode(code);
  resolveCode = null;
  
  res.json({ ok: true, next: "maybe_password" });
});

// REST: Password (2FA)
app.post("/auth/password", (req, res) => {
  const { password } = req.body;
  
  if (!password || typeof password !== "string") {
    return res.status(400).json({ ok: false, error: "Ungültiges Passwort" });
  }

  if (!resolvePassword) {
    return res.status(400).json({ 
      ok: false, 
      error: "Kein aktiver Password-Schritt" 
    });
  }

  console.log(`🔐 Passwort erhalten`);
  resolvePassword(password);
  resolvePassword = null;
  
  res.json({ ok: true, next: "done" });
});

// Login Orchestrierung mit Timeout
async function startLogin() {
  try {
    console.log("🚀 Starte Login-Prozess...");
    
    await client.login(() => ({
      type: "user",
      getPhoneNumber: () =>
        new Promise((resolve, reject) => {
          console.log("📞 Warte auf Telefonnummer...");
          resolvePhone = resolve;
          loginTimeout = setTimeout(() => {
            console.error("⏱️ Phone timeout");
            reject(new Error("Phone timeout"));
            clearLoginState();
          }, 300000); // 5 Minuten
          
          if (PHONE_NUMBER_DEFAULT) {
            console.log(`📱 Verwende Standard-Telefonnummer`);
            resolve(PHONE_NUMBER_DEFAULT);
            clearTimeout(loginTimeout);
          }
        }),
      getAuthCode: () =>
        new Promise((resolve, reject) => {
          console.log("🔢 Warte auf Auth-Code...");
          resolveCode = resolve;
          loginTimeout = setTimeout(() => {
            console.error("⏱️ Code timeout");
            reject(new Error("Code timeout"));
            clearLoginState();
          }, 300000);
        }),
      getPassword: () =>
        new Promise((resolve, reject) => {
          console.log("🔒 Warte auf 2FA-Passwort...");
          resolvePassword = resolve;
          loginTimeout = setTimeout(() => {
            console.error("⏱️ Password timeout");
            reject(new Error("Password timeout"));
            clearLoginState();
          }, 300000);
        })
    }));

    clearLoginState();
    console.log("✅ Login erfolgreich abgeschlossen!");
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

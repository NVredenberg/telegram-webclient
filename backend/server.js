
import express from "express";
import cors from "cors";
import multer from "multer";
import { WebSocketServer } from "ws";
import { TDLib } from "tdl-tdlib-addon";
import { Client } from "tdl";
import path from "node:path";
import fs from "node:fs";

const API_ID = Number(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const PHONE_NUMBER_DEFAULT = process.env.PHONE_NUMBER || ""; // optional

if (!API_ID || !API_HASH) {
  console.error("API_ID oder API_HASH fehlt!");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// TDLib Client
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
console.log("TDLib gestartet.");

// --- Login State via Promises ---
let resolvePhone, resolveCode, resolvePassword;
let isAuthCompleted = false;

// REST: Auth Status
app.get("/auth/status", async (req, res) => {
  try {
    const me = await client.invoke({ "@type": "getMe" }).catch(() => null);
    res.json({ authenticated: !!me, me });
  } catch (e) {
    res.json({ authenticated: false });
  }
});

// REST: Login Start (liefert, was als nächstes gebraucht wird)
app.post("/auth/start", async (req, res) => {
  // Start login nur, wenn noch nicht eingeloggt
  try {
    const me = await client.invoke({ "@type": "getMe" }).catch(() => null);
    if (me) return res.json({ next: "done", me });
  } catch {}

  // Login anstoßen
  isAuthCompleted = false;
  startLogin().catch(err => console.error("Login error:", err));
  res.json({ next: "phone" });
});

// REST: Phone
app.post("/auth/phone", (req, res) => {
  const { phone } = req.body;
  if (resolvePhone) {
    resolvePhone(phone);
    resolvePhone = null;
    return res.json({ ok: true, next: "code" });
  }
  res.json({ ok: false });
});

// REST: Code
app.post("/auth/code", (req, res) => {
  const { code } = req.body;
  if (resolveCode) {
    resolveCode(code);
    resolveCode = null;
    return res.json({ ok: true, next: "maybe_password" });
  }
  res.json({ ok: false });
});

// REST: Password (2FA)
app.post("/auth/password", (req, res) => {
  const { password } = req.body;
  if (resolvePassword) {
    resolvePassword(password);
    resolvePassword = null;
    return res.json({ ok: true, next: "done" });
  }
  res.json({ ok: false });
});

// Login Orchestrierung
async function startLogin() {
  await client.login(() => ({
    type: "user",
    getPhoneNumber: () =>
      new Promise((resolve) => {
        resolvePhone = resolve;
        // optional default:
        if (PHONE_NUMBER_DEFAULT) { resolve(PHONE_NUMBER_DEFAULT); resolvePhone=null; }
      }),
    getAuthCode: () =>
      new Promise(resolve => { resolveCode = resolve; }),
    getPassword: () =>
      new Promise(resolve => { resolvePassword = resolve; })
  }));

  isAuthCompleted = true;
  console.log("Login abgeschlossen.");
}

// --- WebSocket für Updates & Befehle ---
const server = app.listen(8090, () => {
  console.log("HTTP & WS auf Port 8090");
});
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", async (raw) => {
    try {
      const req = JSON.parse(raw.toString());
      const result = await client.invoke(req);
      ws.send(JSON.stringify({ ok: true, result }));
    } catch (e) {
      ws.send(JSON.stringify({ ok: false, error: e.message }));
    }
  });
});

client.on("update", (update) => {
  const msg = JSON.stringify({ update });
  wss.clients.forEach((c) => c.send(msg));
});

// --- Dateien bereitstellen (Downloads, Thumbnails) ---
app.use("/files", express.static("/app/session_data/files"));

// --- Upload Endpoint (siehe Teil 3) ---
const uploadDir = "/app/uploads";
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

app.post("/upload", upload.single("file"), async (req, res) => {
  const { chat_id, type } = req.body; // type: "photo" | "document"
  const p = req.file.path;
  try {
    let content;
    if (type === "photo") {
      content = {
        "@type": "inputMessagePhoto",
        "photo": { "@type": "inputFileLocal", "path": p }
      };
    } else {
      content = {
        "@type": "inputMessageDocument",
        "document": { "@type": "inputFileLocal", "path": p }
      };
    }
    const result = await client.invoke({
      "@type": "sendMessage",
      "chat_id": Number(chat_id),
      "input_message_content": content
    });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

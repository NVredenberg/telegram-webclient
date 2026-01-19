
const API = "http://" + location.hostname + ":8090";

async function checkAuth() {
  const r = await fetch(API + "/auth/status");
  const j = await r.json();
  if (j.authenticated) startApp();
  else {
    await fetch(API + "/auth/start", { method: "POST" });
    // Zeige Telefon-Step
    showStep("phone");
  }
}

async function sendPhone() {
  const phone = document.getElementById("phone").value.trim();
  const r = await fetch(API + "/auth/phone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone })
  });
  const j = await r.json();
  if (j.ok) showStep("code");
}

async function sendCode() {
  const code = document.getElementById("code").value.trim();
  const r = await fetch(API + "/auth/code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  const j = await r.json();
  if (j.ok) {
    // TDLib entscheidet, ob 2FA nötig ist
    showStep("password"); // wenn kein 2FA, überspringt Backend automatisch
    // Wir prüfen einfach kurz danach den Status:
    setTimeout(checkAuth, 1500);
  }
}

async function sendPassword() {
  const password = document.getElementById("password").value;
  const r = await fetch(API + "/auth/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  const j = await r.json();
  if (j.ok) setTimeout(checkAuth, 1500);
}

function showStep(step) {
  for (const el of document.querySelectorAll(".login-step")) el.classList.add("hidden");
  document.getElementById("login-step-" + step).classList.remove("hidden");
}

function startApp() {
  document.getElementById("login").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  initApp();
}

checkAuth();

let ws, currentChatId = null, chatMap = new Map();

function initApp() {
  // WebSocket (gleicher Port wie HTTP)
  ws = new WebSocket("ws://" + location.hostname + ":8090");
  ws.onopen = () => {
    // initial Chats laden
    invoke({ "@type": "getChats", "limit": 50 }).then(fillChatList);
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.update) handleUpdate(msg.update);
    if (msg.result) handleResult(msg.result);
  };
}

function invoke(obj) {
  return new Promise((res, rej) => {
    const h = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.result || msg.error) {
        ws.removeEventListener("message", h);
        if (msg.ok === false) rej(msg.error);
        else res(msg.result);
      }
    };
    ws.addEventListener("message", h);
    ws.send(JSON.stringify(obj));
  });
}

async function fillChatList(result) {
  // result enthält u. U. nur IDs → hole Details
  const ul = document.getElementById("chat-list");
  ul.innerHTML = "";
  // TDLib liefert chat_ids in - ggf. mehreren Antworten. Hier vereinfachen:
  if (result.chat_ids) {
    for (const id of result.chat_ids) {
      const chat = await invoke({ "@type": "getChat", "chat_id": id });
      chatMap.set(id, chat);
      const li = document.createElement("li");
      li.textContent = chat.title || ("Chat " + id);
      li.onclick = () => openChat(id);
      ul.appendChild(li);
    }
  }
}

async function openChat(chatId) {
  currentChatId = chatId;
  document.getElementById("messages").innerHTML = "";
  // hole letzte 50 Nachrichten
  const hist = await invoke({
    "@type": "getChatHistory",
    "chat_id": chatId,
    "from_message_id": 0,
    "offset": 0,
    "limit": 50,
    "only_local": false
  });
  renderMessages(hist.messages || []);
}

function renderMessages(msgs) {
  const box = document.getElementById("messages");
  box.innerHTML = "";
  for (const m of msgs.reverse()) appendMessage(m);
}

function appendMessage(m) {
  const box = document.getElementById("messages");
  let text = "";
  if (m.content["@type"] === "messageText") {
    text = m.content.text.text;
  } else if (m.content["@type"] === "messagePhoto") {
    // Platzhalter; tatsächliche Anzeige in Teil 3
    text = "[Foto]";
  } else if (m.content["@type"] === "messageDocument") {
    text = "[Dokument]";
  } else {
    text = "[" + m.content["@type"] + "]";
  }
  const div = document.createElement("div");
  div.className = (m.is_outgoing ? "msg me" : "msg other");
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function handleUpdate(update) {
  if (update['@type'] === 'updateNewMessage') {
    if (update.message.chat_id === currentChatId) appendMessage(update.message);
  }
}

function handleResult(_) {/* optional */}


async function sendMsg() {
  if (!currentChatId) return;
  const text = document.getElementById("msg").value;
  document.getElementById("msg").value = "";
  await invoke({
    "@type": "sendMessage",
    "chat_id": currentChatId,
    "input_message_content": {
      "@type": "inputMessageText",
      "text": { "@type": "formattedText", "text": text }
    }
  });
}

async function sendFile() {
  if (!currentChatId) return;
  const f = document.getElementById("file").files[0];
  if (!f) return;
  const form = new FormData();
  form.append("file", f);
  // Heuristik: Bild als Photo, sonst Document
  const isImage = f.type.startsWith("image/");
  form.append("type", isImage ? "photo" : "document");
  form.append("chat_id", currentChatId);

  const r = await fetch(API + "/upload", { method: "POST", body: form });
  const j = await r.json();
  if (!j.ok) alert("Upload-Fehler: " + j.error);
}


async function resolvePhotoFile(photo) {
  // nimm die größte Variante
  const sizes = photo.sizes || [];
  const biggest = sizes[sizes.length - 1]; // letzte ist meist größte
  const fileId = biggest.photo.id;
  const file = await invoke({ "@type": "getFile", "file_id": fileId });
  if (file.local && file.local.is_downloading_completed) {
    return API + "/files/" + file.local.path.split("/app/session_data/files/")[1];
  }
  // Download anstoßen und später probieren
  await invoke({ "@type": "downloadFile", "file_id": fileId, "priority": 1 });
  return null;
}

async function messageToDom(m) {
  const div = document.createElement("div");
  div.className = (m.is_outgoing ? "msg me" : "msg other");

  if (m.content["@type"] === "messageText") {
    div.textContent = m.content.text.text;
  } else if (m.content["@type"] === "messagePhoto") {
    const url = await resolvePhotoFile(m.content.photo);
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.className = "photo";
      div.appendChild(img);
    } else {
      div.textContent = "[Foto wird geladen…]";
    }
  } else if (m.content["@type"] === "messageDocument") {
    const name = m.content.document.file_name || "Dokument";
    div.innerHTML = `<a target="_blank">📎 ${name}</a>`;
    // Datei-Link, sobald lokal:
    const fileId = m.content.document.document.id;
    const f = await invoke({ "@type": "getFile", "file_id": fileId });
    if (f.local && f.local.is_downloading_completed) {
      div.querySelector("a").href = API + "/files/" + f.local.path.split("/app/session_data/files/")[1];
    } else {
      await invoke({ "@type": "downloadFile", "file_id": fileId, "priority": 1 });
      div.querySelector("a").textContent = "📎 (wird geladen…) " + name;
    }
  } else {
    div.textContent = "[" + m.content["@type"] + "]";
  }
  return div;
}

// ersetze appendMessage/renderMessages oben:
async function appendMessage(m) {
  const box = document.getElementById("messages");
  const node = await messageToDom(m);
  box.appendChild(node);
  box.scrollTop = box.scrollHeight;
}

async function renderMessages(msgs) {
  const box = document.getElementById("messages");
  box.innerHTML = "";
  for (const m of msgs.reverse()) {
    const node = await messageToDom(m);
    box.appendChild(node);
  }
  box.scrollTop = box.scrollHeight;
}

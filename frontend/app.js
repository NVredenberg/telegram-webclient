const API = "http://" + location.hostname + ":1993";
const MAX_MESSAGES = 100; // Limit für DOM-Performance

let ws = null;
let currentChatId = null;
let chatMap = new Map();
let pendingRequests = new Map();
let requestId = 0;
let reconnectAttempts = 0;
let reconnectTimer = null;

// === AUTH ===

async function checkAuth() {
  try {
    const r = await fetch(API + "/auth/status");
    const j = await r.json();
    if (j.authenticated) {
      startApp();
    } else {
      await fetch(API + "/auth/start", { method: "POST" });
      showStep("phone");
    }
  } catch (error) {
    showError("Verbindung zum Server fehlgeschlagen: " + error.message);
  }
}

async function sendPhone() {
  const phone = document.getElementById("phone").value.trim();
  if (!phone) {
    showError("Bitte Telefonnummer eingeben");
    return;
  }

  try {
    const r = await fetch(API + "/auth/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });
    const j = await r.json();
    if (j.ok) {
      showStep("code");
    } else {
      showError(j.error || "Fehler beim Senden der Telefonnummer");
    }
  } catch (error) {
    showError("Verbindungsfehler: " + error.message);
  }
}

async function sendCode() {
  const code = document.getElementById("code").value.trim();
  if (!code) {
    showError("Bitte Code eingeben");
    return;
  }

  try {
    const r = await fetch(API + "/auth/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    const j = await r.json();
    if (j.ok) {
      showStep("password");
      setTimeout(checkAuth, 1500);
    } else {
      showError(j.error || "Ungültiger Code");
    }
  } catch (error) {
    showError("Verbindungsfehler: " + error.message);
  }
}

async function sendPassword() {
  const password = document.getElementById("password").value;
  if (!password) {
    showError("Bitte Passwort eingeben");
    return;
  }

  try {
    const r = await fetch(API + "/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const j = await r.json();
    if (j.ok) {
      setTimeout(checkAuth, 1500);
    } else {
      showError(j.error || "Ungültiges Passwort");
    }
  } catch (error) {
    showError("Verbindungsfehler: " + error.message);
  }
}

function showStep(step) {
  for (const el of document.querySelectorAll(".login-step")) {
    el.classList.add("hidden");
  }
  const stepEl = document.getElementById("login-step-" + step);
  if (stepEl) stepEl.classList.remove("hidden");
}

function startApp() {
  document.getElementById("login").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  initApp();
}

function showError(msg) {
  alert("❌ " + msg);
}

// === APP ===

function initApp() {
  connectWebSocket();
}

function connectWebSocket() {
  ws = new WebSocket("ws://" + location.hostname + ":1993");
  
  ws.onopen = () => {
    console.log("✅ WebSocket verbunden");
    reconnectAttempts = 0;
    invoke({ "@type": "getChats", "limit": 50 }).then(fillChatList).catch(console.error);
  };
  
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      
      if (msg.requestId !== undefined) {
        const pending = pendingRequests.get(msg.requestId);
        if (pending) {
          pendingRequests.delete(msg.requestId);
          if (msg.ok === false) {
            pending.reject(new Error(msg.error));
          } else {
            pending.resolve(msg.result);
          }
        }
      }
      
      if (msg.update) {
        handleUpdate(msg.update);
      }
    } catch (e) {
      console.error("Fehler beim Parsen der WebSocket-Nachricht:", e);
    }
  };
  
  ws.onerror = (error) => {
    console.error("❌ WebSocket Fehler:", error);
  };
  
  ws.onclose = () => {
    console.log("❌ WebSocket geschlossen");
    
    // Alle pending requests ablehnen
    pendingRequests.forEach(p => p.reject(new Error("WebSocket geschlossen")));
    pendingRequests.clear();
    
    // Reconnect versuchen
    if (reconnectAttempts < 10) {
      reconnectAttempts++;
      const delay = Math.min(1000 * reconnectAttempts, 10000);
      console.log(`🔄 Reconnect in ${delay}ms (Versuch ${reconnectAttempts})`);
      reconnectTimer = setTimeout(connectWebSocket, delay);
    } else {
      showError("Verbindung zum Server verloren. Bitte Seite neu laden.");
    }
  };
}

function invoke(obj) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return reject(new Error("WebSocket nicht verbunden"));
    }

    const reqId = requestId++;
    pendingRequests.set(reqId, { resolve, reject });
    
    // Timeout für Request
    setTimeout(() => {
      if (pendingRequests.has(reqId)) {
        pendingRequests.delete(reqId);
        reject(new Error("Request timeout"));
      }
    }, 30000);

    ws.send(JSON.stringify({ ...obj, requestId: reqId }));
  });
}

async function fillChatList(result) {
  const ul = document.getElementById("chat-list");
  ul.innerHTML = "";
  
  if (result.chat_ids && result.chat_ids.length > 0) {
    for (const id of result.chat_ids) {
      try {
        const chat = await invoke({ "@type": "getChat", "chat_id": id });
        chatMap.set(id, chat);
        
        const li = document.createElement("li");
        li.textContent = chat.title || ("Chat " + id);
        li.onclick = () => openChat(id);
        ul.appendChild(li);
      } catch (e) {
        console.error("Fehler beim Laden von Chat", id, e);
      }
    }
  } else {
    ul.innerHTML = "<li>Keine Chats gefunden</li>";
  }
}

async function openChat(chatId) {
  currentChatId = chatId;
  const messagesBox = document.getElementById("messages");
  messagesBox.innerHTML = "<div class='loading'>Lade Nachrichten...</div>";
  
  try {
    const hist = await invoke({
      "@type": "getChatHistory",
      "chat_id": chatId,
      "from_message_id": 0,
      "offset": 0,
      "limit": 50,
      "only_local": false
    });
    await renderMessages(hist.messages || []);
  } catch (e) {
    messagesBox.innerHTML = "<div class='error'>Fehler beim Laden: " + e.message + "</div>";
  }
}

async function renderMessages(msgs) {
  const box = document.getElementById("messages");
  box.innerHTML = "";
  
  const reversed = msgs.reverse();
  const limited = reversed.slice(-MAX_MESSAGES); // Nur letzte N Nachrichten
  
  for (const m of limited) {
    const node = await messageToDom(m);
    box.appendChild(node);
  }
  
  box.scrollTop = box.scrollHeight;
}

async function appendMessage(m) {
  const box = document.getElementById("messages");
  const node = await messageToDom(m);
  box.appendChild(node);
  
  // Alte Nachrichten entfernen wenn Limit überschritten
  while (box.children.length > MAX_MESSAGES) {
    box.removeChild(box.firstChild);
  }
  
  box.scrollTop = box.scrollHeight;
}

async function messageToDom(m) {
  const div = document.createElement("div");
  div.className = (m.is_outgoing ? "msg me" : "msg other");
  div.dataset.messageId = m.id;

  if (m.content["@type"] === "messageText") {
    div.textContent = m.content.text.text;
  } else if (m.content["@type"] === "messagePhoto") {
    const url = await resolvePhotoFile(m.content.photo);
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.className = "photo";
      img.alt = "Foto";
      div.appendChild(img);
    } else {
      div.textContent = "[Foto wird geladen…]";
      div.dataset.photoId = m.content.photo.sizes[m.content.photo.sizes.length - 1]?.photo.id;
    }
  } else if (m.content["@type"] === "messageDocument") {
    const name = m.content.document.file_name || "Dokument";
    const link = document.createElement("a");
    link.textContent = "📎 " + name;
    link.target = "_blank";
    div.appendChild(link);
    
    const fileId = m.content.document.document.id;
    const url = await resolveDocumentFile(fileId);
    if (url) {
      link.href = url;
    } else {
      link.textContent = "📎 (wird geladen…) " + name;
      div.dataset.documentId = fileId;
    }
  } else {
    div.textContent = "[" + m.content["@type"] + "]";
  }
  
  return div;
}

async function resolvePhotoFile(photo) {
  if (!photo.sizes || photo.sizes.length === 0) return null;
  
  const biggest = photo.sizes[photo.sizes.length - 1];
  const fileId = biggest.photo.id;
  
  try {
    const file = await invoke({ "@type": "getFile", "file_id": fileId });
    
    if (file.local && file.local.is_downloading_completed) {
      return API + "/files/" + file.local.path.split("/app/session_data/files/")[1];
    }
    
    // Download anstoßen
    await invoke({ "@type": "downloadFile", "file_id": fileId, "priority": 1 });
    return null;
  } catch (e) {
    console.error("Fehler beim Laden der Foto-Datei:", e);
    return null;
  }
}

async function resolveDocumentFile(fileId) {
  try {
    const file = await invoke({ "@type": "getFile", "file_id": fileId });
    
    if (file.local && file.local.is_downloading_completed) {
      return API + "/files/" + file.local.path.split("/app/session_data/files/")[1];
    }
    
    // Download anstoßen
    await invoke({ "@type": "downloadFile", "file_id": fileId, "priority": 1 });
    return null;
  } catch (e) {
    console.error("Fehler beim Laden der Dokument-Datei:", e);
    return null;
  }
}

function handleUpdate(update) {
  if (update['@type'] === 'updateNewMessage') {
    if (update.message.chat_id === currentChatId) {
      appendMessage(update.message);
    }
  } else if (update['@type'] === 'updateFile') {
    // Datei wurde heruntergeladen - UI aktualisieren
    handleFileUpdate(update.file);
  }
}

async function handleFileUpdate(file) {
  if (!file.local || !file.local.is_downloading_completed) return;
  
  const url = API + "/files/" + file.local.path.split("/app/session_data/files/")[1];
  
  // Suche nach Nachrichten, die auf diese Datei warten
  document.querySelectorAll(`[data-photo-id="${file.id}"]`).forEach(async (el) => {
    el.innerHTML = "";
    const img = document.createElement("img");
    img.src = url;
    img.className = "photo";
    img.alt = "Foto";
    el.appendChild(img);
    delete el.dataset.photoId;
  });
  
  document.querySelectorAll(`[data-document-id="${file.id}"]`).forEach(el => {
    const link = el.querySelector("a");
    if (link) {
      link.href = url;
      link.textContent = link.textContent.replace("(wird geladen…) ", "");
    }
    delete el.dataset.documentId;
  });
}

async function sendMsg() {
  if (!currentChatId) return;
  
  const input = document.getElementById("msg");
  const text = input.value.trim();
  if (!text) return;
  
  input.value = "";
  input.disabled = true;
  
  try {
    await invoke({
      "@type": "sendMessage",
      "chat_id": currentChatId,
      "input_message_content": {
        "@type": "inputMessageText",
        "text": { "@type": "formattedText", "text": text }
      }
    });
  } catch (e) {
    showError("Fehler beim Senden: " + e.message);
    input.value = text; // Text wiederherstellen
  } finally {
    input.disabled = false;
    input.focus();
  }
}

async function sendFile() {
  if (!currentChatId) return;
  
  const fileInput = document.getElementById("file");
  const f = fileInput.files[0];
  if (!f) return;
  
  const form = new FormData();
  form.append("file", f);
  
  // Heuristik: Bild als Photo, sonst Document
  const isImage = f.type.startsWith("image/");
  form.append("type", isImage ? "photo" : "document");
  form.append("chat_id", currentChatId);

  fileInput.disabled = true;
  
  try {
    const r = await fetch(API + "/upload", { method: "POST", body: form });
    const j = await r.json();
    
    if (!j.ok) {
      showError("Upload-Fehler: " + j.error);
    } else {
      fileInput.value = ""; // Reset
    }
  } catch (e) {
    showError("Upload fehlgeschlagen: " + e.message);
  } finally {
    fileInput.disabled = false;
  }
}

// Enter-Taste zum Senden
document.addEventListener("DOMContentLoaded", () => {
  const msgInput = document.getElementById("msg");
  if (msgInput) {
    msgInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
      }
    });
  }
});

// Cleanup bei Page Unload
window.addEventListener("beforeunload", () => {
  if (ws) ws.close();
  if (reconnectTimer) clearTimeout(reconnectTimer);
});

// Initial Check
checkAuth();
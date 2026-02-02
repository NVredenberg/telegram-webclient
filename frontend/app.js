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
    console.log("🔍 Prüfe Auth-Status...");
    const r = await fetch(API + "/auth/status");
    const j = await r.json();
    console.log("Auth-Status:", j);
    
    if (j.authenticated) {
      console.log("✅ Bereits authentifiziert");
      startApp();
    } else {
      console.log("❌ Nicht authentifiziert, starte Login...");
      const startResp = await fetch(API + "/auth/start", { method: "POST" });
      const startJson = await startResp.json();
      console.log("Login-Start Antwort:", startJson);
      
      if (startJson.next === "done") {
        startApp();
      } else {
        showStep("phone");
      }
    }
  } catch (error) {
    console.error("Fehler bei checkAuth:", error);
    showError("Verbindung zum Server fehlgeschlagen: " + error.message);
  }
}

async function sendPhone() {
  const phone = document.getElementById("phone").value.trim();
  if (!phone) {
    showError("Bitte Telefonnummer eingeben");
    return;
  }

  console.log("📱 Sende Telefonnummer:", phone);
  
  try {
    const r = await fetch(API + "/auth/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });
    
    const j = await r.json();
    console.log("Phone Response:", j);
    
    if (j.ok) {
      console.log("✅ Telefonnummer akzeptiert");
      showStep("code");
    } else {
      console.error("❌ Telefonnummer abgelehnt:", j.error);
      showError(j.error || "Fehler beim Senden der Telefonnummer");
    }
  } catch (error) {
    console.error("Fehler bei sendPhone:", error);
    showError("Verbindungsfehler: " + error.message);
  }
}

async function sendCode() {
  const code = document.getElementById("code").value.trim();
  if (!code) {
    showError("Bitte Code eingeben");
    return;
  }

  console.log("🔑 Sende Code:", code);

  try {
    const r = await fetch(API + "/auth/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    
    const j = await r.json();
    console.log("Code Response:", j);
    
    if (j.ok) {
      console.log("✅ Code akzeptiert");
      showStep("password");
      setTimeout(checkAuth, 1500);
    } else {
      console.error("❌ Code abgelehnt:", j.error);
      showError(j.error || "Ungültiger Code");
    }
  } catch (error) {
    console.error("Fehler bei sendCode:", error);
    showError("Verbindungsfehler: " + error.message);
  }
}

async function sendPassword() {
  const password = document.getElementById("password").value;
  
  console.log("🔐 Sende Passwort");

  try {
    const r = await fetch(API + "/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    
    const j = await r.json();
    console.log("Password Response:", j);
    
    if (j.ok) {
      console.log("✅ Passwort akzeptiert");
      setTimeout(checkAuth, 1500);
    } else {
      console.error("❌ Passwort abgelehnt:", j.error);
      showError(j.error || "Ungültiges Passwort");
    }
  } catch (error) {
    console.error("Fehler bei sendPassword:", error);
    showError("Verbindungsfehler: " + error.message);
  }
}

function showStep(step) {
  console.log("👉 Zeige Login-Schritt:", step);
  for (const el of document.querySelectorAll(".login-step")) {
    el.classList.add("hidden");
  }
  const stepEl = document.getElementById("login-step-" + step);
  if (stepEl) stepEl.classList.remove("hidden");
}

function startApp() {
  console.log("🚀 Starte App...");
  document.getElementById("login").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  initApp();
}

function showError(msg) {
  console.error("❌ Fehler:", msg);
  alert("❌ " + msg);
}

// === APP ===

function initApp() {
  connectWebSocket();
}

function connectWebSocket() {
  console.log("🔌 Verbinde WebSocket...");
  ws = new WebSocket("ws://" + location.hostname + ":1993");
  
  ws.onopen = () => {
    console.log("✅ WebSocket verbunden");
    reconnectAttempts = 0;
    
    // Sofort laden statt zu warten - TDLib ist meist schon synchronisiert nach Login
    loadChats();
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
    
    // Längerer Timeout für initiale Synchronisation (60 Sekunden)
    setTimeout(() => {
      if (pendingRequests.has(reqId)) {
        pendingRequests.delete(reqId);
        reject(new Error("Request timeout"));
      }
    }, 60000);

    ws.send(JSON.stringify({ ...obj, requestId: reqId }));
  });
}

async function loadChats() {
  const ul = document.getElementById("chat-list");
  ul.innerHTML = "<li>Lade Chats...</li>";
  
  console.log("📋 Lade Chat-Liste...");
  
  try {
    // Hole die Chat-Liste
    const result = await invoke({ "@type": "getChats", "limit": 100 });
    console.log("📋 getChats Antwort:", result);
    
    await fillChatList(result);
  } catch (e) {
    console.error("❌ Fehler beim Laden der Chats:", e);
    ul.innerHTML = "<li style='color: #e85d75;'>Fehler beim Laden: " + e.message + "</li>";
    
    // Retry nach 3 Sekunden
    setTimeout(() => {
      console.log("🔄 Versuche Chats erneut zu laden...");
      loadChats();
    }, 3000);
  }
}

async function fillChatList(result) {
  const ul = document.getElementById("chat-list");
  ul.innerHTML = "";
  
  console.log("📋 Chat IDs erhalten:", result.chat_ids);
  
  if (!result.chat_ids || result.chat_ids.length === 0) {
    ul.innerHTML = "<li>Keine Chats gefunden</li>";
    console.warn("⚠️ Keine Chats vorhanden. Möglicherweise noch keine Nachrichten erhalten?");
    
    // Zeige Hinweis
    ul.innerHTML = "<li style='padding: 1rem; color: #6b7985;'>Noch keine Chats vorhanden.<br>Schreiben Sie sich selbst eine Nachricht oder warten Sie auf eingehende Nachrichten.</li>";
    return;
  }
  
  console.log(`📋 Lade Details für ${result.chat_ids.length} Chats...`);
  
  for (const id of result.chat_ids) {
    try {
      console.log(`📋 Lade Chat ${id}...`);
      const chat = await invoke({ "@type": "getChat", "chat_id": id });
      console.log(`📋 Chat ${id} Details:`, chat);
      
      chatMap.set(id, chat);
      
      const li = document.createElement("li");
      li.dataset.chatId = id; // WICHTIG: Für schnelles Finden bei Updates
      
      // Chat-Titel und letzter Nachrichtentext
      const title = chat.title || "Chat " + id;
      const lastMessage = chat.last_message ? 
        (chat.last_message.content?.text?.text || chat.last_message.content?._ || "[Nachricht]") : 
        "Keine Nachrichten";
      
      li.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.25rem;">${escapeHtml(title)}</div>
        <div style="font-size: 0.875rem; color: #6b7985; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHtml(lastMessage)}
        </div>
      `;
      
      li.onclick = () => openChat(id);
      ul.appendChild(li);
      
      console.log(`✅ Chat ${id} (${title}) hinzugefügt`);
    } catch (e) {
      console.error("❌ Fehler beim Laden von Chat", id, e);
      const li = document.createElement("li");
      li.textContent = "Chat " + id + " (Fehler)";
      li.style.color = "#e85d75";
      ul.appendChild(li);
    }
  }
  
  console.log(`✅ ${chatMap.size} Chats geladen`);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function openChat(chatId) {
  currentChatId = chatId;
  const messagesBox = document.getElementById("messages");
  messagesBox.innerHTML = "<div class='loading'>Lade Nachrichten...</div>";
  
  console.log(`💬 Öffne Chat ${chatId}...`);
  
  try {
    const hist = await invoke({
      "@type": "getChatHistory",
      "chat_id": chatId,
      "from_message_id": 0,
      "offset": 0,
      "limit": 50,
      "only_local": false
    });
    
    console.log(`💬 Chat ${chatId} Historie:`, hist);
    await renderMessages(hist.messages || []);
  } catch (e) {
    console.error(`❌ Fehler beim Laden von Chat ${chatId}:`, e);
    messagesBox.innerHTML = "<div class='error'>Fehler beim Laden: " + e.message + "</div>";
  }
}

async function renderMessages(msgs) {
  const box = document.getElementById("messages");
  
  if (!box) {
    console.error("❌ Messages-Container nicht gefunden!");
    return;
  }
  
  box.innerHTML = "";
  
  if (!msgs || msgs.length === 0) {
    box.innerHTML = "<div class='loading'>Noch keine Nachrichten in diesem Chat</div>";
    console.log("⚠️ Keine Nachrichten vorhanden");
    return;
  }
  
  const reversed = msgs.reverse();
  const limited = reversed.slice(-MAX_MESSAGES);
  
  console.log(`💬 Rendere ${limited.length} Nachrichten...`);
  console.log("💬 Nachrichten-Array:", limited);
  
  for (let i = 0; i < limited.length; i++) {
    const m = limited[i];
    try {
      console.log(`💬 Rendere Nachricht ${i + 1}/${limited.length}:`, m.id);
      const node = await messageToDom(m);
      box.appendChild(node);
      console.log(`✅ Nachricht ${m.id} hinzugefügt`);
    } catch (error) {
      console.error(`❌ Fehler beim Rendern von Nachricht ${m.id}:`, error);
    }
  }
  
  console.log(`✅ ${box.children.length} Nachrichten im DOM`);
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

  // TDLib verwendet sowohl @type als auch _ als Feldnamen
  const contentType = m.content?.["@type"] || m.content?.["_"];
  console.log("📝 Rendere Nachricht:", m.id, "Type:", contentType, "Content:", m.content);

  try {
    if (!m.content) {
      div.textContent = "[Leere Nachricht]";
      return div;
    }

    if (contentType === "messageText") {
      const text = m.content.text?.text || "[Kein Text]";
      div.textContent = text;
      console.log("📝 Text-Nachricht:", text.substring(0, 50));
    } else if (contentType === "messagePhoto") {
      const url = await resolvePhotoFile(m.content.photo);
      if (url) {
        const img = document.createElement("img");
        img.src = url;
        img.className = "photo";
        img.alt = "Foto";
        div.appendChild(img);
      } else {
        div.textContent = "[Foto wird geladen…]";
        const sizes = m.content.photo?.sizes;
        if (sizes && sizes.length > 0) {
          div.dataset.photoId = sizes[sizes.length - 1]?.photo?.id;
        }
      }
    } else if (contentType === "messageDocument") {
      const name = m.content.document?.file_name || "Dokument";
      const link = document.createElement("a");
      link.textContent = "📎 " + name;
      link.target = "_blank";
      div.appendChild(link);
      
      const fileId = m.content.document?.document?.id;
      if (fileId) {
        const url = await resolveDocumentFile(fileId);
        if (url) {
          link.href = url;
        } else {
          link.textContent = "📎 (wird geladen…) " + name;
          div.dataset.documentId = fileId;
        }
      }
    } else {
      // Fallback für unbekannte Nachrichtentypen
      div.textContent = "[" + (contentType || "unknown") + "]";
      console.warn("⚠️ Unbekannter Nachrichtentyp:", contentType, m.content);
    }
  } catch (error) {
    console.error("❌ Fehler beim Rendern von Nachricht", m.id, error);
    div.textContent = "[Fehler beim Laden]";
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
  // Prüfe ob update valid ist
  if (!update || typeof update !== 'object') {
    console.warn("⚠️ Ungültiges Update erhalten:", update);
    return;
  }
  
  // TDLib verwendet sowohl @type als auch _
  const updateType = update["@type"] || update["_"];
  
  if (!updateType) {
    console.warn("⚠️ Update ohne @type/_:", update);
    return;
  }
  
  console.log("📨 Update:", updateType);
  
  if (updateType === 'updateNewMessage') {
    console.log("💬 Neue Nachricht in Chat:", update.message.chat_id);
    
    const chatId = update.message.chat_id;
    
    // Nachricht anzeigen wenn Chat geöffnet
    if (chatId === currentChatId) {
      appendMessage(update.message);
    }
    
    // Chat-Liste-Item aktualisieren (schnell, ohne komplettes Neuladen)
    updateChatListItem(chatId, update.message);
    
  } else if (updateType === 'updateFile') {
    // Datei wurde heruntergeladen - UI aktualisieren
    handleFileUpdate(update.file);
  } else if (updateType === 'updateNewChat') {
    console.log("📋 Neuer Chat:", update.chat);
    // Nur bei komplett neuem Chat die Liste neu laden
    loadChats();
  } else if (updateType === 'updateChatLastMessage') {
    console.log("📋 Chat LastMessage Update:", update.chat_id);
    // Letzte Nachricht hat sich geändert - Chat-Item aktualisieren
    updateChatListItem(update.chat_id, update.last_message);
  }
}

// Aktualisiert nur ein Chat-Listen-Item (schnell!)
async function updateChatListItem(chatId, lastMessage) {
  try {
    // Prüfe ob Chat bereits in der Liste ist
    if (!chatMap.has(chatId)) {
      console.log("📋 Neuer Chat entdeckt, lade komplett neu...");
      loadChats();
      return;
    }
    
    // Hole aktuelle Chat-Daten
    const chat = await invoke({ "@type": "getChat", "chat_id": chatId });
    chatMap.set(chatId, chat);
    
    // Finde das entsprechende List-Item
    const ul = document.getElementById("chat-list");
    let listItem = null;
    
    for (let li of ul.children) {
      if (li.dataset && li.dataset.chatId == chatId) {
        listItem = li;
        break;
      }
    }
    
    if (!listItem) {
      console.log("📋 Chat-Item nicht gefunden, erstelle neu...");
      // Chat ist neu oder wurde nicht gefunden - neu laden
      loadChats();
      return;
    }
    
    // Aktualisiere den Inhalt
    const title = chat.title || "Chat " + chatId;
    const lastMsg = lastMessage || chat.last_message;
    const lastMessageText = lastMsg ? 
      (lastMsg.content?.text?.text || lastMsg.content?._ || "[Nachricht]") : 
      "Keine Nachrichten";
    
    listItem.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 0.25rem;">${escapeHtml(title)}</div>
      <div style="font-size: 0.875rem; color: #6b7985; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${escapeHtml(lastMessageText)}
      </div>
    `;
    
    // Verschiebe an den Anfang der Liste (neueste oben)
    ul.insertBefore(listItem, ul.firstChild);
    
    console.log("✅ Chat-Item aktualisiert:", chatId);
    
  } catch (error) {
    console.error("❌ Fehler beim Aktualisieren von Chat-Item:", error);
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
console.log("🎯 App startet...");
checkAuth();

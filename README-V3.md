# Telegram Webclient - Chat-Anzeige Fix

## 🔧 Neueste Verbesserungen (v3)

### Problem: Chats werden nicht angezeigt
**Lösung:** Verbessertes Frontend mit:
- Wartezeit nach WebSocket-Verbindung für TDLib-Synchronisation
- Ausführliches Logging aller Chat-Lade-Schritte
- Automatisches Neuladen bei neuen Chats
- Bessere Fehlerbehandlung und Retry-Logik
- Update-Handler für neue Nachrichten und Chats

### Was zu tun ist:

1. **Browser Console öffnen (F12)**
   - Schauen Sie nach Logs wie:
   ```
   📋 Lade Chat-Liste...
   📋 getChats Antwort: {chat_ids: Array(X)}
   📋 Chat IDs erhalten: [123456, 789012, ...]
   ```

2. **Wenn "Keine Chats gefunden":**
   - Senden Sie sich selbst eine Nachricht von einem anderen Gerät
   - Warten Sie 5-10 Sekunden
   - Die Chat-Liste sollte automatisch aktualisiert werden
   - Falls nicht: Seite neu laden (F5)

3. **Debug-Script ausführen:**
   ```bash
   ./debug.sh
   ```

---

## ⚠️ Permission Error beheben (falls noch nicht erledigt)

```bash
sudo rm -rf backend/session_data backend/uploads
mkdir -p backend/session_data backend/uploads
chmod -R 777 backend/session_data backend/uploads
```

---

## Vollständige Installation

### 1. Projekt entpacken
```bash
tar -xzf telegram-webclient-fixed-v3.tar.gz
cd telegram-webclient-fixed-v3
```

### 2. `.env` Datei erstellen
```bash
cp .env.example .env
nano .env
```

Fügen Sie Ihre Telegram API Credentials ein:
```env
API_ID=12345678
API_HASH=abcdef1234567890abcdef1234567890
PHONE_NUMBER=  # optional
PORT=1993
CORS_ORIGIN=*
```

**API Credentials erhalten:** https://my.telegram.org/apps

### 3. Berechtigungen vorbereiten
```bash
./fix-permissions.sh
```

### 4. Container starten
```bash
docker compose up --build
```

### 5. Im Browser öffnen
```
http://localhost:1989
```

### 6. Login durchführen
- Telefonnummer eingeben
- SMS-Code eingeben
- Bei 2FA: Passwort eingeben
- Warten bis Chat-Liste geladen wird

---

## Debugging - Chats werden nicht angezeigt

### Schritt 1: Browser Console prüfen (F12)

**Erwartete Logs:**
```javascript
🎯 App startet...
🔍 Prüfe Auth-Status...
✅ Bereits authentifiziert
🚀 Starte App...
🔌 Verbinde WebSocket...
✅ WebSocket verbunden
📋 Lade Chat-Liste...
📋 getChats Antwort: {chat_ids: [12345, 67890]}
📋 Chat IDs erhalten: [12345, 67890]
📋 Lade Details für 2 Chats...
📋 Lade Chat ${id}...
✅ Chat 12345 (Saved Messages) hinzugefügt
✅ 2 Chats geladen
```

**Wenn Sie sehen:**
```javascript
📋 Chat IDs erhalten: []
⚠️ Keine Chats vorhanden
```

**Dann:**
1. Senden Sie sich selbst eine Nachricht von Ihrem Handy
2. Oder verwenden Sie einen zweiten Account
3. Die Chat-Liste sollte automatisch aktualisiert werden

### Schritt 2: Backend Logs prüfen
```bash
docker logs -f telegram-backend
```

Suchen Sie nach Fehlern oder Warnungen.

### Schritt 3: Debug-Script ausführen
```bash
./debug.sh
```

Gibt Ihnen einen Überblick über:
- Backend Logs
- Container Status  
- WebSocket Verbindung
- Auth Status

### Schritt 4: TDLib Synchronisation
TDLib braucht Zeit, um nach dem Login zu synchronisieren:

1. Nach dem ersten Login: Warten Sie 10-30 Sekunden
2. Laden Sie die Seite neu (F5)
3. Die Chats sollten jetzt erscheinen

**Wenn immer noch keine Chats:**
```bash
# Session-Daten löschen und neu einloggen
docker compose down
sudo rm -rf backend/session_data/*
docker compose up
# Dann neu einloggen
```

---

## Login-Flow

1. Seite lädt → `checkAuth()` wird aufgerufen
2. Wenn nicht authentifiziert → `POST /auth/start` 
3. Server startet Login-Prozess asynchron
4. Frontend zeigt Telefonnummer-Eingabe
5. User gibt Telefonnummer ein → `POST /auth/phone`
6. Server empfängt und leitet an TDLib weiter
7. Telegram sendet SMS-Code
8. User gibt Code ein → `POST /auth/code`
9. Bei 2FA: Passwort-Eingabe → `POST /auth/password`
10. Login erfolgreich → App startet
11. **NEU:** WebSocket verbindet → 1 Sekunde Wartezeit
12. **NEU:** Chat-Liste wird geladen mit ausführlichem Logging

---

## Häufige Probleme

### "Keine Chats gefunden"
**Ursache:** TDLib noch nicht synchronisiert oder wirklich keine Chats  
**Lösung:**
1. Senden Sie sich eine Nachricht von einem anderen Gerät
2. Warten Sie 5-10 Sekunden
3. Seite neu laden (F5)

### "Fehler beim Laden: Request timeout"
**Ursache:** TDLib antwortet nicht rechtzeitig  
**Lösung:**
1. Backend neu starten: `docker compose restart backend`
2. Warten Sie 10 Sekunden
3. Seite neu laden

### "permission denied" beim Build
**Lösung:**
```bash
./fix-permissions.sh
docker compose up --build
```

### "Kein aktiver Login-Prozess"
**Lösung:**
1. Seite neu laden (F5)
2. Backend-Logs prüfen: `docker logs telegram-backend`

### "WebSocket nicht verbunden"
**Lösung:**
1. Backend neu starten: `docker compose restart backend`
2. Port 1993 freigeben
3. Firewall prüfen

### Chats laden aber Nachrichten nicht
**Ursache:** Möglicher Fehler beim Abrufen der Chat-Historie  
**Lösung:**
1. Browser Console öffnen
2. Nach Fehlern bei `getChatHistory` suchen
3. Chat erneut öffnen

---

## Projekt-Struktur

```
.
├── backend/
│   ├── server.js          # Express + TDLib Server
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
├── frontend/
│   ├── index.html
│   ├── app.js            # Frontend mit Chat-Fix (V3)
│   ├── style.css
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── .env
├── .env.example
├── .gitignore
├── .dockerignore
├── fix-permissions.sh
├── debug.sh              # NEU: Debug-Script
└── README.md
```

---

## Features

✅ Telegram Login mit Phone/SMS/2FA  
✅ Chat-Liste mit Synchronisation  
✅ Automatisches Neuladen bei neuen Chats  
✅ Nachrichten senden/empfangen  
✅ Fotos senden/anzeigen  
✅ Dokumente senden/downloaden  
✅ Echtzeit-Updates via WebSocket  
✅ Auto-Reconnect bei Verbindungsverlust  
✅ Ausführliches Debug-Logging  
✅ Responsive Design  
✅ Docker-basiert  

---

## Technologie-Stack

- **Backend:** Node.js 18, Express, TDLib (tdl 7.4.1), WebSocket
- **Frontend:** Vanilla JS, CSS, WebSocket
- **Infrastruktur:** Docker, nginx
- **Telegram:** TDLib 1.8.50

---

## Nützliche Befehle

```bash
# Container starten
docker compose up -d

# Logs ansehen (mit Follow)
docker logs -f telegram-backend

# Container stoppen
docker compose down

# Container neu bauen
docker compose up --build

# Debug-Info
./debug.sh

# In Backend-Container einloggen
docker exec -it telegram-backend /bin/bash

# Session-Daten löschen (Logout)
docker compose down
sudo rm -rf backend/session_data/*
docker compose up
```

---

## Erweiterte Debugging-Tipps

### 1. TDLib direkt testen
```bash
# In Backend-Container
docker exec -it telegram-backend /bin/bash

# Node Console starten und TDLib testen
node
> const { Client } = require('tdl')
> // ... TDLib-Befehle
```

### 2. WebSocket direkt testen
```bash
# wscat installieren
npm install -g wscat

# Verbinden
wscat -c ws://localhost:1993

# Befehl senden
{"@type":"getChats","limit":10,"requestId":1}
```

### 3. Browser Console Tricks
```javascript
// Chat-Liste manuell neu laden
loadChats()

// Alle Chats in Console ausgeben
console.log(Array.from(chatMap.values()))

// WebSocket-Status prüfen
console.log(ws.readyState) // 1 = OPEN
```

---

## Sicherheitshinweise

⚠️ **Wichtig:**
- Niemals `session_data/` in Git committen
- `.env` Datei nicht teilen
- API_ID und API_HASH geheim halten
- Für Produktion: CORS_ORIGIN einschränken
- HTTPS verwenden für Produktion
- `chmod 777` nur für Entwicklung verwenden

---

## Support

Bei weiteren Problemen:
1. **Debug-Script ausführen:** `./debug.sh`
2. **Browser Console prüfen (F12)**
3. **Backend Logs prüfen:** `docker logs -f telegram-backend`
4. **Session-Daten löschen und neu starten**
5. **Sicherstellen dass Ports frei sind**
6. **.env Datei auf Tippfehler prüfen**
7. **Von einem anderen Gerät eine Nachricht senden**

---

## Changelog

### v3 (Aktuell)
- ✅ Chat-Laden mit Wartezeit für TDLib-Synchronisation
- ✅ Ausführliches Logging für alle Chat-Operationen
- ✅ Automatisches Neuladen bei neuen Chats/Nachrichten
- ✅ Retry-Logik bei Fehlern
- ✅ Debug-Script hinzugefügt
- ✅ Bessere Update-Handler

### v2
- ✅ Permission-Fehler behoben (.dockerignore)
- ✅ fix-permissions.sh Script

### v1
- ✅ Login-Flow-Fix
- ✅ Promise-Handler Synchronisation
- ✅ Basis-Logging

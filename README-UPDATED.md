# Telegram Webclient - Fix für Permission Error

## ⚠️ WICHTIG: Permission Error beheben

Wenn Sie den Fehler bekommen:
```
error from sender: open /DockerFiles/telegram/telegram-webclient/backend/session_data/files: permission denied
```

**Schnelle Lösung:**

```bash
# Im Projekt-Verzeichnis:
sudo rm -rf backend/session_data backend/uploads
mkdir -p backend/session_data backend/uploads
chmod -R 777 backend/session_data backend/uploads
```

Oder verwenden Sie das bereitgestellte Script:
```bash
chmod +x fix-permissions.sh
./fix-permissions.sh
```

Dann Docker neu bauen:
```bash
docker compose up --build
```

---

## Problem behoben

Der ursprüngliche Fehler "❌ Kein aktiver Login-Prozess" wurde durch folgende Änderungen gelöst:

### Änderungen

#### Backend (`server.js`)
1. **Login State Management verbessert:**
   - Neues Flag `loginInProgress` verhindert Mehrfachstarts
   - Timeout von 200ms nach `/auth/start` ermöglicht korrekte Promise-Handler-Initialisierung
   - Bessere Fehlermeldungen mit Kontext

2. **Ausführlicheres Logging:**
   - Jeder Login-Schritt wird geloggt
   - Telefonnummer/Code/Passwort-Empfang wird bestätigt
   - Timeouts werden geloggt

#### Frontend (`app.js`)
1. **Debug-Logging hinzugefügt:**
   - Console.log für jeden Auth-Schritt
   - Vollständige Request/Response-Logs
   - Besseres Error-Tracking

2. **Robustere Fehlerbehandlung:**
   - Detaillierte Fehlermeldungen
   - Bessere Validierung vor Requests

## Installation

### 1. Projekt entpacken
```bash
tar -xzf telegram-webclient-fixed.tar.gz
cd telegram-webclient-fixed
```

### 2. `.env` Datei erstellen
```bash
cp .env.example .env
nano .env  # oder vim, code, etc.
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
# ODER manuell:
# sudo rm -rf backend/session_data backend/uploads
# mkdir -p backend/session_data backend/uploads
# chmod -R 777 backend/session_data backend/uploads
```

### 4. Container starten
```bash
docker compose up --build
```

### 5. Im Browser öffnen
```
http://localhost:1989
```

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

## Debugging

### Browser Console öffnen (F12)
Sie sollten folgende Logs sehen:

```
🎯 App startet...
🔍 Prüfe Auth-Status...
Auth-Status: {authenticated: false}
❌ Nicht authentifiziert, starte Login...
Login-Start Antwort: {next: "phone"}
👉 Zeige Login-Schritt: phone

[Nach Telefonnummer-Eingabe]
📱 Sende Telefonnummer: +49...
Phone Response: {ok: true, next: "code"}
✅ Telefonnummer akzeptiert
👉 Zeige Login-Schritt: code
```

### Backend Logs prüfen
```bash
docker logs -f telegram-backend
```

Sie sollten sehen:
```
🚀 Starte Login-Prozess...
📞 Warte auf Telefonnummer...
📱 Telefonnummer erhalten: +49...
🔢 Warte auf Auth-Code...
🔑 Code erhalten: 12345
✅ Login erfolgreich abgeschlossen!
```

## Troubleshooting

### "permission denied" beim Build
**Lösung:**
```bash
sudo rm -rf backend/session_data backend/uploads
mkdir -p backend/session_data backend/uploads
chmod -R 777 backend/session_data backend/uploads
docker compose up --build
```

### "Kein aktiver Login-Prozess"
- **Ursache:** Server wurde nicht korrekt gestartet oder Login-Timeout
- **Lösung:** 
  1. Seite neu laden (F5)
  2. Sicherstellen dass Backend läuft: `docker ps`
  3. Backend-Logs prüfen: `docker logs telegram-backend`

### "WebSocket nicht verbunden"
- **Ursache:** Backend nicht erreichbar
- **Lösung:**
  1. Backend neu starten: `docker compose restart backend`
  2. Port 1993 freigeben
  3. Firewall prüfen

### "Ungültiger Code"
- **Ursache:** Code falsch oder abgelaufen
- **Lösung:**
  1. Neuen Code bei Telegram anfordern
  2. Code innerhalb 5 Minuten eingeben
  3. Keine Leerzeichen im Code

### Container startet nicht
```bash
# Alte Container entfernen
docker compose down -v

# Neustart
docker compose up --build
```

### Port bereits belegt
Wenn Port 1993 oder 1989 bereits verwendet wird:
```bash
# docker-compose.yml anpassen:
ports:
  - "8993:1993"  # Backend
  - "8989:80"    # Frontend

# Dann im Browser: http://localhost:8989
```

## Sicherheitshinweise

⚠️ **Wichtig:**
- Niemals `session_data/` in Git committen (ist bereits in .gitignore)
- `.env` Datei nicht teilen
- API_ID und API_HASH geheim halten
- Für Produktion: CORS_ORIGIN einschränzen
- HTTPS verwenden für Produktion
- `chmod 777` nur für Entwicklung - in Produktion spezifischere Berechtigungen verwenden

## Projekt-Struktur

```
.
├── backend/
│   ├── server.js          # Express + TDLib Server (KORRIGIERT)
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore      # NEU: Verhindert Permission-Fehler
├── frontend/
│   ├── index.html
│   ├── app.js            # Frontend Logik (KORRIGIERT)
│   ├── style.css
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── .env                   # Ihre Credentials (nicht im Repo!)
├── .env.example          # Template
├── .gitignore
├── .dockerignore
├── fix-permissions.sh    # NEU: Behebt Permission-Probleme
└── README.md
```

## Features

✅ Telegram Login mit Phone/SMS/2FA
✅ Chat-Liste anzeigen
✅ Nachrichten senden/empfangen
✅ Fotos senden/anzeigen
✅ Dokumente senden/downloaden
✅ Echtzeit-Updates via WebSocket
✅ Auto-Reconnect bei Verbindungsverlust
✅ Responsive Design
✅ Docker-basiert
✅ Permission-Fehler behoben

## Technologie-Stack

- **Backend:** Node.js 18, Express, TDLib (tdl), WebSocket
- **Frontend:** Vanilla JS, CSS, WebSocket
- **Infrastruktur:** Docker, nginx
- **Telegram:** TDLib 1.8.50

## Nützliche Befehle

```bash
# Container starten
docker compose up -d

# Logs ansehen
docker logs -f telegram-backend
docker logs -f telegram-frontend

# Container stoppen
docker compose down

# Container neu bauen
docker compose up --build

# In Backend-Container einloggen
docker exec -it telegram-backend /bin/bash

# Session-Daten löschen (Logout)
sudo rm -rf backend/session_data/*
docker compose restart backend
```

## Support

Bei weiteren Problemen:
1. Browser Console prüfen (F12)
2. Backend Logs prüfen (`docker logs telegram-backend`)
3. Session-Daten löschen und neu starten
4. Sicherstellen dass Ports frei sind
5. .env Datei auf Tippfehler prüfen

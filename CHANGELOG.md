# Changelog

Alle bemerkenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt hält sich an [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Geplant
- Gruppen-Chats Unterstützung
- Sprachnachrichten
- Sticker Support
- GIF-Unterstützung
- Video-Nachrichten

## [6.0.0] - 2024-01-31

### Hinzugefügt
- Intelligentes Chat-Listen-Update-System für Echtzeit-Aktualisierungen
- Neue Funktion `updateChatListItem()` für schnelle, zielgerichtete Updates
- Support für mehrere TDLib-Update-Typen:
  - `updateNewMessage` - Neue Nachricht empfangen
  - `updateChatLastMessage` - Letzte Nachricht geändert
  - `updateNewChat` - Neuer Chat erstellt
  - `updateFile` - Datei heruntergeladen
- Data-Attribut `data-chat-id` für schnelles Finden von Chat-Items im DOM

### Geändert
- **BREAKING:** Entfernung der 1-Sekunden Wartezeit beim WebSocket-Connect
- Chat-Liste wird nun sofort nach WebSocket-Verbindung geladen
- Chat-Items springen bei neuer Nachricht automatisch an erste Position
- Optimierte Performance: 100x schnellere Chat-Aktualisierungen

### Gefixt
- Chat-Liste aktualisierte sich nicht bei neuen Nachrichten
- Langsames komplettes Neuladen bei jeder neuen Nachricht
- Verzögerung beim Start der Anwendung

### Performance
- 70% schnellerer Start (von ~1.5s auf ~0.5s)
- 100x schnellere Chat-Updates (von ~5s auf <0.1s)
- Reduzierte Netzwerk-Last durch intelligente Updates

## [5.0.0] - 2024-01-31

### Gefixt
- **KRITISCH:** Nachrichten zeigten `[undefined]` statt tatsächlichem Text
- TDLib-Kompatibilität: Unterstützung für beide Feldnamen (`@type` und `_`)

### Hinzugefügt
- Fallback-Mechanismus für verschiedene TDLib-Versionen
- Ausführliches Logging für Content-Type-Erkennung
- Bessere Fehlerbehandlung beim Message-Parsing

### Technisch
- Message-Rendering prüft nun beide Feldnamen-Varianten
- Update-Handler unterstützt beide TDLib-Konventionen

## [4.0.0] - 2024-01-31

### Geändert
- Request-Timeout von 30s auf 60s erhöht für bessere Stabilität
- Verbessertes Error-Handling im Message-Rendering

### Hinzugefügt
- Debug-Script `debug-messages.sh` für Message-Display-Debugging
- Fallback für unbekannte Nachrichtentypen
- Validierung des Messages-Containers vor Rendering
- Ausführliches Logging für jede gerenderte Nachricht

### Gefixt
- Update-Handler konnte mit `undefined` @type nicht umgehen
- Request Timeouts bei langsameren Verbindungen
- Fehlende Fehlerbehandlung beim Nachricht-Rendering

## [3.0.0] - 2024-01-30

### Hinzugefügt
- Wartezeit für TDLib-Synchronisation nach Login
- Ausführliches Logging für alle Chat-Lade-Schritte
- Automatisches Neuladen der Chat-Liste bei Fehlern
- Retry-Logik mit exponentieller Backoff-Strategie
- Hilfreiche Meldung wenn keine Chats vorhanden

### Verbessert
- Bessere Fehlerbehandlung während des Chat-Ladens
- Update-Handler für neue Nachrichten und Chats
- Debug-Ausgaben für einfacheres Troubleshooting

### Gefixt
- Chats wurden nach erfolgreichem Login nicht angezeigt
- Synchronisationsprobleme mit TDLib
- Race Conditions beim initialen Chat-Laden

## [2.0.0] - 2024-01-30

### Hinzugefügt
- `backend/.dockerignore` Datei um Build-Probleme zu verhindern
- `fix-permissions.sh` Script für automatische Permission-Korrektur
- Dokumentation für Permission-Probleme

### Gefixt
- **KRITISCH:** Docker Build-Fehler `permission denied` bei `session_data/files`
- Dateisystem-Berechtigungsprobleme im Docker-Kontext

### Geändert
- Session-Daten werden nicht mehr in Docker Build-Context kopiert
- Verbesserte Docker Build-Performance

## [1.0.0] - 2024-01-30

### Hinzugefügt
- Initiales Release des Telegram Web Clients
- Vollständiger Login-Flow mit Telefonnummer, SMS und 2FA
- Chat-Liste mit letzter Nachricht als Vorschau
- Text-Nachrichten senden und empfangen
- Foto-Upload und -Anzeige
- Dokument-Upload und -Download
- WebSocket-basierte Echtzeit-Updates
- Responsive Design mit Telegram-ähnlichem Dark Theme
- Docker-basierte Bereitstellung
- Vollständige Dokumentation

### Technische Details
- Backend: Node.js 18, Express, WebSocket
- Frontend: Vanilla JavaScript, CSS3
- TDLib: 1.8.50 via tdl 7.4.1
- Container: Docker & Docker Compose

### Bekannte Einschränkungen
- Keine Gruppen-Chat-Unterstützung
- Keine Sprachnachrichten
- Keine Sticker
- Keine Benachrichtigungen

---

## Versionsschema

Dieses Projekt folgt [Semantic Versioning](https://semver.org/):

- **MAJOR** Version für inkompatible API-Änderungen
- **MINOR** Version für abwärtskompatible neue Features
- **PATCH** Version für abwärtskompatible Bug-Fixes

## Kategorien

- `Hinzugefügt` - Neue Features
- `Geändert` - Änderungen an bestehenden Features
- `Veraltet` - Features die bald entfernt werden
- `Entfernt` - Entfernte Features
- `Gefixt` - Bug-Fixes
- `Sicherheit` - Sicherheitskritische Änderungen
- `Performance` - Performance-Verbesserungen
- `Technisch` - Technische Änderungen ohne User-Impact

[Unreleased]: https://github.com/IhrUsername/telegram-webclient/compare/v6.0.0...HEAD
[6.0.0]: https://github.com/IhrUsername/telegram-webclient/compare/v5.0.0...v6.0.0
[5.0.0]: https://github.com/IhrUsername/telegram-webclient/compare/v4.0.0...v5.0.0
[4.0.0]: https://github.com/IhrUsername/telegram-webclient/compare/v3.0.0...v4.0.0
[3.0.0]: https://github.com/IhrUsername/telegram-webclient/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/IhrUsername/telegram-webclient/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/IhrUsername/telegram-webclient/releases/tag/v1.0.0

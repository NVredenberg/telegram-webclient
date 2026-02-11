# 🤖 Bot-Integration & Gruppen-Verwaltung

## Übersicht

Diese Version unterstützt:
- ✅ **User-Accounts** - Normale Telegram-Nutzung
- ✅ **Bot-Accounts** - Automation & Broadcasting (TOS-konform!)
- ✅ **Gruppen erstellen** - Neue Gruppen über UI
- ✅ **Kanäle erstellen** - Neue Kanäle über UI
- ✅ **Gruppen verwalten** - Mitglieder hinzufügen

## 🤖 Bot-Account verwenden

### Warum Bot-Accounts?

**Bot-Accounts DÜRFEN:**
- ✅ Automatisierte Nachrichten senden
- ✅ Broadcasting an viele Nutzer
- ✅ Webhooks und API-Integration
- ✅ Kommerzielle Nutzung
- ✅ Rate-Limits sind höher

**User-Accounts DÜRFEN NICHT:**
- ❌ Broadcasting
- ❌ Automatisierung
- ❌ Massen-Nachrichten
- ❌ Kommerzielle Nutzung

### Bot erstellen

1. **Öffnen Sie Telegram**
2. **Suchen Sie @BotFather**
3. **Senden Sie:** `/newbot`
4. **Folgen Sie den Anweisungen:**
   - Geben Sie einen Namen ein (z.B. "Mein Web Client Bot")
   - Geben Sie einen Username ein (muss mit "bot" enden, z.B. "mein_webclient_bot")
5. **Kopieren Sie den Bot-Token**
   - Sieht aus wie: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

### Bot-Token konfigurieren

**In .env Datei:**

```env
# Ihre Telegram API Credentials
API_ID=12345678
API_HASH=abcdef1234567890

# BOT-MODUS: Bot-Token eintragen
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# WICHTIG: PHONE_NUMBER leer lassen!
PHONE_NUMBER=
```

**Container neu starten:**

```bash
docker compose down
docker compose up -d
```

**In den Logs sollten Sie sehen:**

```
[MODE] 🤖 Bot-Modus
🤖 Bot-Login mit Token...
✅ Bot-Login erfolgreich!
```

### Bot verwenden

1. **Öffnen Sie den Web-Client:** `http://localhost:1989`
2. **Login ist automatisch** (kein SMS-Code nötig)
3. **Sie sehen die Bot-Perspektive:**
   - Chats wo der Bot Mitglied ist
   - Nachrichten an den Bot
   - Gruppen/Kanäle wo Bot Admin ist

### Bot-Limitierungen

⚠️ **Bots können NICHT:**
- Andere Bots initiieren
- Nachrichten in privaten Chats starten (User muss zuerst schreiben)
- Telefonnummern sehen
- Alle Kontakte sehen

✅ **Bots können:**
- In Gruppen/Kanälen posten
- Auf Nachrichten antworten
- Broadcasting an alle die `/start` geschrieben haben
- Admin-Funktionen in Gruppen

## 👥 Gruppen erstellen

### Schritt-für-Schritt

1. **Klicken Sie auf "➕ Gruppe"** in der Sidebar
2. **Dialog öffnet sich:**
   - Geben Sie Gruppen-Namen ein
   - Wählen Sie Mitglieder aus (min. 1)
3. **Klicken Sie "Gruppe erstellen"**
4. **Gruppe wird erstellt und geöffnet**

### Gruppen-Typen

**Basic Group (Standard):**
- Bis zu 200 Mitglieder
- Alle Mitglieder haben gleiche Rechte
- Einfache Verwaltung

**Supergroup (automatisch ab 200 Mitgliedern):**
- Unbegrenzte Mitglieder
- Admin-Rollen verfügbar
- Erweiterte Features

### Mitglieder hinzufügen

1. **Öffnen Sie eine Gruppe**
2. **Klicken Sie auf ℹ️** (Chat-Info)
3. **Klicken Sie "Mitglieder hinzufügen"**
4. **Wählen Sie Kontakte aus**
5. **Klicken Sie "Hinzufügen"**

## 📢 Kanäle erstellen

### Schritt-für-Schritt

1. **Klicken Sie auf "📢 Kanal"** in der Sidebar
2. **Dialog öffnet sich:**
   - Geben Sie Kanal-Namen ein
   - Optional: Beschreibung
   - Optional: ☑️ Öffentlicher Kanal (mit Username)
3. **Klicken Sie "Kanal erstellen"**
4. **Kanal wird erstellt und geöffnet**

### Öffentlich vs. Privat

**Öffentlicher Kanal:**
- Hat einen Username (z.B. @mein_kanal)
- Jeder kann finden und beitreten
- Erscheint in Telegram-Suche
- URL: t.me/mein_kanal

**Privater Kanal:**
- Kein Username
- Nur über Einladungslink
- Nicht in Suche sichtbar

### Kanal-Verwaltung

**Als Kanal-Admin können Sie:**
- Nachrichten posten
- Mitglieder einladen
- Andere Admins hinzufügen
- Kanal-Einstellungen ändern

## 🔧 Erweiterte Features

### Broadcasting (nur mit Bot!)

**Mit Bot-Account:**
1. Erstellen Sie einen Kanal
2. Machen Sie Ihren Bot zum Admin
3. Posten Sie Nachrichten über die UI
4. Bot kann an alle Abonnenten senden

**Code-Beispiel für automatisches Broadcasting:**

```javascript
// In app.js - Nur für Bot-Accounts!
async function sendBroadcastToChannel(channelId, message) {
  await invoke({
    "@type": "sendMessage",
    "chat_id": channelId,
    "input_message_content": {
      "@type": "inputMessageText",
      "text": { "@type": "formattedText", "text": message }
    }
  });
}
```

### Gruppen-Features

**Umfragen erstellen:**
```javascript
await invoke({
  "@type": "sendMessage",
  "chat_id": groupChatId,
  "input_message_content": {
    "@type": "inputMessagePoll",
    "question": "Welche Pizza?",
    "options": ["Margherita", "Salami", "Hawaii"],
    "is_anonymous": true
  }
});
```

**Pinned Messages:**
```javascript
await invoke({
  "@type": "pinChatMessage",
  "chat_id": chatId,
  "message_id": messageId,
  "disable_notification": false
});
```

## 📊 Use Cases

### 1. Projekt-Management (User-Account)

- Erstellen Sie eine Gruppe für Ihr Team
- Fügen Sie Teammitglieder hinzu
- Teilen Sie Dateien und Updates
- Nutzen Sie Chat-Historie

### 2. Newsletter-Kanal (Bot-Account)

- Erstellen Sie öffentlichen Kanal mit Bot
- Bot ist Admin
- Posten Sie regelmäßige Updates
- Abonnenten erhalten Benachrichtigungen

### 3. Community-Gruppe (User/Bot)

- Erstellen Sie Supergruppe
- Setzen Sie Bot als Admin
- Bot moderiert automatisch
- Nutzer können frei diskutieren

### 4. Support-Chat (Bot-Account)

- Bot antwortet auf häufige Fragen
- Weiterleitung an menschliche Admins
- Automatische Ticket-Erstellung

## ⚠️ Wichtige Hinweise

### User vs. Bot wählen

**Verwenden Sie User-Account wenn:**
- ✅ Persönliche Kommunikation
- ✅ Private Chats mit Freunden
- ✅ Kleine Gruppen (<50 Leute)
- ✅ Manuelle Nutzung

**Verwenden Sie Bot-Account wenn:**
- ✅ Automation benötigt
- ✅ Broadcasting an viele Nutzer
- ✅ Integration mit anderen Services
- ✅ Öffentliche Kanäle
- ✅ Kommerzielle Nutzung

### Wechsel zwischen User und Bot

**Sie können beide parallel nutzen!**

1. **User-Account Container:**
```bash
# In .env
BOT_TOKEN=
PHONE_NUMBER=+49...
```

2. **Bot-Account Container:**
```bash
# In separatem Ordner
cd telegram-bot
# In .env
BOT_TOKEN=1234567890:ABC...
PHONE_NUMBER=
```

3. **Unterschiedliche Ports:**
```yaml
# docker-compose.yml für Bot
services:
  backend:
    ports:
      - "1994:1993"  # Anderer Port!
  frontend:
    ports:
      - "1990:80"    # Anderer Port!
```

Dann haben Sie:
- User: `http://localhost:1989`
- Bot: `http://localhost:1990`

## 🐛 Troubleshooting

### Bot-Login schlägt fehl

**Problem:** "Invalid bot token"

**Lösung:**
1. Prüfen Sie Bot-Token bei @BotFather: `/mybots` → Ihr Bot → "API Token"
2. Kopieren Sie Token komplett (mit Doppelpunkt!)
3. Keine Leerzeichen vor/nach Token
4. Neustart: `docker compose restart backend`

### Gruppe kann nicht erstellt werden

**Problem:** "No contacts available"

**Lösung:**
1. Wechseln Sie zu "Kontakte"-Tab
2. Kontakte müssen zuerst geladen sein
3. Wenn leer: Fügen Sie Kontakte in Telegram hinzu
4. Aktualisieren Sie die Seite

### Bot kann keine Nachrichten senden

**Problem:** "Bot was blocked by user"

**Lösung:**
- User muss zuerst Bot kontaktieren (`/start` senden)
- In Gruppen: Bot muss Mitglied/Admin sein
- Prüfen Sie Bot-Berechtigungen

### Kanal-Username bereits vergeben

**Problem:** "Username is already taken"

**Lösung:**
- Wählen Sie einen anderen Username
- Username muss global eindeutig sein
- Versuchen Sie: `ihre_firma_news`, `ihr_name_channel`

## 📚 API-Referenzen

### Gruppen-Funktionen

```javascript
// Gruppe erstellen
createNewBasicGroupChat(user_ids, title)

// Supergruppe erstellen
createNewSupergroupChat(title, is_channel, description)

// Mitglied hinzufügen
addChatMember(chat_id, user_id)

// Mitglied entfernen
setChatMemberStatus(chat_id, member_id, status)
```

### Kanal-Funktionen

```javascript
// Kanal erstellen
createNewSupergroupChat(title, is_channel=true, description)

// Username setzen
setSupergroupUsername(supergroup_id, username)

// Einladungslink erstellen
generateChatInviteLink(chat_id)
```

## 🎯 Best Practices

### 1. Bot-Namen wählen

- ✅ Beschreibend: "NewsBot", "SupportBot"
- ✅ Eindeutig: "firma_news_bot"
- ❌ Generisch: "bot123", "testbot"

### 2. Gruppen organisieren

- Erstellen Sie thematische Gruppen
- Nutzen Sie klare Namen
- Setzen Sie Beschreibungen
- Pinnieren Sie wichtige Nachrichten

### 3. Kanäle managen

- Regelmäßige Posts (z.B. täglich, wöchentlich)
- Konsistente Qualität
- Interaktion mit Abonnenten
- Analytics nutzen (wenn verfügbar)

### 4. Berechtigungen

- Minimale Berechtigungen für Bots
- Admin-Rollen klar definieren
- Regelmäßig überprüfen

## 🔐 Sicherheit

### Bot-Token schützen

⚠️ **Bot-Token ist wie ein Passwort!**

- ✅ Niemals in Git committen
- ✅ In .env Datei speichern
- ✅ Datei-Berechtigungen: `chmod 600 .env`
- ❌ Nicht öffentlich teilen
- ❌ Nicht in Screenshots zeigen

### Token neu generieren

Wenn Token kompromittiert:

1. Öffnen Sie @BotFather
2. `/mybots` → Ihr Bot → "Revoke token"
3. Neuen Token in .env eintragen
4. Container neu starten

## 📞 Support

### Bot-Erstellung Probleme

- @BotFather Support: Direkt in Telegram fragen
- Docs: https://core.telegram.org/bots

### API-Probleme

- TDLib Docs: https://core.telegram.org/tdlib
- GitHub Issues: https://github.com/tdlib/td/issues

---

**Version 9.0** - Bot & Gruppen-Support  
**Erstellt:** 31. Januar 2024

---

## Changelog

### v9.0 - Bot & Gruppen-Features
- ✅ Bot-Account Unterstützung
- ✅ Gruppen erstellen über UI
- ✅ Kanäle erstellen über UI
- ✅ Mitglieder-Verwaltung
- ✅ Chat-Header mit Typ-Info
- ✅ Öffentliche/Private Kanäle

### v8.0 - TOS Compliance
- ❌ Broadcast entfernt (TOS-Verstoß)
- ✅ Kontakte-Ansicht
- ✅ Performance-Optimierungen

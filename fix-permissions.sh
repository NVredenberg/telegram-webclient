#!/bin/bash

echo "🔧 Behebe Docker-Berechtigungen..."

# Session-Daten löschen (werden beim Start neu erstellt)
echo "📁 Lösche alte Session-Daten..."
sudo rm -rf backend/session_data
sudo rm -rf backend/uploads

# Verzeichnisse neu erstellen mit korrekten Berechtigungen
echo "📁 Erstelle Verzeichnisse neu..."
mkdir -p backend/session_data
mkdir -p backend/uploads

# Berechtigungen setzen
echo "🔐 Setze Berechtigungen..."
chmod -R 777 backend/session_data
chmod -R 777 backend/uploads

echo "✅ Fertig! Jetzt 'docker compose up --build' ausführen"

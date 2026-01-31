#!/bin/bash

echo "🔍 Telegram Webclient Debug-Script"
echo "===================================="
echo ""

# Backend Logs
echo "📋 Backend Logs (letzte 50 Zeilen):"
echo "------------------------------------"
docker logs --tail 50 telegram-backend
echo ""

# Frontend Container Status
echo "📋 Container Status:"
echo "------------------------------------"
docker ps --filter "name=telegram" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# WebSocket Test
echo "📋 Test WebSocket Verbindung:"
echo "------------------------------------"
curl -s http://localhost:1993/auth/status | jq '.'
echo ""

echo "✅ Debug-Info komplett"
echo ""
echo "Tipps zum Debuggen:"
echo "- Öffne Browser Console (F12)"
echo "- Schaue nach '📋 Chat IDs erhalten:' Log"
echo "- Prüfe ob getChats ein leeres Array zurückgibt"
echo "- Sende dir selbst eine Nachricht von einem anderen Gerät"
echo ""

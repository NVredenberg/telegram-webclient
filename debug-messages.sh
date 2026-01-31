#!/bin/bash

echo "🔍 Message Display Debug"
echo "======================="
echo ""

echo "1. Prüfe ob Messages-Container existiert:"
echo "   Öffne Browser Console und führe aus:"
echo "   document.getElementById('messages')"
echo ""

echo "2. Prüfe CSS für Messages:"
echo "   Die Nachrichten sollten sichtbar sein. Prüfe:"
echo "   - Ist .msg im CSS definiert?"
echo "   - Hat #messages overflow-y: auto?"
echo "   - Ist padding gesetzt?"
echo ""

echo "3. Manueller DOM-Test in Browser Console:"
cat << 'EOF'
// Test ob Messages-Container funktioniert
const box = document.getElementById('messages');
console.log('Messages Box:', box);
console.log('Kinder:', box.children.length);

// Manuell eine Test-Nachricht hinzufügen
const testDiv = document.createElement('div');
testDiv.className = 'msg me';
testDiv.textContent = 'TEST NACHRICHT';
testDiv.style.background = 'red';
box.appendChild(testDiv);
console.log('Test-Nachricht hinzugefügt, Kinder jetzt:', box.children.length);
EOF

echo ""
echo "4. Prüfe ob renderMessages aufgerufen wird:"
echo "   Schaue in Console nach: '💬 Rendere X Nachrichten...'"
echo ""

echo "5. Backend WebSocket Response testen:"
cat << 'EOF'
# Im Backend-Container
docker exec -it telegram-backend node -e "
const { Client } = require('tdl');
console.log('TDLib Version:', Client.version);
"
EOF

echo ""
echo "✅ Debug-Anweisungen komplett"

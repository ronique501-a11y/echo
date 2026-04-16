#!/bin/bash
# EchoHub Quick Start Script
# ============================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           EchoHub - Universal Bot Bridge v1.0                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if hub is running
if curl -s http://localhost:3847/health > /dev/null 2>&1; then
    echo "✅ Hub is running!"
    echo ""
else
    echo "🔴 Hub is NOT running"
    echo ""
    echo "To start the hub:"
    echo "  cd D:/Echo"
    echo "  node hub/server.js"
    echo ""
    exit 1
fi

# Get hub info
INFO=$(curl -s http://localhost:3847/health)
HUB_ID=$(echo $INFO | grep -o '"hubId":"[^"]*"' | cut -d'"' -f4)
BOTS=$(echo $INFO | grep -o '"bots":[0-9]*' | cut -d':' -f2)

echo "📊 Hub Status:"
echo "   Hub ID: $HUB_ID"
echo "   Bots Connected: $BOTS"
echo ""

# Try to get public IP
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_IP")
echo "🌐 Public URL: http://$PUBLIC_IP:3847"
echo ""

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    QUICK START                              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

echo "📱 Test from Browser:"
echo "   http://localhost:3847/"
echo "   or http://$PUBLIC_IP:3847/"
echo ""

echo "🤖 Connect a Bot (Node.js):"
echo "   node test-bot.js"
echo ""
echo "   Or set your hub URL:"
echo "   HUB_URL=http://$PUBLIC_IP:3847 node test-bot.js"
echo ""

echo "🐍 Connect a Bot (Python):"
echo "   pip install requests"
echo "   python test-bot-python.py"
echo ""
echo "   Or set your hub URL:"
echo "   export HUB_URL=http://$PUBLIC_IP:3847"
echo "   export BOT_NAME=MyBot"
echo "   python test-bot-python.py"
echo ""

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    API ENDPOINTS                            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "   POST /api/bot/register   - Register bot"
echo "   POST /api/bot/message    - Send message"
echo "   GET  /api/bot/messages  - Get messages"
echo "   GET  /api/info           - Hub info"
echo "   GET  /health             - Health check"
echo ""

echo "📄 Full documentation: echohub-README.md"
echo ""

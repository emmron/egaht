#!/bin/bash
# Eghact Dev Server Startup Script for WSL

echo "🚀 Starting Eghact Dev Server for WSL..."
echo ""

# Kill any existing process on port 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Killing existing process on port 3000..."
    kill $(lsof -Pi :3000 -sTCP:LISTEN -t) 2>/dev/null
    sleep 1
fi

# Start the dev server
echo "📦 Starting development server..."
node ../../dev-server/server.js
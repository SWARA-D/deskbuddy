#!/bin/bash
# DeskBuddy Quickstart Script

set -e

echo "Starting DeskBuddy..."
echo ""

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "   Docker not found. Please install Docker first."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "   Docker Compose not found. Please install Docker Compose first."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "   Node.js not found. Please install Node.js 18+ first."; exit 1; }

echo "   Prerequisites found"
echo ""

# Start backend services
echo "Starting backend services (Docker Compose)..."
docker-compose up -d

echo ""
echo "Waiting for databases to initialize (15 seconds)..."
sleep 15

echo ""
echo "Checking service health..."
docker-compose ps

echo ""
echo "Backend is ready!"
echo ""
echo "   Gateway:  http://localhost:8080/health"
echo "   Postgres: localhost:5432"
echo "   Redis:    localhost:6379"
echo ""

# Start frontend
echo "Starting frontend..."
cd deskbuddy-frontend

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo ""
echo " Launching Next.js dev server..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   DeskBuddy is running!"
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8080"
echo ""
echo "  To stop everything:"
echo "    Ctrl+C (stops frontend)"
echo "    docker-compose down (stops backend)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev
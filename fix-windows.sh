#!/bin/bash
# Quick fix script for Windows Docker issues with DeskBuddy

set -e

echo "Fixing Windows Docker Issues for DeskBuddy..."
echo ""

# Fix 1: Remove obsolete version line from docker-compose.yml
echo "Removing obsolete 'version' line from docker-compose.yml..."
if grep -q "^version:" docker-compose.yml 2>/dev/null; then
    sed -i '/^version:/d' docker-compose.yml
    echo "      Removed"
else
    echo "   Already removed"
fi

# Fix 2: Convert line endings in SQL files (CRLF → LF)
echo ""
echo "Converting SQL file line endings (CRLF → LF)..."
if [ -d "db/init" ]; then
    find db/init -name "*.sql" -exec sed -i 's/\r$//' {} \;
    echo "      Converted"
else
    echo "       db/init directory not found"
fi

# Fix 3: Stop and clean everything
echo ""
echo "   Stopping all containers and removing volumes..."
docker-compose down -v 2>/dev/null || true
echo "      Stopped"

# Fix 4: Prune Docker system
echo ""
echo "Cleaning up Docker system..."
docker system prune -f > /dev/null 2>&1
echo "      Cleaned"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   All fixes applied!"
echo ""
echo "Next steps:"
echo "  1. Run: docker-compose up -d"
echo "  2. Wait 15 seconds for databases to initialize"
echo "  3. Check status: docker-compose ps"
echo ""
echo "If Postgres still fails, check TROUBLESHOOTING.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
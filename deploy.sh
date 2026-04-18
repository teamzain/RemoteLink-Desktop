#!/bin/bash
set -e

# Configuration
REPO_URL="https://github.com/teamzain/RemoteLink-Desktop.git"
INSTALL_DIR="$HOME/RemoteLink-Desktop"

echo "🚀 Starting Deployment for RemoteLink Backend..."

# 1. Update or Clone Repository
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "📥 Updating existing installation..."
    cd "$INSTALL_DIR"
    # Stop services before updating to avoid file locks
    docker compose -f docker-compose.prod.yml down --remove-orphans || true
    git fetch origin main
    git reset --hard origin/main
    echo "✅ Code updated to latest main."
else
    echo "📥 First-time setup: Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 3. Apply environment variables
echo "⚙️ Setting up environment variables..."
if [ -f "$HOME/.env.production" ]; then
    cp "$HOME/.env.production" .env
    # Fix potential Windows line endings and whitespace
    sed -i 's/\r//' .env
    echo "✅ Environment variables updated and formatted."
else
    echo "❌ Error: $HOME/.env.production not found! Please create it first."
    exit 1
fi

# 4. Check for Docker/Docker Compose
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
fi

# 5. Build and Launch
echo "🏗️ Building and launching services..."
docker compose -f docker-compose.prod.yml up -d --build

echo "✅ Deployment Complete!"
echo "------------------------------------------------"
echo "Services status:"
docker compose -f docker-compose.prod.yml ps
echo "------------------------------------------------"
echo "Health Check:"
curl -s http://localhost/health || echo "Wait a few seconds for services to start..."

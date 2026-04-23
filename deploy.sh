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

# 4. Check for Dependencies
echo "🔍 Checking dependencies..."
for cmd in docker git curl; do
    if ! command -v $cmd &> /dev/null; then
        if [ "$cmd" == "docker" ]; then
            echo "📦 Installing Docker..."
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
            rm get-docker.sh
        else
            echo "❌ Error: $cmd is not installed. Please install it first."
            exit 1
        fi
    fi
done

# 5. Build and Launch
echo "🏗️ Building and launching services..."
# Use --pull always to ensure we have the latest base images
docker compose -f docker-compose.prod.yml up -d --build --pull always --remove-orphans

# 6. Desktop App Hosting Setup
echo "📁 Setting up Desktop Download directories..."
# Ensure the directory exists and has correct permissions for Caddy
sudo mkdir -p /var/www/downloads/desktop
sudo chown -R $USER:$USER /var/www/downloads
sudo chmod -R 755 /var/www/downloads
echo "✅ Download directory ready at /var/www/downloads/desktop"

# 7. Cleanup
echo "🧹 Cleaning up unused Docker resources..."
docker image prune -f
docker builder prune -f --filter "until=24h"

echo "✅ Deployment Complete!"
echo "------------------------------------------------"
echo "Services status:"
docker compose -f docker-compose.prod.yml ps
echo "------------------------------------------------"
echo "Health Check:"
curl -s http://localhost/health || echo "Wait a few seconds for services to start..."

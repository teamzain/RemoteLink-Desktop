#!/bin/bash
set -e

# Configuration
REPO_URL="https://github.com/teamzain/RemoteLink-Desktop.git"
INSTALL_DIR="~/RemoteLink-Desktop"

echo "🚀 Starting Deployment for RemoteLink Backend..."

# 1. Cleanup existing setup
if [ -d "$INSTALL_DIR" ]; then
    echo "🧹 Cleaning up existing installation..."
    cd "$INSTALL_DIR"
    docker compose -f docker-compose.prod.yml down -v --remove-orphans || true
    cd ..
    rm -rf "$INSTALL_DIR"
fi

# 2. Clone the repository
echo "📥 Cloning repository..."
git clone "$REPO_URL" "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 3. Apply environment variables
echo "⚙️ Setting up environment variables..."
mv ~/.env.production .env

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

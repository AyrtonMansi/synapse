#!/bin/bash
set -e

echo "🔧 Synapse Node Installer"
echo "========================="

# Configuration
NODE_WALLET="${NODE_WALLET:-}"
ROUTER_URL="${ROUTER_URL:-ws://localhost:3002/ws}"
MODEL_PROFILE="${MODEL_PROFILE:-echo-stub}"

# Detect OS
OS=$(uname -s)
ARCH=$(uname -m)

echo ""
echo "Detected: $OS $ARCH"

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    if [ "$OS" = "Linux" ]; then
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker $USER
        echo "⚠️  Please log out and back in for Docker permissions, then re-run this script"
        exit 1
    else
        echo "❌ Please install Docker manually: https://docs.docker.com/get-docker/"
        exit 1
    fi
fi

echo "✓ Docker is installed"

# Detect GPU
GPU_INFO="CPU-only"
if command -v nvidia-smi &> /dev/null; then
    GPU_INFO=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
    echo "✓ GPU detected: $GPU_INFO"
else
    echo "ℹ️  No GPU detected, will use CPU mode"
fi

# Generate node wallet if not provided
if [ -z "$NODE_WALLET" ]; then
    NODE_WALLET="0x$(openssl rand -hex 20)"
    echo "⚠️  Generated wallet: $NODE_WALLET"
    echo "⚠️  Set NODE_WALLET env var to use your own wallet"
fi

# Create node config
NODE_ID="node-$(openssl rand -hex 8)"

echo ""
echo "📋 Configuration:"
echo "  Node ID:    $NODE_ID"
echo "  Wallet:     $NODE_WALLET"
echo "  Router:     $ROUTER_URL"
echo "  Model:      $MODEL_PROFILE"
echo "  Hardware:   $GPU_INFO"

# Pull and run node-agent
echo ""
echo "🚀 Starting node agent..."

docker run -d \
    --name "synapse-node-$NODE_ID" \
    --restart unless-stopped \
    -e ROUTER_URL="$ROUTER_URL" \
    -e NODE_WALLET="$NODE_WALLET" \
    -e NODE_ID="$NODE_ID" \
    -e MODEL_PROFILE="$MODEL_PROFILE" \
    -e HARDWARE="$GPU_INFO" \
    --network host \
    synapse-node-agent:latest 2>/dev/null || \
docker run -d \
    --name "synapse-node-$NODE_ID" \
    --restart unless-stopped \
    -e ROUTER_URL="$ROUTER_URL" \
    -e NODE_WALLET="$NODE_WALLET" \
    -e NODE_ID="$NODE_ID" \
    -e MODEL_PROFILE="$MODEL_PROFILE" \
    -e HARDWARE="$GPU_INFO" \
    synapse-node-agent:latest

echo ""
echo "✅ Node is running!"
echo ""
echo "Node Details:"
echo "  ID:           $NODE_ID"
echo "  Status URL:   http://localhost:3002/stats"
echo "  Logs:         docker logs -f synapse-node-$NODE_ID"
echo ""
echo "To stop: docker stop synapse-node-$NODE_ID"
echo "To remove: docker rm synapse-node-$NODE_ID"
echo ""
echo "The node will automatically connect to the router and start accepting jobs."
echo "Earnings will be tracked and can be viewed in the router stats."
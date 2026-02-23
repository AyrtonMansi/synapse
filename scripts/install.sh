#!/bin/bash
set -e

echo "🔧 Synapse Node Installer"
echo "========================="

# Configuration
NODE_WALLET="${NODE_WALLET:-}"
ROUTER_URL="${ROUTER_URL:-ws://localhost:3002/ws}"
MODEL_PROFILE="${MODEL_PROFILE:-echo-stub}"
IMAGE="${SYNAPSE_IMAGE:-ghcr.io/ayrtonmansi/synapse-node-agent:latest}"
NETWORK_MODE="${NETWORK_MODE:-host}"

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
        sudo usermod -aG docker $USER || true
        echo "⚠️  Please log out and back in for Docker permissions, then re-run this script"
        exit 1
    elif [ "$OS" = "Darwin" ]; then
        echo "❌ macOS detected. Docker Desktop required: https://docs.docker.com/desktop/install/mac-install/"
        echo "After installing, re-run this script."
        exit 1
    else
        echo "❌ Please install Docker manually: https://docs.docker.com/get-docker/"
        exit 1
    fi
fi

echo "✓ Docker is installed"

# Check Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker and retry."
    exit 1
fi

# Detect GPU
GPU_INFO="CPU-only"
if command -v nvidia-smi &> /dev/null; then
    GPU_INFO=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
    echo "✓ GPU detected: $GPU_INFO"
else
    echo "ℹ️  No GPU detected, will use CPU mode"
fi

# Detect if host network mode is available
if [ "$NETWORK_MODE" = "host" ]; then
    if [ "$OS" = "Darwin" ] || [ "$OS" = "Windows" ]; then
        echo "⚠️  --network host not supported on $OS, using bridge network"
        NETWORK_MODE="bridge"
        
        # Extract host from ROUTER_URL and suggest using host.docker.internal
        if [[ "$ROUTER_URL" == "ws://localhost"* ]]; then
            ROUTER_URL="${ROUTER_URL/localhost/host.docker.internal}"
            echo "⚠️  Updated ROUTER_URL to: $ROUTER_URL"
        fi
    fi
fi

# Generate node wallet if not provided
if [ -z "$NODE_WALLET" ]; then
    NODE_WALLET="0x$(openssl rand -hex 20 2>/dev/null || cat /dev/urandom | head -c 40 | xxd -p | head -c 40)"
    echo "⚠️  Generated wallet: $NODE_WALLET"
    echo "⚠️  Set NODE_WALLET env var to use your own wallet for earnings"
fi

# Create node config
NODE_ID="node-$(openssl rand -hex 8 2>/dev/null || cat /dev/urandom | head -c 16 | xxd -p | head -c 16)"

echo ""
echo "📋 Configuration:"
echo "  Node ID:    $NODE_ID"
echo "  Wallet:     $NODE_WALLET"
echo "  Router:     $ROUTER_URL"
echo "  Model:      $MODEL_PROFILE"
echo "  Hardware:   $GPU_INFO"
echo "  Network:    $NETWORK_MODE"
echo "  Image:      $IMAGE"

# Pull image
echo ""
echo "📥 Pulling node agent image..."
docker pull "$IMAGE" || {
    echo "⚠️  Could not pull $IMAGE"
    echo "Falling back to building locally..."
    IMAGE="synapse-node-agent:latest"
}

# Run container
echo ""
echo "🚀 Starting node agent..."

CONTAINER_NAME="synapse-node-$NODE_ID"

# Stop existing container if exists
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Build run command
DOCKER_ARGS=(
    -d
    --name "$CONTAINER_NAME"
    --restart unless-stopped
    -e "ROUTER_URL=$ROUTER_URL"
    -e "NODE_WALLET=$NODE_WALLET"
    -e "NODE_ID=$NODE_ID"
    -e "MODEL_PROFILE=$MODEL_PROFILE"
    -e "HARDWARE=$GPU_INFO"
)

# Add network mode
if [ "$NETWORK_MODE" = "host" ]; then
    DOCKER_ARGS+=(--network host)
else
    DOCKER_ARGS+=(--network bridge)
    # Add port mapping if needed for metrics later
fi

# Add GPU support if available
if [ "$GPU_INFO" != "CPU-only" ]; then
    DOCKER_ARGS+=(--gpus all)
fi

# Run
docker run "${DOCKER_ARGS[@]}" "$IMAGE"

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Failed to start node. Common issues:"
    echo "  - Image not found: Set SYNAPSE_IMAGE env var or build locally"
    echo "  - Network issue: Check ROUTER_URL is accessible"
    echo "  - Permission issue: Ensure user is in docker group"
    exit 1
fi

# Verify node connected
echo ""
echo "⏳ Waiting for node to connect to router..."
sleep 3

ROUTER_HOST=$(echo "$ROUTER_URL" | sed -E 's/ws:\/\/([^:]+).*/\1/')
ROUTER_PORT=$(echo "$ROUTER_URL" | sed -E 's/.*:([0-9]+).*/\1/')

# Try to check router stats
if command -v curl &> /dev/null; then
    ROUTER_HTTP="http://${ROUTER_HOST}:${ROUTER_PORT:-3002}"
    if curl -s "${ROUTER_HTTP}/stats" | grep -q "$NODE_ID"; then
        echo "✅ Node connected successfully!"
    else
        echo "⚠️  Node started but not yet visible in router (may need a few more seconds)"
    fi
fi

echo ""
echo "✅ Node is running!"
echo ""
echo "Node Details:"
echo "  ID:           $NODE_ID"
echo "  Container:    $CONTAINER_NAME"
echo "  Router:       ${ROUTER_HOST}:${ROUTER_PORT:-3002}"
echo "  Logs:         docker logs -f $CONTAINER_NAME"
echo "  Stop:         docker stop $CONTAINER_NAME"
echo "  Remove:       docker rm -f $CONTAINER_NAME"
echo ""
echo "The node will automatically connect to the router and start accepting jobs."
echo "Earnings will be tracked and can be viewed in the router stats."
echo ""
echo "To verify connection: curl http://${ROUTER_HOST}:${ROUTER_PORT:-3002}/stats"
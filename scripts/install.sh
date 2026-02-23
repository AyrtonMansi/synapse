#!/bin/bash
set -e

echo "🔧 Synapse Node Installer"
echo "========================="

# Configuration
NODE_WALLET="${NODE_WALLET:-}"
ROUTER_URL="${ROUTER_URL:-ws://localhost:3002/ws}"
MODEL_PROFILE="${MODEL_PROFILE:-echo-stub}"
IMAGE="${SYNAPSE_IMAGE:-ghcr.io/ayrtonmansi/synapse-node-agent:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-synapse-node}"

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
        echo "❌ macOS detected. Install Docker Desktop: https://docs.docker.com/desktop/install/mac-install/"
        exit 1
    else
        echo "❌ Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
fi

echo "✓ Docker found"

# Check Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Start Docker and retry."
    exit 1
fi

# Detect GPU
GPU_INFO="CPU-only"
if command -v nvidia-smi &> /dev/null 2>&1; then
    GPU_INFO=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || echo "GPU")
    echo "✓ GPU: $GPU_INFO"
fi

# Generate wallet if not provided
if [ -z "$NODE_WALLET" ]; then
    NODE_WALLET="0x$(cat /dev/urandom | head -c 20 | xxd -p -u 2>/dev/null || openssl rand -hex 20 2>/dev/null || date +%s%N | sha256sum | head -c 40)"
    echo "⚠️  Generated wallet: $NODE_WALLET"
    echo "⚠️  Set NODE_WALLET to use your own wallet"
fi

# Generate node ID
NODE_ID="node-$(date +%s | sha256sum | head -c 8)"

# Determine network mode
DOCKER_NETWORK=""
if [ "$OS" = "Linux" ]; then
    # Linux can use host networking
    DOCKER_NETWORK="--network host"
    echo "✓ Using host networking (Linux)"
else
    # macOS/Windows need bridge + explicit port mapping
    DOCKER_NETWORK="--network bridge -p 8080:8080"
    echo "⚠️  Using bridge networking ($OS)"
    
    # Convert localhost to host.docker.internal for cross-platform
    if [[ "$ROUTER_URL" == *"localhost"* ]] || [[ "$ROUTER_URL" == *"127.0.0.1"* ]]; then
        ROUTER_URL="${ROUTER_URL/localhost/host.docker.internal}"
        ROUTER_URL="${ROUTER_URL/127.0.0.1/host.docker.internal}"
        echo "⚠️  Updated ROUTER_URL: $ROUTER_URL"
    fi
fi

echo ""
echo "📋 Configuration:"
echo "  Node ID:    $NODE_ID"
echo "  Wallet:     ${NODE_WALLET:0:20}..."
echo "  Router:     $ROUTER_URL"
echo "  Model:      $MODEL_PROFILE"
echo "  Image:      $IMAGE"

# Pull image
echo ""
echo "📥 Pulling image..."
if ! docker pull "$IMAGE" 2>&1; then
    echo "⚠️  Could not pull $IMAGE"
    echo "Trying to build locally..."
    IMAGE="synapse-node-agent:latest"
fi

# Stop existing container
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Run container
echo ""
echo "🚀 Starting node..."

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

# Add network args
if [ "$OS" = "Linux" ]; then
    DOCKER_ARGS+=(--network host)
else
    DOCKER_ARGS+=(--network bridge)
fi

# Add GPU if available
if [ "$GPU_INFO" != "CPU-only" ]; then
    DOCKER_ARGS+=(--gpus all)
fi

if ! docker run "${DOCKER_ARGS[@]}" "$IMAGE"; then
    echo ""
    echo "❌ Failed to start node"
    echo "Common issues:"
    echo "  - Image not found: Check SYNAPSE_IMAGE or build locally"
    echo "  - Network issue: Verify ROUTER_URL is accessible"
    exit 1
fi

echo ""
echo "⏳ Waiting for node to connect (max 30s)..."
sleep 3

# Extract HTTP router URL for verification
ROUTER_HTTP="${ROUTER_URL/ws:\/\//http://}"
ROUTER_HTTP="${ROUTER_HTTP/\/ws/}"

# Try to verify connection
for i in $(seq 1 30); do
    if curl -s "$ROUTER_HTTP/stats" 2>/dev/null | grep -q "$NODE_ID" 2>/dev/null; then
        echo ""
        echo "✅ Node connected successfully!"
        echo ""
        echo "Node Details:"
        echo "  ID:        $NODE_ID"
        echo "  Container: $CONTAINER_NAME"
        echo "  Router:    $ROUTER_HTTP"
        echo "  Logs:      docker logs -f $CONTAINER_NAME"
        echo ""
        echo "Verify: curl $ROUTER_HTTP/stats | grep $NODE_ID"
        exit 0
    fi
    sleep 1
done

echo ""
echo "⚠️  Node started but not yet visible in router"
echo "Check logs: docker logs -f $CONTAINER_NAME"
echo "Verify:     curl $ROUTER_HTTP/stats"
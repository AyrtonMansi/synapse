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
echo "Image: $IMAGE"

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first:"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Start Docker and retry."
    exit 1
fi

echo "✓ Docker found"

# Detect GPU
GPU_INFO="CPU-only"
if command -v nvidia-smi &> /dev/null 2>&1; then
    GPU_INFO=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || echo "GPU")
    echo "✓ GPU detected: $GPU_INFO"
fi

# Generate wallet if not provided
if [ -z "$NODE_WALLET" ]; then
    NODE_WALLET="0x$(openssl rand -hex 20 2>/dev/null || date +%s%N | sha256sum | head -c 40)"
    echo "⚠️  Generated wallet: ${NODE_WALLET:0:30}..."
    echo "⚠️  Set NODE_WALLET env var to use your own wallet"
fi

# Generate node ID
NODE_ID="node-$(openssl rand -hex 4 2>/dev/null || date +%s | sha256sum | head -c 8)"

# Determine network configuration
DOCKER_ARGS=()
if [ "$OS" = "Linux" ]; then
    # Linux can use host networking for better performance
    DOCKER_ARGS+=(--network host)
    echo "✓ Using host networking (Linux)"
else
    # macOS/Windows need bridge + explicit port mapping
    DOCKER_ARGS+=(--network bridge -p 8080:8080)
    echo "⚠️  Using bridge networking ($OS)"

    # Convert localhost to host.docker.internal for cross-platform
    if [[ "$ROUTER_URL" == *"localhost"* ]] || [[ "$ROUTER_URL" == *"127.0.0.1"* ]]; then
        ROUTER_URL="${ROUTER_URL/localhost/host.docker.internal}"
        ROUTER_URL="${ROUTER_URL/127.0.0.1/host.docker.internal}"
        echo "⚠️  Updated ROUTER_URL for Docker Desktop: $ROUTER_URL"
    fi
fi

# Add GPU support if available
if [ "$GPU_INFO" != "CPU-only" ] && [ "$MODEL_PROFILE" = "vllm" ]; then
    DOCKER_ARGS+=(--gpus all)
    echo "✓ GPU support enabled"
fi

echo ""
echo "📋 Configuration:"
echo "  Node ID:    $NODE_ID"
echo "  Wallet:     ${NODE_WALLET:0:20}..."
echo "  Router:     $ROUTER_URL"
echo "  Model:      $MODEL_PROFILE"
echo "  Hardware:   $GPU_INFO"

# Pull image
echo ""
echo "📥 Pulling image..."
if ! docker pull "$IMAGE" 2>&1; then
    echo "⚠️  Could not pull $IMAGE"
    echo "Falling back to building locally..."
    IMAGE="synapse-node-agent:latest"
    docker build -t "$IMAGE" -f - . << 'EOF'
FROM node:20-alpine
WORKDIR /app
COPY services/node-agent/package*.json ./
RUN npm install
COPY services/node-agent/ ./
RUN npm run build
CMD ["npm", "start"]
EOF
fi

# Stop existing container
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Run container
echo ""
echo "🚀 Starting node..."

RUN_ARGS=(
    -d
    --name "$CONTAINER_NAME"
    --restart unless-stopped
    -e "ROUTER_URL=$ROUTER_URL"
    -e "NODE_WALLET=$NODE_WALLET"
    -e "NODE_ID=$NODE_ID"
    -e "MODEL_PROFILE=$MODEL_PROFILE"
    -e "HARDWARE=$GPU_INFO"
    "${DOCKER_ARGS[@]}"
)

if ! docker run "${RUN_ARGS[@]}" "$IMAGE"; then
    echo ""
    echo "❌ Failed to start node"
    echo "Common issues:"
    echo "  - Image not found: Check SYNAPSE_IMAGE or build locally"
    echo "  - Network issue: Verify ROUTER_URL is accessible from Docker"
    exit 1
fi

echo ""
echo "⏳ Waiting for node to connect (max 30s)..."

# Extract HTTP router URL for verification
ROUTER_HTTP="${ROUTER_URL/ws:\/\//http://}"
ROUTER_HTTP="${ROUTER_HTTP/\/ws/}"

if [[ "$ROUTER_HTTP" == *"host.docker.internal"* ]]; then
    ROUTER_HTTP="http://localhost:3002"
fi

# Try to verify connection
FOUND=0
for i in $(seq 1 30); do
    sleep 1
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
        FOUND=1
        break
    fi
    if [ $((i % 5)) -eq 0 ]; then
        echo "   ... ${i}s elapsed"
    fi
done

if [ "$FOUND" -eq 0 ]; then
    echo ""
    echo "⚠️  Node started but not yet visible in router"
    echo "Check logs: docker logs -f $CONTAINER_NAME"
    echo "Verify:     curl $ROUTER_HTTP/stats"
    exit 1
fi

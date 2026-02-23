#!/bin/bash
set -e

echo "🧪 Install Smoke Test"
echo "====================="

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

ROUTER_URL="${ROUTER_URL:-http://localhost:3002}"
INSTALL_SCRIPT="${INSTALL_SCRIPT:-./scripts/install.sh}"
TEMP_DIR=$(mktemp -d)
NODE_WALLET="0x$(date +%s | sha256sum | head -c 40)"

cleanup() {
    echo ""
    echo "Cleaning up..."
    docker stop synapse-node-test 2>/dev/null || true
    docker rm synapse-node-test 2>/dev/null || true
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo ""
echo "1) Checking router..."
if ! curl -s "$ROUTER_URL/health" | grep -q "ok"; then
    echo "${RED}✗${NC} Router not accessible at $ROUTER_URL"
    exit 1
fi
echo "${GREEN}✓${NC} Router healthy"

# Get baseline
echo ""
echo "2) Getting baseline node count..."
BASELINE_NODES=$(curl -s "$ROUTER_URL/stats" | grep -o '"nodes":[0-9]*' | cut -d':' -f2 || echo "0")
echo "   Current nodes: $BASELINE_NODES"

# Run install
echo ""
echo "3) Running install script..."
cd "$TEMP_DIR"
CONTAINER_NAME=synapse-node-test NODE_WALLET="$NODE_WALLET" "$INSTALL_SCRIPT" || {
    echo "${RED}✗${NC} Install script failed"
    exit 1
}

# Wait for node to appear
echo ""
echo "4) Waiting for node to register (max 30s)..."
FOUND=0
for i in $(seq 1 30); do
    sleep 1
    CURRENT=$(curl -s "$ROUTER_URL/stats" | grep -o '"nodes":[0-9]*' | cut -d':' -f2 || echo "0")
    
    if [ "$CURRENT" -gt "$BASELINE_NODES" ]; then
        echo "${GREEN}✓${NC} Node registered after ${i}s (nodes: $BASELINE_NODES → $CURRENT)"
        FOUND=1
        break
    fi
    
    if [ $((i % 5)) -eq 0 ]; then
        echo "   ... ${i}s elapsed"
    fi
done

if [ "$FOUND" -eq 0 ]; then
    echo "${RED}✗${NC} Node did not appear within 30s"
    echo ""
    echo "Debug info:"
    curl -s "$ROUTER_URL/stats" | head -20
    echo ""
    docker logs synapse-node-test 2>&1 | tail -20
    exit 1
fi

# Verify node details
echo ""
echo "5) Verifying node details..."
STATS=$(curl -s "$ROUTER_URL/stats")
if echo "$STATS" | grep -q "$NODE_WALLET"; then
    echo "${GREEN}✓${NC} Node wallet visible in stats"
else
    echo "${YELLOW}⚠${NC} Wallet not visible (may be masked)"
fi

echo ""
echo "====================="
echo "${GREEN}✅ INSTALL TEST PASSED${NC}"
echo ""
echo "The installer works correctly."
echo "Node successfully registered with router at $ROUTER_URL"
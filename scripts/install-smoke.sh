#!/bin/bash
set -e

echo "🧪 Node Install Smoke Test"
echo "=========================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Config
ROUTER_URL="${ROUTER_URL:-http://localhost:3002}"
INSTALL_SCRIPT="${INSTALL_SCRIPT:-./scripts/install.sh}"
MAX_WAIT=30

# Check router is running
echo ""
echo "1) Checking router is accessible..."
if ! curl -s "${ROUTER_URL}/health" | grep -q "ok"; then
    echo "${RED}✗${NC} Router not accessible at ${ROUTER_URL}"
    echo "Start the stack first: docker compose up -d"
    exit 1
fi
echo "${GREEN}✓${NC} Router is healthy"

# Get initial node count
echo ""
echo "2) Getting baseline node count..."
INITIAL_NODES=$(curl -s "${ROUTER_URL}/stats" | grep -o '"nodes":[0-9]*' | cut -d':' -f2 || echo "0")
echo "Initial nodes: $INITIAL_NODES"

# Run install script
echo ""
echo "3) Running install script..."
NODE_WALLET="0x$(openssl rand -hex 20)" "$INSTALL_SCRIPT" || {
    echo "${RED}✗${NC} Install script failed"
    exit 1
}

# Wait for node to appear
echo ""
echo "4) Waiting for node to appear in router (max ${MAX_WAIT}s)..."

FOUND=0
for i in $(seq 1 $MAX_WAIT); do
    sleep 1
    
    CURRENT_NODES=$(curl -s "${ROUTER_URL}/stats" | grep -o '"nodes":[0-9]*' | cut -d':' -f2 || echo "0")
    
    if [ "$CURRENT_NODES" -gt "$INITIAL_NODES" ]; then
        echo "${GREEN}✓${NC} Node appeared after ${i}s"
        echo "  Nodes: $INITIAL_NODES -> $CURRENT_NODES"
        FOUND=1
        break
    fi
    
    if [ $((i % 5)) -eq 0 ]; then
        echo "  ... ${i}s elapsed, still waiting"
    fi
done

if [ "$FOUND" -eq 0 ]; then
    echo ""
    echo "${RED}✗${NC} Node did not appear in router within ${MAX_WAIT}s"
    echo ""
    echo "Debug info:"
    echo "Router stats:"
    curl -s "${ROUTER_URL}/stats" | head -20
    echo ""
    echo "Recent containers:"
    docker ps -a --filter "name=synapse-node-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    exit 1
fi

# Verify node details
echo ""
echo "5) Verifying node details..."
ROUTER_STATS=$(curl -s "${ROUTER_URL}/stats")

if echo "$ROUTER_STATS" | grep -q "node"; then
    echo "${GREEN}✓${NC} Node details visible in router"
else
    echo "${YELLOW}⚠${NC} Node count increased but details not visible"
fi

# Cleanup test node
echo ""
echo "6) Cleaning up test node..."
TEST_CONTAINER=$(docker ps -q --filter "name=synapse-node-" --filter "label=smoke-test=true" 2>/dev/null | head -1)
if [ -n "$TEST_CONTAINER" ]; then
    docker stop "$TEST_CONTAINER" >/dev/null 2>&1 || true
    docker rm "$TEST_CONTAINER" >/dev/null 2>&1 || true
    echo "${GREEN}✓${NC} Test node cleaned up"
fi

echo ""
echo "=========================="
echo "${GREEN}✅ ALL TESTS PASSED${NC}"
echo ""
echo "Node installer is working correctly."
echo "Router at ${ROUTER_URL} is accepting connections."
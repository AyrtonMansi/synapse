#!/bin/bash
set -e

echo "🧪 Synapse Smoke Test"
echo "====================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_URL="http://localhost:3001"
ROUTER_URL="http://localhost:3002"

echo ""
echo "1) Starting services..."
docker compose up -d --build

echo ""
echo "2) Waiting for services to be ready..."
sleep 10

echo ""
echo "3) Testing health endpoints..."

# Test gateway health
if curl -s ${API_URL}/health | grep -q "ok"; then
    echo "${GREEN}✓${NC} Gateway API is healthy"
else
    echo "${RED}✗${NC} Gateway API health check failed"
    exit 1
fi

# Test router health
if curl -s ${ROUTER_URL}/health | grep -q "ok"; then
    echo "${GREEN}✓${NC} Router is healthy"
else
    echo "${RED}✗${NC} Router health check failed"
    exit 1
fi

echo ""
echo "4) Testing /v1/models endpoint..."
MODELS=$(curl -s ${API_URL}/v1/models)
if echo "$MODELS" | grep -q "deepseek-v3"; then
    echo "${GREEN}✓${NC} Models endpoint returns deepseek-v3"
else
    echo "${RED}✗${NC} Models endpoint failed"
    exit 1
fi

echo ""
echo "5) Generating API key..."
API_RESPONSE=$(curl -s -X POST ${API_URL}/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}')

API_KEY=$(echo "$API_RESPONSE" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)

if [ -n "$API_KEY" ]; then
    echo "${GREEN}✓${NC} API key generated: ${API_KEY:0:20}..."
else
    echo "${RED}✗${NC} API key generation failed"
    exit 1
fi

echo ""
echo "6) Testing /v1/chat/completions..."
COMPLETION=$(curl -s -X POST ${API_URL}/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v3",
    "messages": [{"role": "user", "content": "Hello"}]
  }')

if echo "$COMPLETION" | grep -q "choices"; then
    echo "${GREEN}✓${NC} Chat completion successful"
    echo "   Response: $(echo "$COMPLETION" | grep -o '"content":"[^"]*"' | head -1 | cut -d'"' -f4 | cut -c1-50)..."
else
    echo "${RED}✗${NC} Chat completion failed"
    echo "   Response: $COMPLETION"
    exit 1
fi

echo ""
echo "7) Checking usage events in database..."
USAGE_STATS=$(curl -s ${API_URL}/usage \
  -H "Authorization: Bearer $API_KEY")

if echo "$USAGE_STATS" | grep -q "stats"; then
    echo "${GREEN}✓${NC} Usage tracking is working"
else
    echo "${RED}✗${NC} Usage tracking failed"
    exit 1
fi

echo ""
echo "8) Checking router node registry..."
ROUTER_STATS=$(curl -s ${ROUTER_URL}/stats)
if echo "$ROUTER_STATS" | grep -q "nodes"; then
    NODES=$(echo "$ROUTER_STATS" | grep -o '"nodes":[0-9]*' | cut -d':' -f2)
    echo "${GREEN}✓${NC} Router has $NODES node(s) registered"
else
    echo "${RED}✗${NC} Router stats failed"
    exit 1
fi

echo ""
echo "====================="
echo "${GREEN}✅ ALL TESTS PASSED${NC}"
echo ""
echo "Synapse MVP is running:"
echo "  - Gateway API: http://localhost:3001"
echo "  - Router:      http://localhost:3002"
echo "  - Web UI:      http://localhost:3000"
echo ""
echo "To stop: docker compose down"
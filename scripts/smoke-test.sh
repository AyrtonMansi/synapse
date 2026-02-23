#!/bin/bash
set -e

echo "🧪 Synapse Smoke Test (Enhanced)"
echo "================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="http://localhost:3001"
ROUTER_URL="http://localhost:3002"
FAILED=0

check_result() {
  if [ $? -eq 0 ]; then
    echo "${GREEN}✓${NC} $1"
  else
    echo "${RED}✗${NC} $1"
    FAILED=1
  fi
}

echo ""
echo "1) Starting services..."
docker compose up -d --build 2>&1 | tail -5

echo ""
echo "2) Waiting for services (15s)..."
sleep 15

echo ""
echo "3) Testing health endpoints..."

# Test gateway health
curl -s ${API_URL}/health | grep -q "ok"
check_result "Gateway API healthy"

# Test router health  
curl -s ${ROUTER_URL}/health | grep -q "ok"
check_result "Router healthy"

echo ""
echo "4) Testing /v1/models endpoint..."
MODELS=$(curl -s ${API_URL}/v1/models)
echo "$MODELS" | grep -q "deepseek-v3"
check_result "Models include deepseek-v3"

echo ""
echo "5) Testing GET /stats on gateway..."
STATS=$(curl -s ${API_URL}/stats)
echo "$STATS" | grep -q '"nodes":'
check_result "Stats returns nodes field"
echo "$STATS" | grep -q '"jobs_today":'
check_result "Stats returns jobs_today field"
echo "$STATS" | grep -q '"total_jobs":'
check_result "Stats returns total_jobs field"

echo ""
echo "6) Generating API key (email)..."
EMAIL_RESPONSE=$(curl -s -X POST ${API_URL}/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}')

EMAIL_API_KEY=$(echo "$EMAIL_RESPONSE" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
if [ -n "$EMAIL_API_KEY" ]; then
  echo "${GREEN}✓${NC} API key generated with email: ${EMAIL_API_KEY:0:20}..."
else
  echo "${RED}✗${NC} API key generation with email failed"
  FAILED=1
fi

echo ""
echo "7) Generating API key (wallet)..."
WALLET_RESPONSE=$(curl -s -X POST ${API_URL}/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0x1234567890123456789012345678901234567890"}')

WALLET_API_KEY=$(echo "$WALLET_RESPONSE" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
if [ -n "$WALLET_API_KEY" ]; then
  echo "${GREEN}✓${NC} API key generated with wallet: ${WALLET_API_KEY:0:20}..."
else
  echo "${RED}✗${NC} API key generation with wallet failed"
  FAILED=1
fi

echo ""
echo "8) Testing /v1/chat/completions (single)..."
COMPLETION=$(curl -s -X POST ${API_URL}/v1/chat/completions \
  -H "Authorization: Bearer $EMAIL_API_KEY" \
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
  FAILED=1
fi

echo ""
echo "9) Parallel load test (10 concurrent requests)..."

# Create temp files for results
TEMP_DIR=$(mktemp -d)
for i in $(seq 1 10); do
  (
    curl -s -X POST ${API_URL}/v1/chat/completions \
      -H "Authorization: Bearer $EMAIL_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"model": "deepseek-v3", "messages": [{"role": "user", "content": "Test '$i'"}]}' \
      > "$TEMP_DIR/result_$i.txt"
  ) &
done

# Wait for all
wait

# Count successes
SUCCESS_COUNT=0
for i in $(seq 1 10); do
  if grep -q "choices" "$TEMP_DIR/result_$i.txt" 2>/dev/null; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  fi
done

rm -rf "$TEMP_DIR"

echo "   Successful: $SUCCESS_COUNT/10"
if [ "$SUCCESS_COUNT" -ge 9 ]; then
  echo "${GREEN}✓${NC} Parallel test passed (>=9/10 succeeded)"
else
  echo "${RED}✗${NC} Parallel test failed (<9/10 succeeded)"
  FAILED=1
fi

echo ""
echo "10) Verifying usage stats reflect requests..."
sleep 2

USAGE_STATS=$(curl -s ${API_URL}/stats)
TOTAL_JOBS=$(echo "$USAGE_STATS" | grep -o '"total_jobs":[0-9]*' | cut -d':' -f2)

if [ -n "$TOTAL_JOBS" ] && [ "$TOTAL_JOBS" -ge 11 ]; then
  echo "${GREEN}✓${NC} Usage stats updated: $TOTAL_JOBS total jobs"
else
  echo "${YELLOW}⚠${NC} Usage stats may be delayed (expected >=11, got ${TOTAL_JOBS:-0})"
fi

echo ""
echo "11) Checking router node registry..."
ROUTER_STATS=$(curl -s ${ROUTER_URL}/stats)
if echo "$ROUTER_STATS" | grep -q "successRate"; then
  echo "${GREEN}✓${NC} Router stats include successRate"
else
  echo "${YELLOW}⚠${NC} Router stats missing successRate"
fi

if echo "$ROUTER_STATS" | grep -q "avgLatencyMs"; then
  echo "${GREEN}✓${NC} Router stats include avgLatencyMs"
else
  echo "${YELLOW}⚠${NC} Router stats missing avgLatencyMs"
fi

echo ""
echo "================================="
if [ "$FAILED" -eq 0 ]; then
  echo "${GREEN}✅ ALL TESTS PASSED${NC}"
  echo ""
  echo "Synapse MVP is running correctly:"
  echo "  - Gateway API: http://localhost:3001"
  echo "  - Router:      http://localhost:3002"
  echo "  - Web UI:      http://localhost:3000"
  echo ""
  echo "To stop: docker compose down"
  exit 0
else
  echo "${RED}❌ SOME TESTS FAILED${NC}"
  echo "Check logs: docker compose logs"
  exit 1
fi
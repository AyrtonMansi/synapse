#!/bin/bash
set -e

echo "🧪 Synapse Smoke Test (Extended)"
echo "================================="

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="http://localhost:3001"
ROUTER_URL="http://localhost:3002"
FAILED=0

check_result() {
  if [ $1 -eq 0 ]; then
    echo "${GREEN}✓${NC} $2"
  else
    echo "${RED}✗${NC} $2"
    FAILED=1
  fi
}

echo ""
echo "1) Starting services..."
docker compose up -d --build 2>&1 | tail -3
check_result $? "Services started"

echo ""
echo "2) Waiting for services (15s)..."
sleep 15

echo ""
echo "3) Testing /stats endpoint..."
STATS=$(curl -s ${API_URL}/stats)

echo "$STATS" | grep -q '"nodes_online":' 
check_result $? "stats has nodes_online"

echo "$STATS" | grep -q '"jobs_today":' 
check_result $? "stats has jobs_today"

echo "$STATS" | grep -q '"jobs_total":' 
check_result $? "stats has jobs_total"

echo "$STATS" | grep -q '"avg_latency_ms":' 
check_result $? "stats has avg_latency_ms"

echo "$STATS" | grep -q '"tokens_today":' 
check_result $? "stats has tokens_today"

echo "$STATS" | grep -q '"tokens_total":' 
check_result $? "stats has tokens_total"

echo "$STATS" | grep -q '"updated_at":' 
check_result $? "stats has updated_at"

# Verify nodes_online >= 1 (stub node should be running)
NODES_ONLINE=$(echo "$STATS" | grep -o '"nodes_online":[0-9]*' | cut -d':' -f2)
if [ "$NODES_ONLINE" -ge 1 ]; then
  check_result 0 "nodes_online >= 1 (got $NODES_ONLINE)"
else
  check_result 1 "nodes_online >= 1 (got $NODES_ONLINE)"
fi

echo ""
echo "4) Testing health endpoints..."
curl -s ${API_URL}/health | grep -q "ok"
check_result $? "Gateway API healthy"

curl -s ${ROUTER_URL}/health | grep -q "ok"
check_result $? "Router healthy"

echo ""
echo "5) Testing /v1/models..."
MODELS=$(curl -s ${API_URL}/v1/models)
echo "$MODELS" | grep -q "deepseek-v3"
check_result $? "Models include deepseek-v3"

echo ""
echo "6) Generating API key (email)..."
EMAIL_RESPONSE=$(curl -s -X POST ${API_URL}/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}')
EMAIL_KEY=$(echo "$EMAIL_RESPONSE" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
[ -n "$EMAIL_KEY" ]
check_result $? "API key generated with email"

echo ""
echo "7) Generating API key (wallet)..."
WALLET_RESPONSE=$(curl -s -X POST ${API_URL}/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0x1234567890123456789012345678901234567890"}')
WALLET_KEY=$(echo "$WALLET_RESPONSE" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
[ -n "$WALLET_KEY" ]
check_result $? "API key generated with wallet"

echo ""
echo "8) Single chat completion..."
COMPLETION=$(curl -s -X POST ${API_URL}/v1/chat/completions \
  -H "Authorization: Bearer $EMAIL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-v3", "messages": [{"role": "user", "content": "Hello"}]}')
echo "$COMPLETION" | grep -q "choices"
check_result $? "Single completion successful"

echo ""
echo "9) Parallel load test (10 concurrent)..."
TEMP_DIR=$(mktemp -d)
for i in $(seq 1 10); do
  (
    curl -s -X POST ${API_URL}/v1/chat/completions \
      -H "Authorization: Bearer $EMAIL_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"model\": \"deepseek-v3\", \"messages\": [{\"role\": \"user\", \"content\": \"Test $i\"}]}" \
      > "$TEMP_DIR/result_$i.txt"
  ) &
done
wait

SUCCESS_COUNT=0
for i in $(seq 1 10); do
  if grep -q "choices" "$TEMP_DIR/result_$i.txt" 2>/dev/null; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  fi
done
rm -rf "$TEMP_DIR"

echo "   Success: $SUCCESS_COUNT/10"
if [ "$SUCCESS_COUNT" -ge 9 ]; then
  check_result 0 "Parallel test >=9/10 succeeded"
else
  check_result 1 "Parallel test >=9/10 succeeded"
fi

echo ""
echo "10) Verifying jobs_today incremented..."
sleep 2
NEW_STATS=$(curl -s ${API_URL}/stats)
JOBS_TODAY=$(echo "$NEW_STATS" | grep -o '"jobs_today":[0-9]*' | cut -d':' -f2)
if [ "$JOBS_TODAY" -ge 11 ]; then
  check_result 0 "jobs_today incremented (got $JOBS_TODAY)"
else
  check_result 1 "jobs_today incremented (expected >=11, got $JOBS_TODAY)"
fi

echo ""
echo "11) Verifying nodes_online >= 1..."
NODES_CHECK=$(echo "$NEW_STATS" | grep -o '"nodes_online":[0-9]*' | cut -d':' -f2)
if [ "$NODES_CHECK" -ge 1 ]; then
  check_result 0 "nodes_online >= 1 (got $NODES_CHECK)"
else
  check_result 1 "nodes_online >= 1 (got $NODES_CHECK)"
fi

echo ""
echo "================================="
if [ "$FAILED" -eq 0 ]; then
  echo "${GREEN}✅ ALL TESTS PASSED${NC}"
  echo ""
  echo "Synapse MVP is running:"
  echo "  - Gateway: http://localhost:3001"
  echo "  - Router:  http://localhost:3002"
  echo "  - Web UI:  http://localhost:3000"
  exit 0
else
  echo "${RED}❌ SOME TESTS FAILED${NC}"
  echo "Logs: docker compose logs"
  exit 1
fi
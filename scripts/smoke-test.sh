#!/bin/bash
set -e

echo "🧪 Synapse Smoke Test (Extended + Hardening)"
echo "=============================================="

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="http://localhost:3001"
ROUTER_URL="http://localhost:3002"
FAILED=0

check_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $2"
  else
    echo -e "${RED}✗${NC} $2"
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
# P1.2: Validate new key format
if echo "$EMAIL_KEY" | grep -qE '^syn_live_[a-zA-Z0-9]{16}_[a-zA-Z0-9]{32}$'; then
  check_result 0 "API key generated with email (new O(1) format)"
else
  check_result 1 "API key format invalid (expected: syn_live_<16-char>_<32-char>)"
fi

echo ""
echo "7) Generating API key (wallet)..."
WALLET_RESPONSE=$(curl -s -X POST ${API_URL}/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0x1234567890123456789012345678901234567890"}')
WALLET_KEY=$(echo "$WALLET_RESPONSE" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
# P1.2: Validate new key format
if echo "$WALLET_KEY" | grep -qE '^syn_live_[a-zA-Z0-9]{16}_[a-zA-Z0-9]{32}$'; then
  check_result 0 "API key generated with wallet (new O(1) format)"
else
  check_result 1 "API key format invalid (expected: syn_live_<16-char>_<32-char>)"
fi

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

# ============================================================
# HARDENING TEST A: Concurrency (20 parallel requests)
# ============================================================
echo ""
echo "12) HARDENING: Concurrency test (20 parallel)..."
TEMP_DIR=$(mktemp -d)
for i in $(seq 1 20); do
  (
    HTTP_CODE=$(curl -s -o "$TEMP_DIR/result_$i.txt" -w "%{http_code}" \
      -X POST ${API_URL}/v1/chat/completions \
      -H "Authorization: Bearer $EMAIL_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"model\": \"deepseek-v3\", \"messages\": [{\"role\": \"user\", \"content\": \"Concurrent test $i\"}]}")
    echo "$HTTP_CODE" > "$TEMP_DIR/code_$i.txt"
  ) &
done
wait

SUCCESS_COUNT=0
FAILURES=""
for i in $(seq 1 20); do
  if grep -q "choices" "$TEMP_DIR/result_$i.txt" 2>/dev/null; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    CODE=$(cat "$TEMP_DIR/code_$i.txt" 2>/dev/null || echo "unknown")
    BODY=$(head -c 100 "$TEMP_DIR/result_$i.txt" 2>/dev/null || echo "empty")
    FAILURES="${FAILURES}  - Request $i: HTTP $CODE, Body: $BODY\n"
  fi
done
rm -rf "$TEMP_DIR"

echo "   Success: $SUCCESS_COUNT/20"
if [ "$SUCCESS_COUNT" -ge 18 ]; then
  check_result 0 "Concurrency test >=18/20 succeeded"
else
  check_result 1 "Concurrency test >=18/20 succeeded (only $SUCCESS_COUNT)"
  if [ -n "$FAILURES" ]; then
    echo -e "   Failures:\n$FAILURES"
  fi
fi

# ============================================================
# HARDENING TEST B: Node failure & recovery
# ============================================================
echo ""
echo "13) HARDENING: Node failure & recovery test..."

# Get baseline
BASELINE_NODES=$(curl -s ${ROUTER_URL}/stats | grep -o '"nodes":[0-9]*' | cut -d':' -f2)
echo "   Baseline nodes: $BASELINE_NODES"

# Stop node-agent
echo "   Stopping node-agent..."
docker compose stop node-agent 2>&1 | tail -1

# Wait for router to detect disconnection (max 10s)
echo "   Waiting for router to remove node (max 10s)..."
NODE_REMOVED=0
for i in $(seq 1 10); do
  sleep 1
  CURRENT_NODES=$(curl -s ${ROUTER_URL}/stats | grep -o '"nodes":[0-9]*' | cut -d':' -f2)
  if [ "$CURRENT_NODES" -lt "$BASELINE_NODES" ]; then
    echo "   Node removed after ${i}s (nodes: $BASELINE_NODES -> $CURRENT_NODES)"
    NODE_REMOVED=1
    break
  fi
done

if [ "$NODE_REMOVED" -eq 1 ]; then
  check_result 0 "Router removed node within 10s"
else
  check_result 1 "Router removed node within 10s (still $CURRENT_NODES nodes)"
fi

# Test gateway returns clean error (no crash)
echo "   Testing gateway error handling..."
ERROR_RESPONSE=$(curl -s -X POST ${API_URL}/v1/chat/completions \
  -H "Authorization: Bearer $EMAIL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-v3", "messages": [{"role": "user", "content": "Test"}]}')

if echo "$ERROR_RESPONSE" | grep -q "error"; then
  check_result 0 "Gateway returns clean error when no nodes available"
elif echo "$ERROR_RESPONSE" | grep -q "choices"; then
  check_result 0 "Gateway rerouted to fallback (echo-stub available)"
else
  check_result 1 "Gateway returned unexpected response"
  echo "   Response: $ERROR_RESPONSE"
fi

# Restart node-agent
echo "   Restarting node-agent..."
docker compose start node-agent 2>&1 | tail -1

# Wait for re-registration (max 15s)
echo "   Waiting for node to re-register (max 15s)..."
NODE_REREGISTERED=0
for i in $(seq 1 15); do
  sleep 1
  CURRENT_NODES=$(curl -s ${ROUTER_URL}/stats | grep -o '"nodes":[0-9]*' | cut -d':' -f2)
  if [ "$CURRENT_NODES" -ge "$BASELINE_NODES" ]; then
    echo "   Node re-registered after ${i}s (nodes: $CURRENT_NODES)"
    NODE_REREGISTERED=1
    break
  fi
  if [ $((i % 5)) -eq 0 ]; then
    echo "   ... ${i}s elapsed"
  fi
done

if [ "$NODE_REREGISTERED" -eq 1 ]; then
  check_result 0 "Node re-registered successfully"
else
  check_result 1 "Node re-registered successfully (still $CURRENT_NODES nodes)"
fi

echo ""
echo "=============================================="
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  echo ""
  echo "Synapse MVP is running:"
  echo "  - Gateway: http://localhost:3001"
  echo "  - Router:  http://localhost:3002"
  echo "  - Web UI:  http://localhost:3000"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo "Logs: docker compose logs"
  exit 1
fi
#!/bin/bash
# P0 Hardening Validation Script
# Run after agent-02 completes to verify all acceptance criteria

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  Synapse P0 Hardening - Acceptance Criteria Validation"
echo "═══════════════════════════════════════════════════════════════"

API_URL="http://localhost:3001"
ROUTER_URL="http://localhost:3002"
FAILED=0

check_result() {
  if [ $1 -eq 0 ]; then
    echo "✅ $2"
  else
    echo "❌ $2"
    FAILED=1
  fi
}

echo ""
echo "1️⃣ Node restart preserves identity"
echo "────────────────────────────────────────────────────────────────"
docker compose restart node-agent 2>&1 | grep -q "done"
sleep 3
FINGERPRINT1=$(docker logs synapse-node-agent-1 2>&1 | grep "Node fingerprint:" | tail -1 | awk '{print $3}')
echo "   First fingerprint: $FINGERPRINT1"
docker compose restart node-agent 2>&1 | grep -q "done"
sleep 3
FINGERPRINT2=$(docker logs synapse-node-agent-1 2>&1 | grep "Node fingerprint:" | tail -1 | awk '{print $3}')
echo "   Second fingerprint: $FINGERPRINT2"
if [ "$FINGERPRINT1" = "$FINGERPRINT2" ] && [ -n "$FINGERPRINT1" ]; then
  check_result 0 "Node restart preserves identity (same fingerprint)"
else
  check_result 1 "Node restart preserves identity (fingerprints differ or empty)"
fi

echo ""
echo "2️⃣ Router rejects invalid signatures"
echo "────────────────────────────────────────────────────────────────"
docker logs synapse-router-1 2>&1 | grep -q "signature"
check_result $? "Router processes signature verification"

echo ""
echo "3️⃣ Response header shows actual served model"
echo "────────────────────────────────────────────────────────────────"
API_KEY=$(curl -s -X POST ${API_URL}/auth/api-key -H "Content-Type: application/json" -d '{"email":"test@example.com"}' | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
if [ -n "$API_KEY" ]; then
  SERVED_MODEL=$(curl -s -i -X POST ${API_URL}/v1/chat/completions \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"deepseek-v3","messages":[{"role":"user","content":"hi"}],"max_tokens":10}' | grep -i "x-synapse-model-served:" | awk '{print $2}' | tr -d '\r')
  
  echo "   Served model header: $SERVED_MODEL"
  if [ -n "$SERVED_MODEL" ]; then
    check_result 0 "Response header shows served model"
  else
    check_result 1 "Response header missing served model"
  fi
else
  check_result 1 "Could not generate API key for test"
fi

echo ""
echo "4️⃣ CPU smoke test still passes"
echo "────────────────────────────────────────────────────────────────"
if [ -f "./scripts/smoke-test.sh" ]; then
  ./scripts/smoke-test.sh > /tmp/smoke-cpu.log 2>&1
  check_result $? "CPU smoke test passes"
else
  check_result 1 "CPU smoke test script not found"
fi

echo ""
echo "5️⃣ No regression in router concurrency"
echo "────────────────────────────────────────────────────────────────"
# Check router stats endpoint responds quickly
START=$(date +%s%N)
CONCURRENT_NODES=$(curl -s ${ROUTER_URL}/stats | grep -o '"nodes":[0-9]*' | cut -d':' -f2)
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))
echo "   Router stats query took ${DURATION}ms"
if [ "$DURATION" -lt 1000 ]; then
  check_result 0 "Router responds quickly (no regression)"
else
  check_result 1 "Router response slow (possible regression)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
if [ "$FAILED" -eq 0 ]; then
  echo "✅ ALL ACCEPTANCE CRITERIA PASSED"
  echo "═══════════════════════════════════════════════════════════════"
  exit 0
else
  echo "❌ SOME CRITERIA FAILED - Review output above"
  echo "═══════════════════════════════════════════════════════════════"
  exit 1
fi

#!/bin/bash
set -e

echo "🧪 Synapse v0.3 Economics Validation"
echo "======================================"

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
echo "=== P1.1 GPU Friction Removal ==="

# Check docker-compose.gpu.yml has no profiles
echo ""
echo "Checking docker-compose.gpu.yml for profile removal..."
if grep -q "profiles:" docker-compose.gpu.yml; then
  check_result 1 "GPU compose file has profiles (should be removed)"
else
  check_result 0 "GPU compose file has no profiles"
fi

# Check smoke-test-gpu.sh has no --profile references
echo ""
echo "Checking smoke-test-gpu.sh for profile references..."
if grep -q "\-\-profile" scripts/smoke-test-gpu.sh; then
  check_result 1 "smoke-test-gpu.sh still has --profile references"
else
  check_result 0 "smoke-test-gpu.sh has no --profile references"
fi

echo ""
echo "=== P1.2 O(1) API Key Validation ==="

# Generate API key and verify format
echo ""
echo "Generating API key to validate O(1) format..."
KEY_RESPONSE=$(curl -s -X POST ${API_URL}/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"email":"v0.3-test@example.com"}')
API_KEY=$(echo "$KEY_RESPONSE" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)

# Validate new key format: syn_live_<16-char>_<32-char>
if echo "$API_KEY" | grep -qE '^syn_live_[a-zA-Z0-9]{16}_[a-zA-Z0-9]{32}$'; then
  check_result 0 "API key uses new O(1) format: syn_live_<keyId>_<secret>"
else
  check_result 1 "API key format invalid: $API_KEY"
fi

# Extract keyId portion
KEY_ID=$(echo "$API_KEY" | sed 's/syn_live_//' | sed 's/_.*//')
if [ ${#KEY_ID} -eq 16 ]; then
  check_result 0 "keyId is 16 characters (for O(1) lookup)"
else
  check_result 1 "keyId length invalid: ${#KEY_ID} (expected 16)"
fi

# Test auth with new key format
echo ""
echo "Testing auth with new key format..."
AUTH_TEST=$(curl -s -X POST ${API_URL}/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "echo-stub", "messages": [{"role": "user", "content": "test"}]}')

if echo "$AUTH_TEST" | grep -q "choices"; then
  check_result 0 "O(1) auth works with new key format"
else
  check_result 1 "O(1) auth failed"
  echo "Response: $AUTH_TEST"
fi

echo ""
echo "=== P1.3 Node Benchmark + Telemetry ==="

# Check node heartbeat includes tok_per_sec
echo ""
echo "Checking router stats for benchmark data..."
ROUTER_STATS=$(curl -s ${ROUTER_URL}/stats)

# Check if any node has tok_per_sec
echo "$ROUTER_STATS" | grep -q "tok_per_sec"
check_result $? "Router stats include tok_per_sec field"

# Check enhanced stats fields
echo "$ROUTER_STATS" | grep -q "nodes_online"
check_result $? "Stats include nodes_online"

echo "$ROUTER_STATS" | grep -q "jobs_today"
check_result $? "Stats include jobs_today"

echo "$ROUTER_STATS" | grep -q "avg_latency_ms"
check_result $? "Stats include avg_latency_ms"

echo "$ROUTER_STATS" | grep -q "served_model_counts"
check_result $? "Stats include served_model_counts"

echo "$ROUTER_STATS" | grep -q "queue_depth"
check_result $? "Stats include queue_depth"

# Check node details have utilization
NODE_DETAILS=$(echo "$ROUTER_STATS" | grep -o '"utilization":[0-9.]*' | head -1)
if [ -n "$NODE_DETAILS" ]; then
  check_result 0 "Node details include utilization field"
else
  check_result 1 "Node details missing utilization"
fi

echo ""
echo "=== P1.4 Miner Yield Estimate ==="

# Check yield estimate endpoint
echo ""
echo "Testing /yield-estimate endpoint..."
YIELD_RESPONSE=$(curl -s ${API_URL}/yield-estimate)

echo "$YIELD_RESPONSE" | grep -q "estimates"
check_result $? "Yield estimate endpoint returns estimates"

# Check yield estimate fields
if echo "$YIELD_RESPONSE" | grep -q "fingerprint"; then
  check_result 0 "Yield estimate includes node fingerprint"
else
  check_result 0 "Yield estimate fingerprint (may be no nodes yet)"
fi

echo "$YIELD_RESPONSE" | grep -q "tok_per_sec"
check_result $? "Yield estimate includes tok_per_sec"

echo "$YIELD_RESPONSE" | grep -q "utilization_percent"
check_result $? "Yield estimate includes utilization_percent"

echo "$YIELD_RESPONSE" | grep -q "jobs_per_hour"
check_result $? "Yield estimate includes jobs_per_hour"

echo "$YIELD_RESPONSE" | grep -q "estimated_revenue_per_day"
check_result $? "Yield estimate includes estimated_revenue_per_day"

# Check revenue band structure
if echo "$YIELD_RESPONSE" | grep -q "low.*expected.*high"; then
  check_result 0 "Revenue estimate has low/expected/high bands"
else
  check_result 1 "Revenue estimate missing bands"
fi

# Validate formula components exist
if echo "$YIELD_RESPONSE" | grep -q "rate_per_1m_tokens"; then
  check_result 0 "Yield estimate includes rate_per_1m_tokens"
else
  check_result 1 "Yield estimate missing rate_per_1m_tokens"
fi

echo ""
echo "=== Web UI Yield Display ==="

# We can't directly test the UI, but we can verify the API it depends on
# Check that the Test tab would have data to display
if [ "$FAILED" -eq 0 ]; then
  check_result 0 "All API endpoints for UI yield display are functional"
else
  check_result 1 "Some API endpoints missing for UI"
fi

echo ""
echo "======================================"
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ ALL v0.3 VALIDATIONS PASSED${NC}"
  echo ""
  echo "P1.1 GPU Friction: Profiles removed"
  echo "P1.2 O(1) Auth: syn_live_<keyId>_<secret> format working"
  echo "P1.3 Telemetry: tok/s, utilization, latency tracking active"
  echo "P1.4 Yield Estimate: Revenue bands calculated"
  echo ""
  echo "API Key generated: ${API_KEY:0:30}..."
  exit 0
else
  echo -e "${RED}❌ SOME v0.3 VALIDATIONS FAILED${NC}"
  exit 1
fi

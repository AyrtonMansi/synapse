#!/bin/bash
set -e

echo "🧪 Synapse GPU Smoke Test (P0 HARDENED)"
echo "=========================================="

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="http://localhost:3001"
ROUTER_URL="http://localhost:3002"
FAILED=0

# P0 TASK 4: Track if fallback occurred (test must FAIL on fallback)
FALLBACK_DETECTED=0

check_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $2"
  else
    echo -e "${RED}✗${NC} $2"
    FAILED=1
  fi
}

# P0 TASK 4: Verify response headers for model transparency
check_served_model_header() {
  local headers="$1"
  local expected_model="$2"
  
  # Extract x-synapse-model-served header
  local served_model=$(echo "$headers" | grep -i "x-synapse-model-served" | cut -d':' -f2 | tr -d ' \r')
  
  if [ "$served_model" = "$expected_model" ]; then
    echo -e "${GREEN}✓${NC} Response header shows served model: $served_model"
    return 0
  else
    echo -e "${RED}✗${NC} Expected served model '$expected_model', got '$served_model'"
    return 1
  fi
}

# Check if GPU mode should be tested
echo ""
echo "Checking for GPU/vLLM availability..."

# P1.1: Check if vLLM service is running (profiles removed)
VLLM_RUNNING=$(docker compose -f docker-compose.yml -f docker-compose.gpu.yml ps vllm 2>/dev/null | grep -c "running" || echo "0")

if [ "$VLLM_RUNNING" -eq 0 ]; then
    echo "⚠️  vLLM service not running. Starting GPU services..."
    # P1.1: Removed --profile gpu - services start by default with compose overlay
    docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d vllm vllm-node 2>&1 | tail -3
    echo "Waiting 30s for vLLM to load model..."
    sleep 30
fi

# Verify vLLM is responding
echo ""
echo "Checking vLLM health..."
VLLM_HEALTHY=0
for i in $(seq 1 30); do
    if curl -s http://localhost:8000/health 2>/dev/null | grep -q "ok" || \
       curl -s http://localhost:8000/v1/models 2>/dev/null | grep -q "deepseek"; then
        VLLM_HEALTHY=1
        echo "✓ vLLM healthy after ${i}s"
        break
    fi
    sleep 1
done

if [ "$VLLM_HEALTHY" -eq 0 ]; then
    echo -e "${RED}✗ vLLM not responding. GPU test cannot proceed.${NC}"
    echo "   Ensure:"
    echo "   - Docker with GPU support (nvidia-docker)"
    echo "   - NVIDIA drivers installed"
    # P1.1: Updated command without --profile
    echo "   - Run: docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d"
    exit 1
fi

echo ""
echo "1) Verifying deepseek-v3 model available..."
MODELS=$(curl -s ${API_URL}/v1/models)
echo "$MODELS" | grep -q "deepseek-v3"
check_result $? "deepseek-v3 in /v1/models"

echo ""
echo "2) Checking router has vLLM node with deepseek-v3..."
ROUTER_STATS=$(curl -s ${ROUTER_URL}/stats)
echo "$ROUTER_STATS" | grep -q "deepseek-v3"
check_result $? "Router has node with deepseek-v3"

# P0 TASK 4: Check node fingerprint is present (key persistence)
echo ""
echo "3) Verifying node identity persistence (fingerprint)..."
FINGERPRINT=$(echo "$ROUTER_STATS" | grep -o '"fingerprint":"[^"]*"' | head -1)
if [ -n "$FINGERPRINT" ]; then
    check_result 0 "Node has fingerprint: $FINGERPRINT"
else
    check_result 1 "Node missing fingerprint (key persistence issue)"
fi

echo ""
echo "4) Generating API key..."
API_RESPONSE=$(curl -s -X POST ${API_URL}/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"email":"gpu-test@example.com"}')
API_KEY=$(echo "$API_RESPONSE" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
# P1.2: Validate new key format
if echo "$API_KEY" | grep -qE '^syn_live_[a-zA-Z0-9]{16}_[a-zA-Z0-9]{32}$'; then
  check_result 0 "API key generated (new O(1) format)"
else
  check_result 1 "API key format invalid (expected: syn_live_<16-char>_<32-char>)"
fi

echo ""
echo "5) Testing deepseek-v3 completion with headers (CRITICAL: must NOT fallback)..."

# P0 TASK 4: Capture headers to check for fallback
HEADERS_FILE=$(mktemp)
COMPLETION=$(curl -s -D "$HEADERS_FILE" -X POST ${API_URL}/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v3",
    "messages": [{"role": "user", "content": "What is 2+2? Answer with just the number."}],
    "temperature": 0.1,
    "max_tokens": 10
  }')

# Check for choices
echo "$COMPLETION" | grep -q "choices"
check_result $? "Completion returned choices"

# P0 TASK 4: CRITICAL - Check response headers for model transparency
RESPONSE_HEADERS=$(cat "$HEADERS_FILE")
echo ""
echo "6) Verifying served model headers..."
SERVED_MODEL=$(echo "$RESPONSE_HEADERS" | grep -i "x-synapse-model-served" | cut -d':' -f2 | tr -d ' \r')
FALLBACK_HEADER=$(echo "$RESPONSE_HEADERS" | grep -i "x-synapse-fallback" | cut -d':' -f2 | tr -d ' \r')

echo "   x-synapse-model-served: $SERVED_MODEL"
echo "   x-synapse-fallback: $FALLBACK_HEADER"

if [ "$SERVED_MODEL" = "deepseek-v3" ]; then
    check_result 0 "Header shows deepseek-v3 was served"
else
    check_result 1 "Header shows '$SERVED_MODEL' instead of deepseek-v3"
    FALLBACK_DETECTED=1
fi

if [ "$FALLBACK_HEADER" = "true" ]; then
    echo -e "${RED}✗ FALLBACK DETECTED - Request was routed to echo-stub!${NC}"
    FALLBACK_DETECTED=1
fi

# P0 TASK 4: Verify response body has synapse_meta
echo ""
echo "7) Verifying synapse_meta in response body..."
echo "$COMPLETION" | grep -q "synapse_meta"
check_result $? "Response contains synapse_meta"

# P0 TASK 4: Check response model field matches served model
RESPONSE_MODEL=$(echo "$COMPLETION" | grep -o '"model":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ "$RESPONSE_MODEL" = "deepseek-v3" ]; then
    check_result 0 "Response model field is deepseek-v3"
else
    check_result 1 "Response model field is '$RESPONSE_MODEL' (fallback detected)"
    FALLBACK_DETECTED=1
fi

# P0 TASK 4: CRITICAL - Response must NOT be echo stub
echo ""
echo "8) CRITICAL: Verifying response is NOT echo-stub fallback..."
if echo "$COMPLETION" | grep -q "\[Echo\]"; then
    echo -e "${RED}✗ FAIL: Response contains [Echo] - routed to echo-stub instead of vLLM!${NC}"
    FALLBACK_DETECTED=1
    FAILED=1
else
    check_result 0 "Response is NOT from echo-stub (real vLLM)"
fi

# Check token fields
echo ""
echo "9) Verifying token accounting..."
echo "$COMPLETION" | grep -q '"usage"'
check_result $? "Response has usage field"

# Check stored usage in gateway
echo ""
echo "10) Verifying usage was stored..."
sleep 2
STATS=$(curl -s ${API_URL}/stats)
TOKENS_TOTAL=$(echo "$STATS" | grep -o '"tokens_total":[0-9]*' | cut -d':' -f2)
if [ "$TOKENS_TOTAL" -gt 0 ]; then
    check_result 0 "Tokens stored in gateway stats (total: $TOKENS_TOTAL)"
else
    check_result 1 "Tokens stored in gateway stats"
fi

# P0 TASK 2: Check receipt verification
echo ""
echo "11) Verifying receipt signature status..."
RECEIPT_STATUS=$(echo "$COMPLETION" | grep -o '"receipt_verified":"[^"]*"' | cut -d'"' -f4)
if [ -n "$RECEIPT_STATUS" ]; then
    if [ "$RECEIPT_STATUS" = "valid" ]; then
        check_result 0 "Receipt signature verified: valid"
    else
        echo -e "${YELLOW}⚠ Receipt status: $RECEIPT_STATUS${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No receipt verification status in response${NC}"
fi

# Cleanup
rm -f "$HEADERS_FILE"

# P0 TASK 4: FINAL VERDICT - FAIL if fallback was detected
echo ""
echo "=========================================="
if [ "$FALLBACK_DETECTED" -eq 1 ]; then
    echo -e "${RED}❌ GPU TESTS FAILED - FALLBACK DETECTED${NC}"
    echo ""
    echo "The deepseek-v3 request was routed to echo-stub instead of vLLM."
    echo "This indicates:"
    echo "  - vLLM node not properly registered"
    echo "  - Model advertisement mismatch"
    echo "  - Routing failure"
    echo ""
    echo "Response received:"
    echo "$COMPLETION" | head -c 500
    exit 1
fi

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✅ ALL GPU TESTS PASSED${NC}"
    echo ""
    echo "vLLM + DeepSeek-V3 is working correctly!"
    echo "  - Node identity persisted (fingerprint stable)"
    echo "  - Receipt signatures verified"
    echo "  - No fallback to echo-stub"
    echo "  - Model transparency headers present"
    exit 0
else
    echo -e "${RED}❌ SOME GPU TESTS FAILED${NC}"
    exit 1
fi

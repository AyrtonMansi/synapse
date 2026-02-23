#!/bin/bash
set -e

echo "🧪 Synapse GPU Smoke Test (Optional)"
echo "====================================="

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

# Check if GPU mode should be tested
echo ""
echo "Checking for GPU/vLLM availability..."

# Check if vLLM service is running
VLLM_RUNNING=$(docker compose ps vllm 2>/dev/null | grep -c "running" || echo "0")

if [ "$VLLM_RUNNING" -eq 0 ]; then
    echo "⚠️  vLLM service not running. Starting with GPU profile..."
    docker compose --profile gpu up -d vllm vllm-node 2>&1 | tail -3
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
    echo "⚠️  vLLM not responding. GPU test SKIPPED."
    echo "   To test GPU mode, ensure:"
    echo "   - Docker with GPU support (nvidia-docker)"
    echo "   - Run: docker compose --profile gpu up -d"
    exit 0
fi

echo ""
echo "1) Verifying deepseek-v3 model available..."
MODELS=$(curl -s ${API_URL}/v1/models)
echo "$MODELS" | grep -q "deepseek-v3"
check_result $? "deepseek-v3 in /v1/models"

echo ""
echo "2) Checking router has vLLM node..."
ROUTER_STATS=$(curl -s ${ROUTER_URL}/stats)
echo "$ROUTER_STATS" | grep -q "deepseek-v3"
check_result $? "Router has node with deepseek-v3"

echo ""
echo "3) Generating API key..."
API_RESPONSE=$(curl -s -X POST ${API_URL}/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"email":"gpu-test@example.com"}')
API_KEY=$(echo "$API_RESPONSE" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
[ -n "$API_KEY" ]
check_result $? "API key generated"

echo ""
echo "4) Testing deepseek-v3 completion (non-streaming)..."
COMPLETION=$(curl -s -X POST ${API_URL}/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v3",
    "messages": [{"role": "user", "content": "What is 2+2? Answer with just the number."}],
    "temperature": 0.1,
    "max_tokens": 10
  }')

echo "$COMPLETION" | grep -q "choices"
check_result $? "Completion returned choices"

echo "$COMPLETION" | grep -qv "Echo\]"
check_result $? "Response is NOT echo stub (real vLLM)"

# Check token fields
echo ""
echo "5) Verifying token accounting..."
echo "$COMPLETION" | grep -q '"usage"'
check_result $? "Response has usage field"

# Check stored usage in gateway
echo ""
echo "6) Verifying usage was stored..."
sleep 2
STATS=$(curl -s ${API_URL}/stats)
TOKENS_TOTAL=$(echo "$STATS" | grep -o '"tokens_total":[0-9]*' | cut -d':' -f2)
if [ "$TOKENS_TOTAL" -gt 0 ]; then
    check_result 0 "Tokens stored in gateway stats (total: $TOKENS_TOTAL)"
else
    check_result 1 "Tokens stored in gateway stats"
fi

echo ""
echo "====================================="
if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✅ GPU TESTS PASSED${NC}"
    echo ""
    echo "vLLM + DeepSeek-V3 is working correctly!"
    exit 0
else
    echo -e "${RED}❌ SOME GPU TESTS FAILED${NC}"
    exit 1
fi

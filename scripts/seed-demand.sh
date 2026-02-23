#!/bin/bash
# PHASE 9: Demand Seeding Script
# Generates synthetic traffic to bootstrap network demand

set -euo pipefail

API_URL="${API_URL:-https://api.synapse.sh}"
API_KEY="${API_KEY:-}"
CONCURRENT="${CONCURRENT:-10}"
RATE="${RATE:-100}"  # requests per minute
DURATION="${DURATION:-3600}"  # seconds

echo "=========================================="
echo "SYNAPSE DEMAND SEEDING"
echo "=========================================="
echo "API: $API_URL"
echo "Concurrent: $CONCURRENT clients"
echo "Rate: $RATE req/min"
echo "Duration: $DURATION seconds"
echo ""

if [ -z "$API_KEY" ]; then
    echo "Generating temporary API key..."
    TEMP_WALLET="0x$(openssl rand -hex 20)"
    API_KEY=$(curl -s -X POST "${API_URL}/auth/api-key" \
        -H "Content-Type: application/json" \
        -d "{\"wallet\":\"${TEMP_WALLET}\"}" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$API_KEY" ]; then
        echo "❌ Failed to generate API key"
        exit 1
    fi
    echo "✓ API key: ${API_KEY:0:20}..."
fi

# Test prompts that exercise different models
PROMPTS=(
    "Explain quantum computing in simple terms"
    "Write a Python function to sort a list"
    "Summarize the theory of relativity"
    "Generate a business email to schedule a meeting"
    "Translate 'Hello, how are you?' to French"
    "Debug this code: for i in range(10) print(i)"
    "Write a haiku about artificial intelligence"
    "Explain blockchain technology"
    "Create a SQL query to find duplicates"
    "Describe the process of photosynthesis"
)

MODELS=("deepseek-v3" "echo-stub")

# Statistics
TOTAL_REQUESTS=0
SUCCESSFUL=0
FAILED=0
TOTAL_TOKENS=0
START_TIME=$(date +%s)

make_request() {
    local prompt="${PROMPTS[$RANDOM % ${#PROMPTS[@]}]}"
    local model="${MODELS[$RANDOM % ${#MODELS[@]}]}"
    local start=$(date +%s%N)
    
    local response
    response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/v1/chat/completions" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"model\": \"${model}\",
            \"messages\": [{\"role\": \"user\", \"content\": \"${prompt}\"}],
            \"max_tokens\": 100
        }" 2>/dev/null)
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | head -n -1)
    local end=$(date +%s%N)
    local latency=$(( (end - start) / 1000000 ))  # ms
    
    TOTAL_REQUESTS=$((TOTAL_REQUESTS + 1))
    
    if [ "$http_code" = "200" ]; then
        SUCCESSFUL=$((SUCCESSFUL + 1))
        # Extract token count if available
        local tokens=$(echo "$body" | grep -o '"total_tokens":[0-9]*' | cut -d: -f2 || echo "0")
        TOTAL_TOKENS=$((TOTAL_TOKENS + tokens))
        echo "✓ ${latency}ms | $model | ${prompt:0:30}..."
    else
        FAILED=$((FAILED + 1))
        echo "✗ ${latency}ms | $model | HTTP $http_code"
    fi
}

# Rate limiter function
rate_limit() {
    local start=$1
    local target_rate=$2  # requests per minute
    local elapsed=$(($(date +%s) - start))
    local target_requests=$(( elapsed * target_rate / 60 ))
    
    if [ $TOTAL_REQUESTS -gt $target_requests ]; then
        local sleep_time=$(( (TOTAL_REQUESTS - target_requests) * 60 / target_rate ))
        if [ $sleep_time -gt 0 ]; then
            sleep $sleep_time
        fi
    fi
}

# Spawn concurrent workers
echo "Starting $CONCURRENT concurrent workers..."
echo ""

PIDS=()
for i in $(seq 1 $CONCURRENT); do
    (
        while [ $(($(date +%s) - START_TIME)) -lt $DURATION ]; do
            make_request
            rate_limit $START_TIME $((RATE / CONCURRENT))
        done
    ) &
    PIDS+=($!)
done

# Progress reporting
(
    while true; do
        sleep 10
        local elapsed=$(($(date +%s) - START_TIME))
        local rps=$(echo "scale=2; $TOTAL_REQUESTS / $elapsed" | bc 2>/dev/null || echo "0")
        
        echo ""
        echo "--- Progress ---"
        echo "Elapsed: ${elapsed}s / ${DURATION}s"
        echo "Requests: $TOTAL_REQUESTS (Success: $SUCCESSFUL, Failed: $FAILED)"
        echo "Tokens: $TOTAL_TOKENS"
        echo "Rate: ${rps} req/sec"
        echo "----------------"
        
        if [ $elapsed -ge $DURATION ]; then
            break
        fi
    done
) &
PROGRESS_PID=$!

# Wait for all workers
for pid in "${PIDS[@]}"; do
    wait $pid || true
done

kill $PROGRESS_PID 2>/dev/null || true

# Final report
echo ""
echo "=========================================="
echo "DEMAND SEEDING COMPLETE"
echo "=========================================="
echo "Total Requests: $TOTAL_REQUESTS"
echo "Successful: $SUCCESSFUL"
echo "Failed: $FAILED"
echo "Success Rate: $(echo "scale=2; $SUCCESSFUL * 100 / $TOTAL_REQUESTS" | bc 2>/dev/null || echo "0")%"
echo "Total Tokens: $TOTAL_TOKENS"
echo "Average Tokens/Request: $(echo "scale=0; $TOTAL_TOKENS / $TOTAL_REQUESTS" | bc 2>/dev/null || echo "0")"

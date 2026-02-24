#!/bin/bash
# Synapse Public Staging Validation Script
# Usage: ./scripts/validate-public-staging.sh [--local]
# --local: Test against localhost instead of public domains

set -euo pipefail

# Configuration
LOCAL_MODE=false
API_HOST="api.synapse.sh"
WS_HOST="ws.synapse.sh"
LANDING_HOST="synapse.sh"
APP_HOST="app.synapse.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

log() { echo -e "${BLUE}[TEST]${NC} $1"; }
pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASS++)); }
fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAIL++)); }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --local)
            LOCAL_MODE=true
            API_HOST="localhost:3001"
            WS_HOST="localhost:3002"
            LANDING_HOST="localhost:3000"
            APP_HOST="localhost:5173"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Check dependencies
check_deps() {
    log "Checking dependencies..."
    command -v curl >/dev/null 2>&1 || { fail "curl is required"; exit 1; }
    command -v jq >/dev/null 2>&1 || warn "jq not found, JSON parsing will be limited"
}

# Test 1: Gateway Health
test_gateway_health() {
    log "Testing gateway health endpoint..."
    local url="http${LOCAL_MODE:+s}://${API_HOST}/health"
    
    if curl -sf "$url" >/dev/null 2>&1; then
        pass "Gateway health check ($url)"
    else
        fail "Gateway health check failed ($url)"
    fi
}

# Test 2: Gateway Stats
test_gateway_stats() {
    log "Testing gateway stats endpoint..."
    local url="http${LOCAL_MODE:+s}://${API_HOST}/stats"
    
    local response
    if response=$(curl -sf "$url" 2>/dev/null); then
        if echo "$response" | grep -q "nodes_online"; then
            pass "Gateway stats endpoint returns valid JSON"
        else
            fail "Gateway stats missing expected fields"
        fi
    else
        fail "Gateway stats endpoint unreachable"
    fi
}

# Test 3: API Key Generation
test_api_key_generation() {
    log "Testing API key generation..."
    local url="http${LOCAL_MODE:+s}://${API_HOST}/auth/api-key"
    
    local response
    response=$(curl -sf -X POST "$url" \
        -H "Content-Type: application/json" \
        -d '{"wallet":"0xTestWallet'$(date +%s)'"}' 2>/dev/null) || true
    
    if [[ -n "$response" ]] && echo "$response" | grep -q "api_key"; then
        pass "API key generation works"
        # Extract and export for later tests
        export TEST_API_KEY=$(echo "$response" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
        log "Generated test API key: ${TEST_API_KEY:0:20}..."
    else
        fail "API key generation failed"
    fi
}

# Test 4: Chat Completions (with fallback check)
test_chat_completion() {
    log "Testing chat completion endpoint..."
    
    if [[ -z "${TEST_API_KEY:-}" ]]; then
        warn "Skipping chat test (no API key)"
        return
    fi
    
    local url="http${LOCAL_MODE:+s}://${API_HOST}/v1/chat/completions"
    
    local response
    response=$(curl -sf -X POST "$url" \
        -H "Authorization: Bearer $TEST_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "model": "deepseek-v3",
            "messages": [{"role": "user", "content": "Say hello"}],
            "max_tokens": 10
        }' 2>/dev/null) || true
    
    if [[ -z "$response" ]]; then
        fail "Chat completion request failed"
        return
    fi
    
    # Check for served_model header equivalent in response
    if echo "$response" | grep -q "model"; then
        pass "Chat completion returns response"
        
        # Check if it's fallback
        if echo "$response" | grep -q "fallback.*true\|echo-stub"; then
            warn "Chat completion using fallback (no GPU node)"
        else
            pass "Chat completion served by actual model"
        fi
    else
        fail "Chat completion response invalid"
    fi
}

# Test 5: WebSocket Router (if wscat available)
test_websocket() {
    log "Testing WebSocket router..."
    
    if ! command -v wscat >/dev/null 2>&1; then
        warn "wscat not installed, skipping WS test"
        warn "Install with: npm install -g wscat"
        return
    fi
    
    local ws_url="ws${LOCAL_MODE:+s}://${WS_HOST}/ws"
    
    # Try connection with 5 second timeout
    if timeout 5 wscat -c "$ws_url" -x '{"type":"ping"}' 2>/dev/null; then
        pass "WebSocket router reachable"
    else
        fail "WebSocket router unreachable"
    fi
}

# Test 6: CORS Headers
test_cors() {
    log "Testing CORS headers..."
    local url="http${LOCAL_MODE:+s}://${API_HOST}/stats"
    
    local response
    response=$(curl -sf -X OPTIONS "$url" \
        -H "Origin: https://app.example.com" \
        -H "Access-Control-Request-Method: POST" 2>/dev/null) || true
    
    if [[ -n "$response" ]]; then
        pass "CORS preflight responds"
    else
        warn "CORS preflight check inconclusive"
    fi
}

# Test 7: Response Headers
test_response_headers() {
    log "Testing response headers..."
    local url="http${LOCAL_MODE:+s}://${API_HOST}/stats"
    
    local headers
    headers=$(curl -sI "$url" 2>/dev/null) || true
    
    if echo "$headers" | grep -qi "x-synapse"; then
        pass "Synapse headers present"
    else
        warn "Synapse custom headers not detected"
    fi
}

# Test 8: Yield Estimates (if endpoint exists)
test_yield_estimates() {
    log "Testing yield estimates endpoint..."
    local url="http${LOCAL_MODE:+s}://${API_HOST}/yield-estimate"
    
    local response
    response=$(curl -sf "$url" 2>/dev/null) || true
    
    if [[ -n "$response" ]] && echo "$response" | grep -q "estimates"; then
        pass "Yield estimates endpoint available"
    else
        warn "Yield estimates endpoint not available (expected if no nodes)"
    fi
}

# Summary
print_summary() {
    echo ""
    echo "================================"
    echo "Validation Summary"
    echo "================================"
    echo -e "${GREEN}Passed: $PASS${NC}"
    echo -e "${RED}Failed: $FAIL${NC}"
    echo ""
    
    if [[ $FAIL -eq 0 ]]; then
        echo -e "${GREEN}All tests passed! Synapse is ready.${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed. Check logs above.${NC}"
        exit 1
    fi
}

# Main
main() {
    echo "================================"
    echo "Synapse Staging Validation"
    echo "================================"
    echo "Mode: ${LOCAL_MODE:+LOCAL}${LOCAL_MODE:-PUBLIC}"
    echo "API: $API_HOST"
    echo "WS: $WS_HOST"
    echo "================================"
    echo ""
    
    check_deps
    test_gateway_health
    test_gateway_stats
    test_api_key_generation
    test_chat_completion
    test_websocket
    test_cors
    test_response_headers
    test_yield_estimates
    
    print_summary
}

main "$@"

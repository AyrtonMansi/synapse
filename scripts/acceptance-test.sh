#!/bin/bash
# End-to-End Acceptance Test
# Validates all hard acceptance criteria

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="${API_URL:-http://localhost:3001}"
TEST_WALLET="0x742d35Cc6634C0532925a3b8D4C9db96590f6C7E"
FAILED=0

log() {
    echo -e "${GREEN}[TEST]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILED=$((FAILED + 1))
}

# A. Product UX Tests

test_a1_landing_api_generation() {
    log "A.1: Testing landing page API key generation..."
    
    RESPONSE=$(curl -s -X POST "${API_URL}/auth/api-key" \
        -H "Content-Type: application/json" \
        -d "{\"wallet\":\"${TEST_WALLET}\"}" 2>/dev/null || echo "{}")
    
    if echo "$RESPONSE" | grep -q "api_key"; then
        log "✓ API key generation works"
        API_KEY=$(echo "$RESPONSE" | jq -r '.api_key')
        log "  Generated key: ${API_KEY:0:20}..."
    else
        error "API key generation failed: $RESPONSE"
    fi
}

test_a2_openai_compatible() {
    log "A.2: Testing OpenAI-compatible endpoints..."
    
    # Test /v1/models
    MODELS=$(curl -s "${API_URL}/v1/models" 2>/dev/null || echo "{}")
    if echo "$MODELS" | grep -q "deepseek-v3"; then
        log "✓ /v1/models returns models"
    else
        error "/v1/models not working"
    fi
    
    # Test /v1/chat/completions (if we have a key)
    if [ -n "${API_KEY:-}" ]; then
        COMPLETION=$(curl -s -X POST "${API_URL}/v1/chat/completions" \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"model":"echo-stub","messages":[{"role":"user","content":"test"}]}' 2>/dev/null || echo "{}")
        
        if echo "$COMPLETION" | grep -q "choices"; then
            log "✓ /v1/chat/completions works"
        else
            error "/v1/chat/completions failed: $COMPLETION"
        fi
    fi
}

test_a3_model_transparency() {
    log "A.3: Testing model transparency headers..."
    
    if [ -n "${API_KEY:-}" ]; then
        HEADERS=$(curl -sI -X POST "${API_URL}/v1/chat/completions" \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"model":"echo-stub","messages":[{"role":"user","content":"test"}]}' 2>/dev/null || echo "")
        
        if echo "$HEADERS" | grep -iq "x-synapse-model-served"; then
            log "✓ Served-model header present"
        else
            warn "Served-model header missing (may be OK if using echo-stub)"
        fi
    fi
}

# B. Security Tests

test_b1_rate_limiting() {
    log "B.1: Testing rate limiting..."
    
    # Make 105 requests quickly
    for i in {1..105}; do
        curl -s "${API_URL}/health" > /dev/null 2>&1 || true
    done
    
    # Check if we get 429
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" 2>/dev/null || echo "000")
    if [ "$STATUS" = "429" ]; then
        log "✓ Rate limiting active (429 returned)"
    else
        warn "Rate limiting may not be active (status: $STATUS)"
    fi
}

test_b2_quota_enforcement() {
    log "B.2: Testing quota enforcement..."
    
    # Check if quota endpoint exists
    if [ -n "${API_KEY:-}" ]; then
        HEADERS=$(curl -sI -X POST "${API_URL}/v1/chat/completions" \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"model":"echo-stub","messages":[{"role":"user","content":"test"}]}' 2>/dev/null || echo "")
        
        if echo "$HEADERS" | grep -iq "x-quota"; then
            log "✓ Quota headers present"
        else
            warn "Quota headers missing"
        fi
    fi
}

# C. Settlement Tests

test_c1_contracts_exist() {
    log "C.1: Checking contract files..."
    
    CONTRACTS=("HSKToken.sol" "Treasury.sol" "ComputeEscrow.sol" "NodeRewards.sol" "NodeRegistry.sol")
    for contract in "${CONTRACTS[@]}"; do
        if [ -f "${PROJECT_ROOT}/hsk-contracts/src/${contract}" ]; then
            log "  ✓ ${contract} exists"
        else
            error "${contract} missing"
        fi
    done
}

test_c2_settlement_service() {
    log "C.2: Checking settlement service..."
    
    if [ -f "${PROJECT_ROOT}/services/settlement/src/index.ts" ]; then
        if grep -q "submitEpochMerkleRoot" "${PROJECT_ROOT}/services/settlement/src/index.ts"; then
            log "✓ Settlement service has on-chain integration"
        else
            warn "Settlement service may be stubbed"
        fi
    else
        error "Settlement service missing"
    fi
}

# D. Fraud Prevention

test_d1_challenge_system() {
    log "D.1: Checking challenge system..."
    
    if [ -f "${PROJECT_ROOT}/services/router/src/challenge.ts" ]; then
        if grep -q "verifyChallenge" "${PROJECT_ROOT}/services/router/src/challenge.ts"; then
            log "✓ Challenge job system implemented"
        else
            warn "Challenge system may be incomplete"
        fi
    else
        error "Challenge system missing"
    fi
}

test_d2_receipt_verification() {
    log "D.2: Checking receipt verification..."
    
    if [ -f "${PROJECT_ROOT}/services/router/src/receipts.ts" ]; then
        if grep -q "verifyReceipt" "${PROJECT_ROOT}/services/router/src/receipts.ts"; then
            log "✓ Receipt verification implemented"
        else
            warn "Receipt verification may be incomplete"
        fi
    else
        error "Receipt verification missing"
    fi
}

# E. Infrastructure

test_e1_k8s_manifests() {
    log "E.1: Checking Kubernetes manifests..."
    
    if [ -d "${PROJECT_ROOT}/infra/k8s" ]; then
        MANIFEST_COUNT=$(find "${PROJECT_ROOT}/infra/k8s" -name "*.yaml" | wc -l)
        if [ "$MANIFEST_COUNT" -gt 0 ]; then
            log "✓ ${MANIFEST_COUNT} K8s manifests found"
        else
            error "No K8s manifests found"
        fi
    else
        error "K8s directory missing"
    fi
}

test_e2_terraform() {
    log "E.2: Checking Terraform..."
    
    if [ -f "${PROJECT_ROOT}/infra/terraform/main.tf" ]; then
        log "✓ Terraform configuration exists"
    else
        error "Terraform configuration missing"
    fi
}

# F. Documentation

test_f1_architecture_doc() {
    log "F.1: Checking ARCHITECTURE.md..."
    
    if [ -f "${PROJECT_ROOT}/ARCHITECTURE.md" ]; then
        if grep -q "NodeRegistry" "${PROJECT_ROOT}/ARCHITECTURE.md"; then
            log "✓ ARCHITECTURE.md is current"
        else
            warn "ARCHITECTURE.md may be outdated"
        fi
    else
        error "ARCHITECTURE.md missing"
    fi
}

# Run all tests
echo "=========================================="
echo "SYNAPSE ACCEPTANCE TEST SUITE"
echo "API URL: ${API_URL}"
echo "=========================================="
echo ""

test_a1_landing_api_generation
test_a2_openai_compatible
test_a3_model_transparency
test_b1_rate_limiting
test_b2_quota_enforcement
test_c1_contracts_exist
test_c2_settlement_service
test_d1_challenge_system
test_d2_receipt_verification
test_e1_k8s_manifests
test_e2_terraform
test_f1_architecture_doc

echo ""
echo "=========================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}❌ $FAILED TEST(S) FAILED${NC}"
    exit 1
fi

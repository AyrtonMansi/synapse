#!/bin/bash
# verify-deployment.sh - Final deployment verification

set -e

echo "═══════════════════════════════════════════════════════════"
echo "           FINAL DEPLOYMENT VERIFICATION"
echo "═══════════════════════════════════════════════════════════"
echo ""

FAILED=0

check() {
    local description=$1
    local command=$2
    
    echo -n "Checking: $description... "
    
    if eval "$command" &>/dev/null; then
        echo "✅"
        return 0
    else
        echo "❌"
        ((FAILED++))
        return 1
    fi
}

# ========================================
# 1. Contract Verification
# ========================================
echo "1. SMART CONTRACTS"
echo "───────────────────────────────────────────────────────────"

if [ -f "deployment/mainnet/mainnet-deployment.json" ]; then
    HSK=$(cat deployment/mainnet/mainnet-deployment.json | jq -r '.contracts.HSKToken.address')
    TREASURY=$(cat deployment/mainnet/mainnet-deployment.json | jq -r '.contracts.TreasuryDAO.address')
    
    check "HSKToken deployed" "[ -n '$HSK' ]"
    check "TreasuryDAO deployed" "[ -n '$TREASURY' ]"
    check "Contracts verified on Etherscan" "curl -s https://api.etherscan.io/api?module=contract&action=getabi&address=$HSK&apikey=dummy | grep -q 'status.*1'"
else
    echo "❌ Mainnet deployment file not found"
    ((FAILED++))
fi

echo ""

# ========================================
# 2. Subgraph
# ========================================
echo "2. SUBGRAPH"
echo "───────────────────────────────────────────────────────────"

check "Subgraph accessible" "curl -s https://api.thegraph.com/subgraphs/name/synapse-network/synapse-mainnet -X POST -d '{\"query\":\"{ _meta { block { number } } }\"}' | grep -q 'data'"

echo ""

# ========================================
# 3. Infrastructure
# ========================================
echo "3. INFRASTRUCTURE"
echo "───────────────────────────────────────────────────────────"

check "API Gateway 1 running" "curl -s http://localhost:3001/health | grep -q 'ok'"
check "API Gateway 2 running" "curl -s http://localhost:3002/health | grep -q 'ok'"
check "API Gateway 3 running" "curl -s http://localhost:3003/health | grep -q 'ok'"
check "IPFS node US East" "curl -s http://localhost:5001/api/v0/version | grep -q 'Version'"
check "Prometheus running" "curl -s http://localhost:9090/-/healthy | grep -q 'Prometheus'"
check "Grafana running" "curl -s http://localhost:3000/api/health | grep -q 'ok'"
check "Redis running" "docker exec synapse-redis redis-cli ping | grep -q 'PONG'"

echo ""

# ========================================
# 4. Security
# ========================================
echo "4. SECURITY"
echo "───────────────────────────────────────────────────────────"

check "SSL certificates valid" "openssl x509 -in deployment/configs/ssl/fullchain.pem -noout -checkend 86400"
check "No test private keys in code" "! grep -r '0x[0-9a-fA-F]\{64\}' synapse-contracts/contracts/ 2>/dev/null | grep -v '.sol'"
check "Emergency pause accessible" "[ -f 'deployment/emergency/emergency-pause.sh' ]"

echo ""

# ========================================
# 5. Configuration
# ========================================
echo "5. CONFIGURATION"
echo "───────────────────────────────────────────────────────────"

check "Environment variables set" "[ -f '.env' ] && grep -q 'MAINNET_RPC_URL' .env"
check "Monitoring alerts configured" "[ -f 'deployment/configs/alerts.yml' ]"
check "Backup scripts installed" "[ -f '/usr/local/bin/backup-all.sh' ]"

echo ""

# ========================================
# Summary
# ========================================
echo "═══════════════════════════════════════════════════════════"
echo "                    VERIFICATION SUMMARY"
echo "═══════════════════════════════════════════════════════════"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 All verification checks passed!"
    echo ""
    echo "Deployment is ready for launch."
    echo ""
    echo "Next steps:"
    echo "  1. Send launch announcement to community"
    echo "  2. Enable monitoring alerts"
    echo "  3. Start node operator onboarding"
    echo "  4. Begin marketing campaign"
    echo ""
    exit 0
else
    echo "⚠️  $FAILED verification checks failed."
    echo ""
    echo "Please resolve issues before launch."
    echo ""
    exit 1
fi

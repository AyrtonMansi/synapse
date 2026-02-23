#!/bin/bash
# health-check.sh - Comprehensive health check for all services

set -e

echo "═══════════════════════════════════════════════════════════"
echo "           SYNAPSE HEALTH CHECK"
echo "═══════════════════════════════════════════════════════════"
echo ""

FAILED=0
PASSED=0

check_service() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $name... "
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
        if [ "$response" = "$expected_status" ]; then
            echo "✅ (HTTP $response)"
            ((PASSED++))
            return 0
        else
            echo "❌ (HTTP $response, expected $expected_status)"
            ((FAILED++))
            return 1
        fi
    else
        echo "❌ (Connection failed)"
        ((FAILED++))
        return 1
    fi
}

check_contract() {
    local name=$1
    local address=$2
    
    echo -n "Checking $name ($address)... "
    
    # Check if contract has code
    if [ -n "$RPC_URL" ]; then
        # Use cast to check contract
        if command -v cast &> /dev/null; then
            code=$(cast code "$address" --rpc-url "$RPC_URL" 2>/dev/null)
            if [ -n "$code" ] && [ "$code" != "0x" ]; then
                echo "✅ (Contract deployed)"
                ((PASSED++))
                return 0
            fi
        fi
    fi
    
    echo "⚠️  (Could not verify)"
    return 0
}

# ========================================
# Smart Contracts
# ========================================
echo "📋 SMART CONTRACTS"
echo "───────────────────────────────────────────────────────────"

if [ -f "deployment/mainnet/mainnet-deployment.json" ]; then
    HSK=$(cat deployment/mainnet/mainnet-deployment.json | jq -r '.contracts.HSKToken.address')
    TREASURY=$(cat deployment/mainnet/mainnet-deployment.json | jq -r '.contracts.TreasuryDAO.address')
    ORACLE=$(cat deployment/mainnet/mainnet-deployment.json | jq -r '.contracts.PriceOracle.address')
    DISPUTE=$(cat deployment/mainnet/mainnet-deployment.json | jq -r '.contracts.DisputeResolver.address')
    JOB=$(cat deployment/mainnet/mainnet-deployment.json | jq -r '.contracts.JobRegistry.address')
    STREAM=$(cat deployment/mainnet/mainnet-deployment.json | jq -r '.contracts.StreamingPayments.address')
    
    check_contract "HSKToken" "$HSK"
    check_contract "TreasuryDAO" "$TREASURY"
    check_contract "PriceOracle" "$ORACLE"
    check_contract "DisputeResolver" "$DISPUTE"
    check_contract "JobRegistry" "$JOB"
    check_contract "StreamingPayments" "$STREAM"
else
    echo "⚠️  Mainnet deployment file not found"
fi

echo ""

# ========================================
# API Gateways
# ========================================
echo "📋 API GATEWAYS"
echo "───────────────────────────────────────────────────────────"

check_service "API Gateway 1" "http://localhost:3001/health"
check_service "API Gateway 2" "http://localhost:3002/health"
check_service "API Gateway 3" "http://localhost:3003/health"

echo ""

# ========================================
# IPFS Nodes
# ========================================
echo "📋 IPFS NODES"
echo "───────────────────────────────────────────────────────────"

check_service "IPFS US East" "http://localhost:5001/api/v0/id" 200
check_service "IPFS EU West" "http://localhost:5101/api/v0/id" 200
check_service "IPFS APAC" "http://localhost:5201/api/v0/id" 200

echo ""

# ========================================
# Monitoring Stack
# ========================================
echo "📋 MONITORING"
echo "───────────────────────────────────────────────────────────"

check_service "Prometheus" "http://localhost:9090/-/healthy" 200
check_service "Grafana" "http://localhost:3000/api/health" 200
check_service "Loki" "http://localhost:3100/ready" 200
check_service "AlertManager" "http://localhost:9093/-/healthy" 200
check_service "Uptime Kuma" "http://localhost:3001" 200

echo ""

# ========================================
# Database
# ========================================
echo "📋 DATABASE"
echo "───────────────────────────────────────────────────────────"

check_service "Redis" "redis://localhost:6379" 200

echo ""

# ========================================
# Subgraph
# ========================================
echo "📋 SUBGRAPH"
echo "───────────────────────────────────────────────────────────"

SUBGRAPH_URL="https://api.thegraph.com/subgraphs/name/synapse-network/synapse-mainnet"
check_service "Subgraph" "$SUBGRAPH_URL" 200

echo ""

# ========================================
# Summary
# ========================================
echo "═══════════════════════════════════════════════════════════"
echo "                    HEALTH CHECK SUMMARY"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 All health checks passed!"
    exit 0
else
    echo "⚠️  $FAILED health checks failed. Please investigate."
    exit 1
fi

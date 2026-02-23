#!/bin/bash
# launch-sequence.sh - Complete mainnet launch procedure

set -e

echo "═══════════════════════════════════════════════════════════"
echo "           SYNAPSE MAINNET LAUNCH SEQUENCE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "⚠️  This script will execute the complete mainnet launch"
echo "   Only run this when all pre-launch checks are complete"
echo ""

# Phase tracking
PHASE=0
TOTAL_PHASES=10

progress() {
    local current=$1
    local total=$2
    local message=$3
    local percent=$((current * 100 / total))
    local filled=$((percent / 2))
    local empty=$((50 - filled))
    
    printf "\r["
    printf "%${filled}s" | tr ' ' '█'
    printf "%${empty}s" | tr ' ' '░'
    printf "] %d%% - %s" "$percent" "$message"
}

confirm_phase() {
    local phase_name=$1
    echo ""
    echo "───────────────────────────────────────────────────────────"
    echo "Phase $PHASE/$TOTAL_PHASES: $phase_name"
    echo "───────────────────────────────────────────────────────────"
    read -p "Proceed? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Launch sequence cancelled."
        exit 0
    fi
}

# ========================================
# PHASE 0: Pre-flight checks
# ========================================
PHASE=0
confirm_phase "Pre-flight Checks"

progress 0 10 "Checking prerequisites..."

# Check environment
if [ -z "$MAINNET_RPC_URL" ]; then
    echo "❌ MAINNET_RPC_URL not set"
    exit 1
fi

if [ -z "$MULTISIG_ADDRESS" ]; then
    echo "❌ MULTISIG_ADDRESS not set"
    exit 1
fi

if [ ! -f "deployment/mainnet/mainnet-deployment.json" ]; then
    echo "❌ Mainnet deployment file not found"
    exit 1
fi

progress 1 10 "Prerequisites check complete"
sleep 1

# ========================================
# PHASE 1: Smart Contract Verification
# ========================================
PHASE=1
confirm_phase "Smart Contract Verification"

echo "Verifying contracts on Etherscan..."
cd deployment/mainnet
./verify-mainnet.sh
cd ../..

progress 2 10 "Contracts verified"

# ========================================
# PHASE 2: Gas Optimization Check
# ========================================
PHASE=2
confirm_phase "Gas Optimization Verification"

echo "Verifying gas optimization..."
cd deployment/mainnet
./verify-gas-optimization.sh
cd ../..

progress 3 10 "Gas optimization verified"

# ========================================
# PHASE 3: Security Checklist
# ========================================
PHASE=3
confirm_phase "Security Checklist"

echo "Running security checklist..."
cd deployment/mainnet
./security-checklist.sh || exit 1
cd ../..

progress 4 10 "Security checklist passed"

# ========================================
# PHASE 4: Deploy Subgraph
# ========================================
PHASE=4
confirm_phase "Deploy Subgraph"

echo "Deploying subgraph to mainnet..."
cd deployment/subgraph
./deploy-subgraph.sh mainnet v1.0.0
cd ../..

progress 5 10 "Subgraph deployed"

# ========================================
# PHASE 5: Infrastructure Deployment
# ========================================
PHASE=5
confirm_phase "Infrastructure Deployment"

echo "Deploying infrastructure..."

# Start IPFS nodes
echo "  Starting IPFS cluster..."
docker-compose -f deployment/infrastructure/docker-compose.ipfs.yml up -d

# Start API gateways
echo "  Starting API gateways..."
docker-compose -f deployment/infrastructure/docker-compose.api.yml up -d

# Start monitoring
echo "  Starting monitoring stack..."
docker-compose -f deployment/infrastructure/docker-compose.monitoring.yml up -d

progress 6 10 "Infrastructure deployed"
sleep 5

# ========================================
# PHASE 6: Health Checks
# ========================================
PHASE=6
confirm_phase "Health Checks"

echo "Running health checks..."
./deployment/scripts/health-check.sh

progress 7 10 "Health checks passed"

# ========================================
# PHASE 7: SSL Certificate Setup
# ========================================
PHASE=7
confirm_phase "SSL Certificate Setup"

echo "Setting up SSL certificates..."
./deployment/scripts/setup-ssl.sh

progress 8 10 "SSL certificates configured"

# ========================================
# PHASE 8: Backup Procedures
# ========================================
PHASE=8
confirm_phase "Backup Procedures"

echo "Setting up backup procedures..."
./deployment/scripts/setup-backup.sh

progress 9 10 "Backup procedures configured"

# ========================================
# PHASE 9: Final Verification
# ========================================
PHASE=9
confirm_phase "Final Verification"

echo "Running final verification..."
./deployment/scripts/verify-deployment.sh

progress 10 10 "Final verification complete"

# ========================================
# Launch Complete
# ========================================
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "              ✅ MAINNET LAUNCH COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Synapse Network is now LIVE on Ethereum Mainnet!"
echo ""
echo "Next steps:"
echo "  1. Announce launch to community"
echo "  2. Monitor metrics dashboard"
echo "  3. Enable node operator onboarding"
echo "  4. Begin marketing campaign"
echo ""
echo "Emergency contacts:"
echo "  - Multisig: $MULTISIG_ADDRESS"
echo "  - Status Page: https://status.synapse.network"
echo ""

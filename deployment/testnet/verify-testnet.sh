#!/bin/bash
# verify-testnet.sh - Verify all contracts on Sepolia Etherscan

set -e

echo "═══════════════════════════════════════════════════════════"
echo "           VERIFYING CONTRACTS ON SEPOLIA"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Load deployment info
DEPLOYMENT_FILE="testnet-deployment.json"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "❌ Deployment file not found: $DEPLOYMENT_FILE"
    exit 1
fi

# Read contract addresses
HSK_TOKEN=$(cat $DEPLOYMENT_FILE | jq -r '.contracts.HSKToken.address')
TREASURY_DAO=$(cat $DEPLOYMENT_FILE | jq -r '.contracts.TreasuryDAO.address')
PRICE_ORACLE=$(cat $DEPLOYMENT_FILE | jq -r '.contracts.PriceOracle.address')
DISPUTE_RESOLVER=$(cat $DEPLOYMENT_FILE | jq -r '.contracts.DisputeResolver.address')
JOB_REGISTRY=$(cat $DEPLOYMENT_FILE | jq -r '.contracts.JobRegistry.address')
STREAMING_PAYMENTS=$(cat $DEPLOYMENT_FILE | jq -r '.contracts.StreamingPayments.address')

echo "Verifying contracts..."
echo ""

# Function to verify contract
verify_contract() {
    local address=$1
    local contract=$2
    local args=$3
    
    echo "📋 Verifying $contract at $address..."
    
    if [ -z "$args" ]; then
        npx hardhat verify --network sepolia "$address" "$contract"
    else
        npx hardhat verify --network sepolia "$address" $args
    fi
    
    echo "✅ $contract verified"
    echo ""
}

# Verify each contract
cd ../../synapse-contracts

verify_contract "$HSK_TOKEN" "HSKToken" ""
verify_contract "$TREASURY_DAO" "TreasuryDAO" ""
verify_contract "$PRICE_ORACLE" "PriceOracle" ""
verify_contract "$DISPUTE_RESOLVER" "DisputeResolver" ""
verify_contract "$JOB_REGISTRY" "JobRegistry" ""
verify_contract "$STREAMING_PAYMENTS" "StreamingPayments" ""

echo "═══════════════════════════════════════════════════════════"
echo "           ✅ ALL CONTRACTS VERIFIED"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "View contracts at:"
echo "  https://sepolia.etherscan.io/address/$HSK_TOKEN"

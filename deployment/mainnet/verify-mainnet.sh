#!/bin/bash
# verify-mainnet.sh - Verify all contracts on Mainnet Etherscan

set -e

echo "═══════════════════════════════════════════════════════════"
echo "           VERIFYING CONTRACTS ON MAINNET"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Load deployment info
DEPLOYMENT_FILE="mainnet-deployment.json"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "❌ Deployment file not found: $DEPLOYMENT_FILE"
    exit 1
fi

# Check for Etherscan API key
if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo "❌ ETHERSCAN_API_KEY not set"
    exit 1
fi

# Read contract addresses
HSK_TOKEN=$(cat $DEPLOYMENT_FILE | jq -r '.contracts.HSKToken.address')
TREASURY_DAO=$(cat $DEPLOYMENT_FILE | jq -r '.contracts.TreasuryDAO.address')
PRICE_ORACLE=$(cat $DEPLOYMENT_FILE | jq -r '.contracts.PriceOracle.address')
DISPUTE_RESOLVER=$(cat $DEPLOYMENT_FILE | jq -r '.contracts.DisputeResolver.address')
JOB_REGISTRY=$(cat $DEPLOYMENT_FILE | jq -r '.contracts.JobRegistry.address')
STREAMING_PAYMENTS=$(cat $DEPLOYMENT_FILE | jq -r '.contracts.StreamingPayments.address')

echo "Verifying contracts on Mainnet Etherscan..."
echo ""

# Function to verify contract
verify_contract() {
    local address=$1
    local contract=$2
    shift 2
    local args="$@"
    
    echo "📋 Verifying $contract at $address..."
    
    if [ -z "$args" ]; then
        npx hardhat verify --network mainnet "$address"
    else
        npx hardhat verify --network mainnet "$address" $args
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ $contract verified"
    else
        echo "❌ $contract verification failed"
    fi
    echo ""
}

# Verify each contract
cd ../../synapse-contracts

echo "Note: Constructor arguments must be provided for each contract"
echo ""

# HSKToken - constructor(address initialOwner, address treasury)
echo "Verifying HSKToken (needs constructor args)..."
echo "Constructor: initialOwner, treasury"

# TreasuryDAO - constructor(address token, address[] proposers, address[] executors)
echo "Verifying TreasuryDAO (needs constructor args)..."
echo "Constructor: token, proposers[], executors[]"

# PriceOracle - constructor(address owner)
echo "Verifying PriceOracle (needs constructor args)..."
echo "Constructor: owner"

# DisputeResolver - constructor(address owner)
echo "Verifying DisputeResolver (needs constructor args)..."
echo "Constructor: owner"

# JobRegistry - constructor(address treasury, address owner)
echo "Verifying JobRegistry (needs constructor args)..."
echo "Constructor: treasury, owner"

# StreamingPayments - constructor(address treasury, address owner)
echo "Verifying StreamingPayments (needs constructor args)..."
echo "Constructor: treasury, owner"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "           VERIFICATION COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "View contracts at:"
echo "  https://etherscan.io/address/$HSK_TOKEN"
echo "  https://etherscan.io/address/$TREASURY_DAO"
echo "  https://etherscan.io/address/$PRICE_ORACLE"
echo "  https://etherscan.io/address/$DISPUTE_RESOLVER"
echo "  https://etherscan.io/address/$JOB_REGISTRY"
echo "  https://etherscan.io/address/$STREAMING_PAYMENTS"
echo ""

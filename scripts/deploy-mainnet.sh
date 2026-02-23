#!/bin/bash
# PHASE 11: Mainnet Deployment Script
# Deploys Synapse contracts to Ethereum mainnet with full verification

set -euo pipefail

# Mainnet Configuration
RPC_URL="${RPC_URL:-https://eth-mainnet.g.alchemy.com/v2/$ALCHEMY_KEY}"
PRIVATE_KEY="${PRIVATE_KEY:-}"
ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-}"

# Safety checks
echo "=========================================="
echo "SYNAPSE MAINNET DEPLOYMENT"
echo "=========================================="
echo ""

if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ PRIVATE_KEY required"
    exit 1
fi

if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo "⚠️  ETHERSCAN_API_KEY not set (verification will be skipped)"
fi

DEPLOYER_ADDR=$(cast wallet address "$PRIVATE_KEY")
echo "Deployer: $DEPLOYER_ADDR"

# Check deployer balance
BALANCE=$(cast balance "$DEPLOYER_ADDR" --rpc-url "$RPC_URL" | cast to-dec)
BALANCE_ETH=$(echo "scale=4; $BALANCE / 1000000000000000000" | bc)
echo "Balance: $BALANCE_ETH ETH"

if (( $(echo "$BALANCE_ETH < 0.5" | bc -l) )); then
    echo "❌ Insufficient balance for deployment (need ~0.5 ETH)"
    exit 1
fi

# Confirm deployment
echo ""
read -p "⚠️  Deploy to MAINNET? Type 'DEPLOY' to confirm: " CONFIRM
if [ "$CONFIRM" != "DEPLOY" ]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "Starting deployment in 10 seconds..."
sleep 10

cd "$(dirname "$0")/../hsk-contracts"

# Deploy contracts
deploy_contract() {
    local contract=$1
    local args=$2
    local name=$3
    
    echo ""
    echo "Deploying $name..."
    
    local output
    output=$(forge create "$contract" \
        --rpc-url "$RPC_URL" \
        --private-key "$PRIVATE_KEY" \
        $args \
        --json)
    
    local address
    address=$(echo "$output" | jq -r '.deployedTo')
    local tx_hash
    tx_hash=$(echo "$output" | jq -r '.transactionHash')
    
    echo "  Address: $address"
    echo "  TX: $tx_hash"
    
    # Verify on Etherscan
    if [ -n "$ETHERSCAN_API_KEY" ]; then
        echo "  Verifying on Etherscan..."
        forge verify-contract "$address" "$contract" \
            --chain mainnet \
            --etherscan-api-key "$ETHERSCAN_API_KEY" \
            $args || echo "  ⚠️ Verification failed - retry manually"
    fi
    
    echo "$address"
}

# 1. HSKToken
echo "1. HSK Token"
HSK_TOKEN=$(deploy_contract "src/HSKToken.sol:HSKToken" \
    "--constructor-args \"Synapse Token\" \"HSK\" $DEPLOYER_ADDR" \
    "HSKToken")

# 2. Treasury
echo "2. Treasury"
TREASURY=$(deploy_contract "src/Treasury.sol:Treasury" \
    "--constructor-args $HSK_TOKEN $DEPLOYER_ADDR" \
    "Treasury")

# 3. ComputeEscrow
echo "3. Compute Escrow"
ESCROW=$(deploy_contract "src/ComputeEscrow.sol:ComputeEscrow" \
    "--constructor-args $HSK_TOKEN $DEPLOYER_ADDR" \
    "ComputeEscrow")

# 4. NodeRegistry
echo "4. Node Registry"
REGISTRY=$(deploy_contract "src/NodeRegistry.sol:NodeRegistry" \
    "--constructor-args $TREASURY $DEPLOYER_ADDR" \
    "NodeRegistry")

# 5. NodeRewards
echo "5. Node Rewards"
REWARDS=$(deploy_contract "src/NodeRewards.sol:NodeRewards" \
    "--constructor-args $HSK_TOKEN $TREASURY 604800 $DEPLOYER_ADDR" \
    "NodeRewards")

# Configure
echo ""
echo "Configuring contracts..."

cast send $HSK_TOKEN "setTreasury(address)" $TREASURY \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

cast send $TREASURY "whitelistMinter(address)" $REWARDS \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

# Save deployment
cat > "deployment-mainnet.json" << EOF
{
  "network": "mainnet",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer": "$DEPLOYER_ADDR",
  "contracts": {
    "HSKToken": "$HSK_TOKEN",
    "Treasury": "$TREASURY",
    "ComputeEscrow": "$ESCROW",
    "NodeRegistry": "$REGISTRY",
    "NodeRewards": "$REWARDS"
  }
}
EOF

echo ""
echo "=========================================="
echo "MAINNET DEPLOYMENT COMPLETE"
echo "=========================================="
echo ""
cat deployment-mainnet.json
echo ""
echo "⚠️  CRITICAL NEXT STEPS:"
echo "1. Fund Treasury with HSK for rewards"
echo "2. Transfer ownership to multisig/Timelock"
echo "3. Verify all contracts on Etherscan"
echo "4. Update frontend with contract addresses"
echo "5. Start settlement daemon"
echo ""

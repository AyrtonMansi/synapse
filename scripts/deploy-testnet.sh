#!/bin/bash
# PHASE 1: Contract Deployment to Testnet
# Deploys all Synapse contracts and verifies them

set -euo pipefail

# Configuration (override with env vars)
RPC_URL="${RPC_URL:-https://sepolia.base.org}"
PRIVATE_KEY="${PRIVATE_KEY:-}"
VERIFIER_URL="${VERIFIER_URL:-https://api-sepolia.basescan.org/api}"
ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-}"

if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ PRIVATE_KEY required"
    echo "Usage: PRIVATE_KEY=0x... ./deploy-testnet.sh"
    exit 1
fi

echo "=========================================="
echo "SYNAPSE CONTRACT DEPLOYMENT"
echo "=========================================="
echo "Network: Base Sepolia"
echo "RPC: $RPC_URL"
echo ""

cd "$(dirname "$0")/../hsk-contracts"

# Function to deploy and verify
deploy_contract() {
    local contract=$1
    local args=$2
    
    echo "Deploying $contract..."
    
    # Deploy
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
    
    # Save to deployments file
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $contract $address $tx_hash" >> deployments-testnet.log
    
    # Verify if API key provided
    if [ -n "$ETHERSCAN_API_KEY" ]; then
        echo "  Verifying on BaseScan..."
        forge verify-contract "$address" "$contract" \
            --chain base-sepolia \
            --etherscan-api-key "$ETHERSCAN_API_KEY" \
            --verifier-url "$VERIFIER_URL" \
            $args || echo "  ⚠️ Verification failed (may retry later)"
    fi
    
    echo ""
    echo "$address"
}

# Deploy HSKToken
echo "1. Deploying HSKToken..."
HSK_TOKEN=$(deploy_contract "src/HSKToken.sol:HSKToken" "--constructor-args \"Synapse Token\" \"HSK\" $(cast wallet address "$PRIVATE_KEY")")

# Deploy Treasury
echo "2. Deploying Treasury..."
TREASURY=$(deploy_contract "src/Treasury.sol:Treasury" "--constructor-args $HSK_TOKEN $(cast wallet address "$PRIVATE_KEY")")

# Deploy ComputeEscrow
echo "3. Deploying ComputeEscrow..."
ESCROW=$(deploy_contract "src/ComputeEscrow.sol:ComputeEscrow" "--constructor-args $HSK_TOKEN $(cast wallet address "$PRIVATE_KEY")")

# Deploy NodeRegistry
echo "4. Deploying NodeRegistry..."
REGISTRY=$(deploy_contract "src/NodeRegistry.sol:NodeRegistry" "--constructor-args $TREASURY $(cast wallet address "$PRIVATE_KEY")")

# Deploy NodeRewards
echo "5. Deploying NodeRewards..."
REWARDS=$(deploy_contract "src/NodeRewards.sol:NodeRewards" "--constructor-args $HSK_TOKEN $TREASURY 604800 $(cast wallet address "$PRIVATE_KEY")")

# Configuration transactions
echo "6. Configuring contracts..."

# Set Treasury as minter for HSKToken
cast send "$HSK_TOKEN" "setTreasury(address)" "$TREASURY" \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY"
echo "  ✓ Treasury set as minter"

# Whitelist NodeRewards as minter
cast send "$TREASURY" "whitelistMinter(address)" "$REWARDS" \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY"
echo "  ✓ NodeRewards whitelisted as minter"

# Whitelist ComputeEscrow as provider
cast send "$ESCROW" "addProvider(address)" "$(cast wallet address "$PRIVATE_KEY")" \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY"
echo "  ✓ Gateway added as escrow provider"

# Save deployment config
cat > "deployment-testnet.json" << EOF
{
  "network": "base-sepolia",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer": "$(cast wallet address "$PRIVATE_KEY")",
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
echo "DEPLOYMENT COMPLETE"
echo "=========================================="
echo ""
cat deployment-testnet.json
echo ""
echo "Deployments logged to: deployments-testnet.log"
echo ""
echo "Next steps:"
echo "  1. Fund Treasury with initial HSK for rewards"
echo "  2. Configure settlement service with contract addresses"
echo "  3. Test miner registration flow"

#!/bin/bash
# CONTRACT ACTIVATION: Testnet Deployment
# Simplified version for execution

set -e

RPC_URL="${RPC_URL:-https://sepolia.base.org}"
PRIVATE_KEY="${PRIVATE_KEY:-}"

if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ PRIVATE_KEY required"
    exit 1
fi

DEPLOYER=$(cast wallet address "$PRIVATE_KEY")
echo "Deployer: $DEPLOYER"

cd "$(dirname "$0")/../hsk-contracts"

echo "Building contracts..."
forge build

echo ""
echo "Deploying HSKToken..."
HSK_TOKEN=$(forge create src/HSKToken.sol:HSKToken \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --constructor-args "Synapse Token" "HSK" "$DEPLOYER" \
    --json | jq -r '.deployedTo')
echo "✓ HSKToken: $HSK_TOKEN"

echo ""
echo "Deploying Treasury..."
TREASURY=$(forge create src/Treasury.sol:Treasury \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --constructor-args "$HSK_TOKEN" "$DEPLOYER" \
    --json | jq -r '.deployedTo')
echo "✓ Treasury: $TREASURY"

echo ""
echo "Deploying ComputeEscrow..."
ESCROW=$(forge create src/ComputeEscrow.sol:ComputeEscrow \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --constructor-args "$HSK_TOKEN" "$DEPLOYER" \
    --json | jq -r '.deployedTo')
echo "✓ ComputeEscrow: $ESCROW"

echo ""
echo "Deploying NodeRegistry..."
REGISTRY=$(forge create src/NodeRegistry.sol:NodeRegistry \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --constructor-args "$TREASURY" "$DEPLOYER" \
    --json | jq -r '.deployedTo')
echo "✓ NodeRegistry: $REGISTRY"

echo ""
echo "Deploying NodeRewards..."
REWARDS=$(forge create src/NodeRewards.sol:NodeRewards \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --constructor-args "$HSK_TOKEN" "$TREASURY" "604800" "$DEPLOYER" \
    --json | jq -r '.deployedTo')
echo "✓ NodeRewards: $REWARDS"

echo ""
echo "Configuring contracts..."
cast send "$HSK_TOKEN" "setTreasury(address)" "$TREASURY" --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
cast send "$TREASURY" "whitelistMinter(address)" "$REWARDS" --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

echo ""
cat > deployment-testnet.json << EOF
{
  "network": "base-sepolia",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer": "$DEPLOYER",
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
cat deployment-testnet.json

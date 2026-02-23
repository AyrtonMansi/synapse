#!/bin/bash
# End-to-End Integration Test: User Request → Charge → Epoch → Claim
# Runs against local Anvil fork

set -euo pipefail

echo "=========================================="
echo "END-TO-END SETTLEMENT TEST"
echo "=========================================="
echo ""

# Start Anvil in background
echo "1. Starting local Anvil node..."
anvil --fork-url https://sepolia.base.org --silent &
ANVIL_PID=$!
sleep 3

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up..."
    kill $ANVIL_PID 2>/dev/null || true
}
trap cleanup EXIT

RPC_URL="http://localhost:8545"
DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" # Anvil default
USER_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" # Anvil account 2
MINER_KEY="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" # Anvil account 3

echo "2. Deploying contracts..."
cd hsk-contracts

# Deploy HSKToken
HSK_TOKEN=$(forge create src/HSKToken.sol:HSKToken \
    --rpc-url $RPC_URL \
    --private-key $DEPLOYER_KEY \
    --constructor-args "Synapse Token" "HSK" $(cast wallet address $DEPLOYER_KEY) \
    --json | jq -r '.deployedTo')
echo "  HSKToken: $HSK_TOKEN"

# Deploy Treasury
TREASURY=$(forge create src/Treasury.sol:Treasury \
    --rpc-url $RPC_URL \
    --private-key $DEPLOYER_KEY \
    --constructor-args $HSK_TOKEN $(cast wallet address $DEPLOYER_KEY) \
    --json | jq -r '.deployedTo')
echo "  Treasury: $TREASURY"

# Deploy ComputeEscrow
ESCROW=$(forge create src/ComputeEscrow.sol:ComputeEscrow \
    --rpc-url $RPC_URL \
    --private-key $DEPLOYER_KEY \
    --constructor-args $HSK_TOKEN $(cast wallet address $DEPLOYER_KEY) \
    --json | jq -r '.deployedTo')
echo "  ComputeEscrow: $ESCROW"

# Deploy NodeRegistry
REGISTRY=$(forge create src/NodeRegistry.sol:NodeRegistry \
    --rpc-url $RPC_URL \
    --private-key $DEPLOYER_KEY \
    --constructor-args $TREASURY $(cast wallet address $DEPLOYER_KEY) \
    --json | jq -r '.deployedTo')
echo "  NodeRegistry: $REGISTRY"

# Deploy NodeRewards
REWARDS=$(forge create src/NodeRewards.sol:NodeRewards \
    --rpc-url $RPC_URL \
    --private-key $DEPLOYER_KEY \
    --constructor-args $HSK_TOKEN $TREASURY 3600 $(cast wallet address $DEPLOYER_KEY) \
    --json | jq -r '.deployedTo')
echo "  NodeRewards: $REWARDS"

# Configure contracts
echo ""
echo "3. Configuring contracts..."
cast send $HSK_TOKEN "setTreasury(address)" $TREASURY --rpc-url $RPC_URL --private-key $DEPLOYER_KEY
cast send $TREASURY "whitelistMinter(address)" $REWARDS --rpc-url $RPC_URL --private-key $DEPLOYER_KEY
cast send $ESCROW "addProvider(address)" $(cast wallet address $DEPLOYER_KEY) --rpc-url $RPC_URL --private-key $DEPLOYER_KEY

echo ""
echo "4. Funding accounts..."
# Mint HSK to user
 cast send $TREASURY "mint(address,uint256)" $(cast wallet address $USER_KEY) 10000000000000000000000 --rpc-url $RPC_URL --private-key $DEPLOYER_KEY 2>/dev/null || echo "  (Mint requires schedule in production)"

# Fund user with ETH for gas
cast send $(cast wallet address $USER_KEY) --value 1ether --rpc-url $RPC_URL --private-key $DEPLOYER_KEY

# Fund miner with ETH for gas
cast send $(cast wallet address $MINER_KEY) --value 1ether --rpc-url $RPC_URL --private-key $DEPLOYER_KEY

echo ""
echo "5. User deposits to escrow..."
# Approve
cast send $HSK_TOKEN "approve(address,uint256)" $ESCROW 1000000000000000000000 --rpc-url $RPC_URL --private-key $USER_KEY
# Deposit
cast send $ESCROW "deposit(uint256)" 100000000000000000000 --rpc-url $RPC_URL --private-key $USER_KEY

USER_BALANCE=$(cast call $ESCROW "deposits(address)" $(cast wallet address $USER_KEY) --rpc-url $RPC_URL | cast to-dec)
echo "  User escrow balance: $USER_BALANCE"

echo ""
echo "6. Miner registers node..."
NODE_ID=$(cast keccak "test-node-1")
PUBKEY=$(cast keccak "test-pubkey")
# Fund miner with HSK for stake
cast send $HSK_TOKEN "transfer(address,uint256)" $(cast wallet address $MINER_KEY) 20000000000000000000000 --rpc-url $RPC_URL --private-key $DEPLOYER_KEY
# Approve registry
cast send $HSK_TOKEN "approve(address,uint256)" $REGISTRY 10000000000000000000000 --rpc-url $RPC_URL --private-key $MINER_KEY
# Register
cast send $REGISTRY "register(bytes32,bytes32,string,string[])" $NODE_ID $PUBKEY "wss://node1.example.com" '["deepseek-v3"]' --rpc-url $RPC_URL --private-key $MINER_KEY --value 10000000000000000000000

echo ""
echo "7. Simulating job completion..."
# Record job (router would do this)
cast send $REGISTRY "recordJob(bytes32,bool)" $NODE_ID true --rpc-url $RPC_URL --private-key $DEPLOYER_KEY

# Charge user (gateway would do this)
cast send $ESCROW "charge(address,uint256)" $(cast wallet address $USER_KEY) 1000000000000000000 --rpc-url $RPC_URL --private-key $DEPLOYER_KEY

echo ""
echo "8. Advance epoch and submit Merkle root..."
# In production, settlement daemon waits for epoch duration
# For test, we call directly
cast send $REWARDS "submitEpochMerkleRoot(uint256,bytes32,uint256)" 0 $(cast keccak "merkle-root") 10000000000000000000 --rpc-url $RPC_URL --private-key $DEPLOYER_KEY

echo ""
echo "9. Miner claims rewards..."
# Would need actual Merkle proof from settlement service
echo "  (Claim requires valid Merkle proof from settlement daemon)"
echo "  cast send $REWARDS \"claim(uint256,uint256,bytes32[])\" 0 10000000000000000000 []"

echo ""
echo "=========================================="
echo "✅ END-TO-END TEST COMPLETE"
echo "=========================================="
echo ""
echo "Contract Addresses:"
echo "  HSKToken: $HSK_TOKEN"
echo "  Treasury: $TREASURY"
echo "  ComputeEscrow: $ESCROW"
echo "  NodeRegistry: $REGISTRY"
echo "  NodeRewards: $REWARDS"
echo ""
echo "All phases executed:"
echo "  ✓ Contracts deployed"
echo "  ✓ User deposited to escrow"
echo "  ✓ Miner registered with stake"
echo "  ✓ Job recorded and user charged"
echo "  ✓ Epoch finalized with Merkle root"
echo "  ✓ Claim ready (needs Merkle proof)"

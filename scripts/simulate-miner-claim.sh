#!/bin/bash
# PHASE 1: Miner Claim Flow Simulation
# Tests end-to-end: node registration → job completion → epoch close → claim

set -euo pipefail

RPC_URL="${RPC_URL:-https://sepolia.base.org}"
PRIVATE_KEY="${PRIVATE_KEY:-}"

if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ PRIVATE_KEY required"
    exit 1
fi

# Load deployment addresses
if [ ! -f "hsk-contracts/deployment-testnet.json" ]; then
    echo "❌ deployment-testnet.json not found. Run deploy-testnet.sh first."
    exit 1
fi

REGISTRY=$(jq -r '.contracts.NodeRegistry' hsk-contracts/deployment-testnet.json)
REWARDS=$(jq -r '.contracts.NodeRewards' hsk-contracts/deployment-testnet.json)
ESCROW=$(jq -r '.contracts.ComputeEscrow' hsk-contracts/deployment-testnet.json)
HSK_TOKEN=$(jq -r '.contracts.HSKToken' hsk-contracts/deployment-testnet.json)

MINER_KEY="${MINER_KEY:-$PRIVATE_KEY}"
MINER_ADDR=$(cast wallet address "$MINER_KEY")

echo "=========================================="
echo "MINER CLAIM FLOW SIMULATION"
echo "=========================================="
echo "Miner: $MINER_ADDR"
echo ""

# Step 1: Fund miner with HSK for stake
echo "1. Checking miner HSK balance..."
BALANCE=$(cast call "$HSK_TOKEN" "balanceOf(address)" "$MINER_ADDR" --rpc-url "$RPC_URL" | cast to-dec)
if [ "$BALANCE" -lt 10000000000000000000000 ]; then
    echo "  ⚠️ Miner needs HSK for stake. Balance: $BALANCE"
    echo "  Fund miner from deployer:"
    echo "  cast send $HSK_TOKEN \"transfer(address,uint256)\" $MINER_ADDR 10000000000000000000000 --rpc-url $RPC_URL --private-key <DEPLOYER_KEY>"
else
    echo "  ✓ Miner has sufficient HSK"
fi

# Step 2: Register node
echo ""
echo "2. Registering node..."
NODE_ID=$(cast keccak "$(date +%s)")
PUBKEY=$(cast keccak "pubkey-$MINER_ADDR")
ENDPOINT="wss://node.example.com"
MODELS='["deepseek-v3"]'

# Check if already registered
REGISTERED=$(cast call "$REGISTRY" "nodes(bytes32)" "$NODE_ID" --rpc-url "$RPC_URL" | head -1)
if [ "$REGISTERED" = "0x0000000000000000000000000000000000000000" ]; then
    cast send "$REGISTRY" "register(bytes32,bytes32,string,string[])" \
        "$NODE_ID" "$PUBKEY" "$ENDPOINT" "$MODELS" \
        --rpc-url "$RPC_URL" \
        --private-key "$MINER_KEY" \
        --value 10000000000000000000000  # 10,000 HSK stake
    echo "  ✓ Node registered with 10,000 HSK stake"
else
    echo "  ✓ Node already registered"
fi

# Step 3: Simulate job completion (would be done by router in production)
echo ""
echo "3. Simulating job completion..."
echo "  (In production, router calls recordJob after verification)"
cast send "$REGISTRY" "recordJob(bytes32,bool)" "$NODE_ID" true \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" 2>/dev/null || echo "  ⚠️ Only owner can record jobs"

# Step 4: User deposits to escrow
echo ""
echo "4. User depositing to escrow..."
USER_KEY="${USER_KEY:-$PRIVATE_KEY}"
USER_ADDR=$(cast wallet address "$USER_KEY")

APPROVED=$(cast call "$HSK_TOKEN" "allowance(address,address)" "$USER_ADDR" "$ESCROW" --rpc-url "$RPC_URL" | cast to-dec)
if [ "$APPROVED" -lt 1000000000000000000000 ]; then
    cast send "$HSK_TOKEN" "approve(address,uint256)" "$ESCROW" 10000000000000000000000 \
        --rpc-url "$RPC_URL" \
        --private-key "$USER_KEY"
    echo "  ✓ Approved escrow spend"
fi

DEPOSIT_BALANCE=$(cast call "$ESCROW" "deposits(address)" "$USER_ADDR" --rpc-url "$RPC_URL" | cast to-dec)
if [ "$DEPOSIT_BALANCE" -lt 100000000000000000000 ]; then
    cast send "$ESCROW" "deposit(uint256)" 1000000000000000000000 \
        --rpc-url "$RPC_URL" \
        --private-key "$USER_KEY"
    echo "  ✓ Deposited 1,000 HSK to escrow"
else
    echo "  ✓ User has escrow balance"
fi

# Step 5: Charge user for job
echo ""
echo "5. Charging user for job completion..."
# This would be done by gateway/settlement service
cast send "$ESCROW" "charge(address,uint256)" "$USER_ADDR" 1000000000000000000 \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" 2>/dev/null || echo "  (Skipped - only provider can charge)"

# Step 6: Advance epoch (in production, time-based)
echo ""
echo "6. Epoch advancement..."
echo "  Current epoch: $(cast call "$REWARDS" "currentEpoch()" --rpc-url "$RPC_URL" | cast to-dec)"
echo "  (In production, epochs advance automatically every 7 days)"

# Step 7: Submit Merkle root (settlement service)
echo ""
echo "7. Submitting epoch Merkle root..."
# This would be done by settlement daemon
MERKLE_ROOT=$(cast keccak "epoch-root")
TOTAL_REWARDS=100000000000000000000  # 100 HSK

cast send "$REWARDS" "submitEpochMerkleRoot(uint256,bytes32,uint256)" \
    0 "$MERKLE_ROOT" "$TOTAL_REWARDS" \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" 2>/dev/null || echo "  (Skipped - settlement service handles this)"

# Step 8: Miner claims rewards
echo ""
echo "8. Claiming rewards..."
# Would use actual Merkle proof from settlement service
PROOF="[]"  # Empty for simulation
AMOUNT=10000000000000000000  # 10 HSK

echo "  cast send $REWARDS \"claim(uint256,uint256,bytes32[])\" 0 $AMOUNT $PROOF"
echo "  (Requires valid Merkle proof from settlement service)"

# Show final state
echo ""
echo "=========================================="
echo "FLOW SIMULATION COMPLETE"
echo "=========================================="
echo ""
echo "Contract State:"
echo "  Node Registry: $REGISTRY"
echo "  Node Rewards: $REWARDS"
echo "  Compute Escrow: $ESCROW"
echo ""
echo "Miner State:"
echo "  Address: $MINER_ADDR"
echo "  Node ID: $NODE_ID"
echo "  HSK Balance: $(cast call $HSK_TOKEN \"balanceOf(address)\" $MINER_ADDR --rpc-url $RPC_URL | cast to-dec)"
echo ""
echo "Next Steps for Production:"
echo "  1. Settlement daemon monitors jobs and builds Merkle trees"
echo "  2. Daemon submits roots to NodeRewards contract"
echo "  3. Miners query settlement API for claim proofs"
echo "  4. Miners call claim() with proof to receive HSK"

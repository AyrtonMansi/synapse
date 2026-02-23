#!/bin/bash
set -e

echo "🚀 Synapse Network - Production Deploy Script"
echo "=============================================="
echo ""

# Configuration
NETWORK=${1:-sepolia}
CONFIRM=${2:-false}

if [ "$NETWORK" == "mainnet" ] && [ "$CONFIRM" != "--confirm" ]; then
    echo "⚠️  WARNING: You are about to deploy to MAINNET"
    echo "This will use real ETH and create permanent contracts"
    echo ""
    echo "To confirm, run: ./deploy.sh mainnet --confirm"
    exit 1
fi

echo "📋 Pre-deployment checks..."

# Check environment
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Copy .env.example and configure"
    exit 1
fi

source .env

# Check private key
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ PRIVATE_KEY not set in .env"
    exit 1
fi

# Check RPC
if [ -z "$RPC_URL" ]; then
    echo "❌ RPC_URL not set in .env"
    exit 1
fi

echo "✅ Environment configured"
echo ""

# Test RPC connection
echo "🔗 Testing RPC connection..."
curl -s -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null

if [ $? -ne 0 ]; then
    echo "❌ Cannot connect to RPC"
    exit 1
fi

echo "✅ RPC connection successful"
echo ""

# Check balance
echo "💰 Checking deployer balance..."
cd synapse-contracts
BALANCE=$(npx hardhat balance --network "$NETWORK" 2>/dev/null || echo "0")

if [ "$BALANCE" == "0" ] || [ -z "$BALANCE" ]; then
    echo "❌ Deployer has no balance"
    exit 1
fi

echo "✅ Deployer balance: $BALANCE ETH"
echo ""

# Compile contracts
echo "🔨 Compiling contracts..."
npx hardhat compile

if [ $? -ne 0 ]; then
    echo "❌ Contract compilation failed"
    exit 1
fi

echo "✅ Contracts compiled"
echo ""

# Run tests
echo "🧪 Running tests..."
npx hardhat test

if [ $? -ne 0 ]; then
    echo "❌ Tests failed"
    exit 1
fi

echo "✅ All tests passing"
echo ""

# Deploy
echo "📦 Deploying to $NETWORK..."
npx hardhat run scripts/deploy.ts --network "$NETWORK" | tee deploy-log.txt

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed"
    exit 1
fi

# Extract addresses
echo ""
echo "📝 Extracting contract addresses..."
grep "deployed to:" deploy-log.txt | awk '{print $NF}' > contract-addresses.txt

echo "✅ Deployment complete!"
echo ""
echo "Contract addresses saved to: contract-addresses.txt"
echo ""
echo "Next steps:"
echo "1. Verify contracts on Etherscan"
echo "2. Update frontend with new addresses"
echo "3. Deploy subgraph"
echo "4. Start API gateways"

#!/bin/bash
# deploy-subgraph.sh - Deploy The Graph subgraph for Synapse

set -e

echo "═══════════════════════════════════════════════════════════"
echo "           DEPLOYING SYNAPSE SUBGRAPH"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Configuration
NETWORK="${1:-sepolia}"
VERSION_LABEL="${2:-v0.0.1}"

if [ "$NETWORK" = "mainnet" ]; then
    GRAPH_NODE="https://api.thegraph.com/deploy/"
    IPFS_NODE="https://api.thegraph.com/ipfs/"
else
    GRAPH_NODE="https://api.studio.thegraph.com/deploy/"
    IPFS_NODE="https://api.thegraph.com/ipfs/"
fi

echo "Network: $NETWORK"
echo "Version: $VERSION_LABEL"
echo ""

# Check prerequisites
if [ ! -f "subgraph.yaml" ]; then
    echo "❌ subgraph.yaml not found. Generate it first:"
    echo "   yarn prepare:$NETWORK"
    exit 1
fi

if [ -z "$GRAPH_ACCESS_TOKEN" ]; then
    echo "❌ GRAPH_ACCESS_TOKEN not set"
    exit 1
fi

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
yarn install

# Step 2: Generate code from schema
echo "🔧 Generating code from schema..."
yarn codegen

# Step 3: Build subgraph
echo "🔨 Building subgraph..."
yarn build

# Step 4: Create subgraph (if not exists)
echo "📝 Creating subgraph (if not exists)..."
graph create synapse-network/synapse-$NETWORK --node $GRAPH_NODE 2>/dev/null || true

# Step 5: Deploy
echo "🚀 Deploying subgraph..."
graph deploy \
    synapse-network/synapse-$NETWORK \
    --version-label $VERSION_LABEL \
    --node $GRAPH_NODE \
    --ipfs $IPFS_NODE \
    --access-token $GRAPH_ACCESS_TOKEN

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "           ✅ SUBGRAPH DEPLOYED"
echo "═══════════════════════════════════════════════════════════"
echo ""

if [ "$NETWORK" = "mainnet" ]; then
    echo "Subgraph URL:"
    echo "  https://api.thegraph.com/subgraphs/name/synapse-network/synapse-mainnet"
else
    echo "Subgraph URL:"
    echo "  https://api.studio.thegraph.com/query/synapse-network/synapse-sepolia/$VERSION_LABEL"
fi

echo ""
echo "Query endpoint:"
echo "  https://api.thegraph.com/subgraphs/name/synapse-network/synapse-$NETWORK"
echo ""

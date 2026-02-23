#!/bin/bash
# Synapse Node startup script

set -e

echo "=========================================="
echo "  Synapse Node v0.1.0"
echo "  Decentralized AI Inference"
echo "=========================================="

# Check for GPU
if command -v nvidia-smi &> /dev/null; then
    echo "✓ NVIDIA GPU detected"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || true
else
    echo "⚠ No NVIDIA GPU detected - running in CPU mode"
fi

# Check for wallet
if [ -z "$SYNAPSE_WALLET_PRIVATE_KEY" ]; then
    echo "⚠ Warning: SYNAPSE_WALLET_PRIVATE_KEY not set"
    echo "  Node will run but cannot earn rewards"
fi

# Create necessary directories
mkdir -p /app/models /app/logs /app/circuits /app/data

# Start the node
echo ""
echo "Starting Synapse Node..."
echo "API: http://0.0.0.0:${SYNAPSE_API_PORT:-8080}"
echo "Metrics: http://0.0.0.0:${SYNAPSE_PROMETHEUS_PORT:-9090}"
echo ""

exec python3 -m synapse_node.core.node "$@"

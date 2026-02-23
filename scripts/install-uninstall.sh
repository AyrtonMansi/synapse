#!/bin/bash
set -e

echo "🗑️  Synapse Node Uninstaller"
echo "============================"

CONTAINER_NAME="${CONTAINER_NAME:-synapse-node}"

# Confirm
read -p "Remove node '$CONTAINER_NAME'? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Stop and remove container
echo ""
echo "Stopping container..."
if docker stop "$CONTAINER_NAME" 2>/dev/null; then
    echo "✓ Container stopped"
else
    echo "⚠️  Container not running or not found"
fi

echo ""
echo "Removing container..."
if docker rm "$CONTAINER_NAME" 2>/dev/null; then
    echo "✓ Container removed"
else
    echo "⚠️  Container not found"
fi

# Optional: remove image
echo ""
read -p "Remove Docker image? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    IMAGE="${SYNAPSE_IMAGE:-ghcr.io/ayrtonmansi/synapse-node-agent:latest}"
    if docker rmi "$IMAGE" 2>/dev/null; then
        echo "✓ Image removed"
    else
        echo "⚠️  Image not found or in use"
    fi
fi

echo ""
echo "✅ Uninstall complete"

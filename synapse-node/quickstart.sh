#!/bin/bash
# Synapse Node Quick Start Script

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║           🧠  Synapse Node - Quick Start  🧠             ║"
echo "║                                                          ║"
echo "║     Decentralized AI Inference Network Node              ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found. Please install Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker found${NC}"

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found. Please install Docker Compose first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose found${NC}"

# Check NVIDIA runtime
if docker info | grep -q "nvidia"; then
    echo -e "${GREEN}✓ NVIDIA runtime detected${NC}"
    NVIDIA_AVAILABLE=true
else
    echo -e "${YELLOW}⚠ NVIDIA runtime not detected. GPU support may not work.${NC}"
    NVIDIA_AVAILABLE=false
fi

echo ""

# Setup environment
echo -e "${BLUE}Setting up environment...${NC}"

if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file from template${NC}"
else
    echo -e "${YELLOW}⚠ .env file already exists${NC}"
fi

# Ask for wallet setup
echo ""
echo -e "${BLUE}Do you want to set up a wallet now? (y/n)${NC}"
read -r SETUP_WALLET

if [[ $SETUP_WALLET =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}Installing CLI tool...${NC}"
    pip install -e . 2>/dev/null || echo -e "${YELLOW}Note: Could not install CLI. You can run 'pip install -e .' manually.${NC}"
    
    echo ""
    echo -e "${BLUE}Creating wallet...${NC}"
    synapse wallet create || echo -e "${YELLOW}Note: Wallet creation skipped. Run 'synapse wallet create' manually.${NC}"
fi

# Ask for HuggingFace token
echo ""
echo -e "${BLUE}Do you have a HuggingFace token for accessing gated models? (y/n)${NC}"
read -r HAS_HF_TOKEN

if [[ $HAS_HF_TOKEN =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Enter your HuggingFace token (starts with 'hf_'):${NC}"
    read -r HF_TOKEN
    
    if grep -q "HUGGING_FACE_HUB_TOKEN" .env; then
        sed -i "s/# HUGGING_FACE_HUB_TOKEN=.*/HUGGING_FACE_HUB_TOKEN=$HF_TOKEN/" .env
    else
        echo "HUGGING_FACE_HUB_TOKEN=$HF_TOKEN" >> .env
    fi
    echo -e "${GREEN}✓ HuggingFace token added to .env${NC}"
fi

echo ""
echo -e "${BLUE}Building Docker image...${NC}"
docker-compose build

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Setup complete!                                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Quick Start Commands:${NC}"
echo ""
echo "  Start node:        ${GREEN}docker-compose up -d${NC}"
echo "  View logs:         ${GREEN}docker-compose logs -f synapse-node${NC}"
echo "  Check status:      ${GREEN}curl http://localhost:8080/health${NC}"
echo "  Stop node:         ${GREEN}docker-compose down${NC}"
echo ""
echo -e "${BLUE}CLI Commands (after 'pip install -e .'):${NC}"
echo ""
echo "  Node status:       ${GREEN}synapse node status${NC}"
echo "  View logs:         ${GREEN}synapse logs show -f${NC}"
echo "  Check earnings:    ${GREEN}synapse earnings show${NC}"
echo ""
echo -e "${YELLOW}Note: Edit .env file to customize your node configuration.${NC}"
echo ""

# Ask to start now
echo -e "${BLUE}Start the node now? (y/n)${NC}"
read -r START_NOW

if [[ $START_NOW =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${GREEN}Starting Synapse Node...${NC}"
    docker-compose up -d
    echo ""
    echo -e "${GREEN}Node started! View logs with:${NC} docker-compose logs -f synapse-node"
fi

# Synapse Network - Deployment Guide

## Complete Platform Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                         SYNAPSE NETWORK                             │
├────────────────────────────────────────────────────────────────────┤
│  LANDING PAGE  │  DASHBOARD  │  NODE SOFTWARE  │  SMART CONTRACTS  │
│  (Marketing)   │  (User App) │  (GPU Mining)   │  (Blockchain)     │
├────────────────────────────────────────────────────────────────────┤
│  BACKEND SERVICES (P2P Mesh)                                      │
│  • API Gateway    • Job Router    • IPFS    • The Graph           │
└────────────────────────────────────────────────────────────────────┘
```

## Quick Deploy (5 minutes)

### 1. Clone & Setup
```bash
git clone https://github.com/synapse-network/synapse.git
cd synapse
cp .env.example .env
# Edit .env with your settings
```

### 2. Deploy Smart Contracts
```bash
cd synapse-contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.ts --network sepolia
# Copy deployed addresses to .env
```

### 3. Start Backend
```bash
docker-compose up -d
# Starts: API Gateway, Job Router, IPFS, The Graph
```

### 4. Deploy Frontend
```bash
cd synapse-frontend
npm install
npm run build
npm run deploy:ipfs
# Returns IPFS hash for synapse.eth
```

### 5. Run Node (Optional)
```bash
cd synapse-node
docker build -t synapse/node .
docker run -d --gpus all \
  -e WALLET_ADDRESS=0x... \
  synapse/node
```

## Architecture

### Smart Contracts (Solidity)
- **HSKToken.sol** - ERC20 with vesting, burn, mining emissions
- **JobRegistry.sol** - Job escrow, reputation, slashing
- **TreasuryDAO.sol** - DAO-controlled treasury
- **PriceOracle.sol** - Chainlink HSK/USD feed
- **DisputeResolver.sol** - Kleros/UMA integration

### Backend (Node.js)
- **api-gateway** - Wallet auth (SIWE), rate limiting
- **job-router** - P2P mesh coordination (libp2p)
- **ipfs-service** - Decentralized storage
- **subgraph** - The Graph indexing

### Frontend (React)
- **Dashboard** - Usage stats, API keys, billing
- **Node Operator** - Earnings, job history, staking
- **Governance** - DAO proposals, voting
- **Docs** - API reference, guides

### Node Software (Python)
- **GPU Detection** - NVIDIA CUDA auto-detect
- **Model Manager** - Auto-download DeepSeek, Llama
- **Inference** - vLLM serving
- **P2P Mesh** - WebSocket connection
- **ZK Proofs** - Work verification

## Decentralization Features

✅ **No Email/Password** - Wallet-only auth
✅ **No KYC/AML** - Permissionless
✅ **No Central DB** - IPFS + blockchain only
✅ **No Admin Keys** - DAO governance
✅ **P2P Routing** - No central API gateway
✅ **IPFS Hosting** - Censorship-resistant
✅ **ZK Verification** - Trustless compute

## Monitoring

```bash
# View logs
docker-compose logs -f

# Check node status
curl http://localhost:3000/health

# View subgraph
open http://localhost:8000/subgraphs/name/synapse
```

## Support

- Docs: https://docs.synapse.network
- Discord: https://discord.gg/synapse
- GitHub: https://github.com/synapse-network/synapse

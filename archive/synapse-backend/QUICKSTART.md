# Synapse Backend API

## Services Overview

```
synapse-backend/
├── api-gateway/          # Express + SIWE auth + Rate limiting
├── job-router/           # P2P mesh coordinator (libp2p)
├── ipfs-service/         # IPFS storage layer
├── subgraph/             # The Graph indexer
├── contracts/            # Solidity smart contracts
└── docker-compose.yml    # Local dev orchestration
```

## Quick Start

```bash
# 1. Copy environment
cp .env.example .env

# 2. Start services
docker-compose up -d

# 3. Deploy contracts (first time)
docker-compose --profile setup run --rm contract-deployer

# 4. Deploy subgraph
docker-compose --profile setup run --rm subgraph-deployer

# 5. Test API
curl http://localhost:3000/health
```

## API Endpoints

| Service | Endpoint | Description |
|---------|----------|-------------|
| API Gateway | `POST /auth/verify` | SIWE authentication |
| API Gateway | `POST /jobs` | Create compute job |
| Job Router | `POST /jobs` | Submit to P2P mesh |
| IPFS Service | `POST /upload` | Store content |
| Graph Node | `POST :8000/subgraphs/name/synapse-local` | Query indexed data |

## Key Features

- **No Central Database**: All state on blockchain or IPFS
- **Wallet Auth**: SIWE (Sign-In with Ethereum) - no passwords
- **P2P Mesh**: libp2p for decentralized job routing
- **Smart Contract Rate Limiting**: On-chain quota enforcement
- **The Graph Indexing**: Queryable job history and reputation
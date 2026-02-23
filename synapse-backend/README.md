# Synapse Backend API

Fully decentralized compute network backend with wallet-based authentication, P2P job routing, blockchain indexing, and IPFS storage.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   API Gateway   │────▶│   Job Router     │◀────│  P2P Mesh Nodes │
│   (SIWE Auth)   │     │   (libp2p)       │     │  (Workers)      │
└────────┬────────┘     └────────┬─────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  Smart Contract │     │      IPFS        │
│  (Rate Limit)   │     │   (Job Results)  │
└─────────────────┘     └──────────────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
            ┌──────────────────┐
            │  The Graph Node  │
            │   (Indexer)      │
            └──────────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- Git

### 1. Clone and Configure

```bash
git clone <repo>
cd synapse-backend

# Copy environment template
cp .env.example .env

# Edit .env with your settings
vim .env
```

### 2. Start Core Services

```bash
# Start IPFS, Ethereum, Graph Node, and databases
docker-compose up -d ipfs ethereum postgres graph-node

# Wait for services to be ready (about 30 seconds)
sleep 30
```

### 3. Deploy Contracts (First Time Only)

```bash
# Deploy smart contracts to local chain
docker-compose --profile setup run --rm contract-deployer

# Get deployed addresses
cat shared/contract-addresses.json

# Update .env with contract addresses
```

### 4. Deploy Subgraph (First Time Only)

```bash
# Deploy The Graph subgraph
docker-compose --profile setup run --rm subgraph-deployer
```

### 5. Start Application Services

```bash
# Start API Gateway and Job Router
docker-compose up -d api-gateway job-router ipfs-service

# Check all services
docker-compose ps
```

## API Documentation

### Authentication (SIWE)

All API requests require wallet-based authentication using Sign-In with Ethereum (SIWE).

#### 1. Get Nonce
```bash
GET /auth/nonce/{walletAddress}
```

Response:
```json
{
  "nonce": "abc123...",
  "message": "Sign this message to authenticate with Synapse. Nonce: abc123..."
}
```

#### 2. Sign Message

Sign the provided message with your Ethereum wallet (MetaMask, WalletConnect, etc.).

#### 3. Verify Signature
```bash
POST /auth/verify
Content-Type: application/json

{
  "message": "...",
  "signature": "0x..."
}
```

Response:
```json
{
  "success": true,
  "address": "0x...",
  "token": "eyJ...",
  "apiKey": "syn_...",
  "rateLimit": {
    "requestsPerMinute": 60,
    "requestsPerHour": 1000,
    "requestsPerDay": 10000
  }
}
```

#### 4. Use API Key

Include the API key in all subsequent requests:
```bash
X-API-Key: syn_abc123...
```

### Jobs API

#### Create Job
```bash
POST /jobs
X-API-Key: syn_...

{
  "jobType": "compute",
  "inputHash": "Qm...",
  "maxPayment": "1000000000000000000",
  "timeout": 3600
}
```

Response:
```json
{
  "jobId": "0x...",
  "transaction": {
    "to": "0x...",
    "data": "0x...",
    "value": "1000000000000000000"
  },
  "status": "awaiting_signature"
}
```

> **Note:** The client must sign and send the transaction to the blockchain.

#### Get Job Status
```bash
GET /jobs/{jobId}
X-API-Key: syn_...
```

Response:
```json
{
  "jobId": "0x...",
  "creator": "0x...",
  "jobType": "compute",
  "payment": "1000000000000000000",
  "timeout": "3600",
  "status": "Pending"
}
```

#### List My Jobs
```bash
GET /jobs
X-API-Key: syn_...
```

### Job Router API

#### Submit Job to P2P Network
```bash
POST http://localhost:4000/jobs
Content-Type: application/json

{
  "jobType": "ai-inference",
  "inputCid": "Qm...",
  "payment": "1000000000000000000",
  "requirements": {
    "minReputation": 80,
    "capabilities": ["gpu", "ai"]
  }
}
```

#### Get Router Stats
```bash
GET http://localhost:4000/stats
```

Response:
```json
{
  "totalJobs": 42,
  "pending": 5,
  "running": 3,
  "completed": 34,
  "failed": 0,
  "peers": 12,
  "reputation": 95
}
```

### GraphQL API (The Graph)

Query indexed blockchain data:

```bash
POST http://localhost:8000/subgraphs/name/synapse-local
Content-Type: application/json

{
  "query": "{
    jobs(where: {status: COMPLETED}, first: 10) {
      id
      jobType
      payment
      creator {
        id
      }
      worker {
        id
      }
    }
  }"
}
```

### IPFS Service API

#### Upload File
```bash
POST http://localhost:5002/upload
Content-Type: multipart/form-data

file: <binary>
```

Response:
```json
{
  "cid": "Qm...",
  "size": 1024,
  "pinned": true
}
```

#### Pin CID
```bash
POST http://localhost:5002/pin
Content-Type: application/json

{
  "cid": "Qm..."
}
```

## Smart Contracts

### JobManager.sol
Manages job lifecycle on-chain:
- `createJob()` - Create new job with escrow
- `assignJob()` - Assign job to worker
- `completeJob()` - Submit result and release payment
- `cancelJob()` - Cancel pending job

### RateLimiter.sol
Smart contract-based rate limiting:
- `getRateLimit(address)` - Get user's rate limits
- `checkAndUpdateRateLimit(address)` - Check quota and increment
- `setCustomQuota()` - Set custom limits for user

### Reputation.sol
Tracks user reputation:
- `getReputation(address)` - Get current score
- `updateReputation()` - Adjust score (onlyJobManager)

## Development

### Local Development (without Docker)

```bash
# Terminal 1: Start local Ethereum node
anvil --fork-url $MAINNET_RPC

# Terminal 2: Start IPFS
go-ipfs daemon

# Terminal 3: Start API Gateway
cd api-gateway
npm install
npm run dev

# Terminal 4: Start Job Router
cd job-router
npm install
npm run dev

# Terminal 5: Start IPFS Service
cd ipfs-service
npm install
npm run dev
```

### Running Tests

```bash
# API Gateway tests
cd api-gateway
npm test

# Job Router tests
cd job-router
npm test

# Smart contract tests
cd contracts
forge test
```

### Subgraph Development

```bash
cd subgraph

# Generate types from schema
npm run codegen

# Build
npm run build

# Deploy locally
npm run create-local synapse-local
npm run deploy-local synapse-local

# Deploy to hosted service (production)
npm run deploy
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RPC_URL` | Ethereum RPC endpoint | http://localhost:8545 |
| `IPFS_API_URL` | IPFS API endpoint | http://localhost:5001 |
| `JWT_SECRET` | JWT signing secret | (required) |
| `RATE_LIMIT_CONTRACT` | Rate limiter contract address | (optional) |
| `JOB_CONTRACT` | Job manager contract address | (optional) |
| `NETWORK_ID` | P2P network identifier | mainnet-v1 |
| `BOOTSTRAP_PEERS` | Comma-separated bootstrap multiaddrs | (optional) |

### P2P Bootstrap

To bootstrap the mesh network, configure bootstrap peers:

```bash
# .env
BOOTSTRAP_PEERS=/ip4/1.2.3.4/tcp/10000/p2p/12D3...,/ip4/5.6.7.8/tcp/10000/p2p/12D3...
```

Or use the built-in DHT discovery.

## Monitoring

Enable monitoring stack:

```bash
docker-compose --profile monitoring up -d prometheus grafana
```

Access:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

## Architecture Decisions

### No Central Database
- All state stored on blockchain or IPFS
- Rate limits enforced via smart contracts
- User profiles derived from on-chain data

### Wallet-Only Authentication
- No email/password or KYC
- SIWE for secure wallet verification
- JWT tokens for session management

### P2P Job Routing
- libp2p for decentralized peer discovery
- GossipSub for job broadcast
- Direct streams for job assignment

### IPFS for Storage
- Job inputs/outputs stored on IPFS
- Content-addressed results
- Configurable pinning services

## Security Considerations

1. **Private Keys:** Never commit private keys. Use environment variables.
2. **JWT Secret:** Use strong, random secret in production.
3. **Rate Limiting:** Both express-rate-limit and contract-based limits apply.
4. **CORS:** Configure allowed origins in production.
5. **IPFS:** Use private swarm key for sensitive deployments.

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs -f [service-name]

# Reset everything
docker-compose down -v
docker-compose up -d
```

### P2P connection issues
```bash
# Check peer count
curl http://localhost:4000/stats

# Restart job router
docker-compose restart job-router
```

### Subgraph indexing issues
```bash
# Check Graph Node logs
docker-compose logs graph-node

# Rebuild subgraph
cd subgraph && npm run build && npm run deploy-local
```

## License

MIT License - See LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Resources

- [libp2p Documentation](https://docs.libp2p.io/)
- [The Graph Documentation](https://thegraph.com/docs/)
- [IPFS Documentation](https://docs.ipfs.tech/)
- [SIWE Specification](https://login.xyz/)
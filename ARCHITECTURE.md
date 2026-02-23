# Synapse Network Architecture

**Version**: Production v1.0  
**Last Updated**: 2026-02-23  
**Status**: Implemented (not aspirational)

---

## System Overview

Synapse is a decentralized AI inference marketplace where:
1. **Users** deposit HSK tokens, get API keys, call OpenAI-compatible endpoints
2. **Nodes** (GPU miners) run inference, earn HSK rewards
3. **Router** distributes jobs, verifies receipts, prevents fraud
4. **Settlement** aggregates earnings, publishes Merkle roots, enables claims

---

## Repository Structure

```
/
├── hsk-contracts/          # Solidity contracts (Foundry)
│   ├── src/
│   │   ├── HSKToken.sol    # ERC20 with permit
│   │   ├── Treasury.sol    # Timelocked minting
│   │   ├── ComputeEscrow.sol   # User deposits & charging
│   │   ├── NodeRewards.sol     # Epoch-based Merkle claims
│   │   └── NodeRegistry.sol    # Node staking & slashing
│   └── test/               # Foundry tests
│
├── services/
│   ├── gateway-api/        # OpenAI-compatible API
│   │   ├── src/
│   │   │   ├── index.ts    # Fastify server
│   │   │   ├── db/         # SQLite/Postgres
│   │   │   ├── security/   # Rate limiting, auth
│   │   │   └── observability/  # Prometheus, logging
│   │   └── prisma/         # Schema migrations
│   │
│   ├── router/             # Job distribution
│   │   ├── src/
│   │   │   ├── index.ts    # WebSocket router
│   │   │   ├── scoring.ts  # Node selection algorithm
│   │   │   ├── federation.ts   # Regional coordination
│   │   │   └── challenge.ts    # Fraud detection
│   │   └── test/           # Unit tests
│   │
│   ├── node-agent/         # Miner software
│   │   ├── src/
│   │   │   └── index.ts    # Dockerized agent
│   │   └── Dockerfile
│   │
│   ├── settlement/         # Reward calculation
│   │   ├── src/
│   │   │   ├── index.ts    # Epoch pipeline
│   │   │   └── merkle.ts   # Tree generation
│   │   └── test/
│   │
│   ├── billing/            # Usage tracking
│   │   └── src/
│   │       └── index.ts
│   │
│   └── web-ui/             # React frontend
│       ├── src/
│       │   ├── App.tsx     # 3-tab UI
│       │   └── components/
│       └── index.html
│
├── infra/
│   ├── k8s/                # Kubernetes manifests
│   ├── terraform/          # AWS infrastructure
│   ├── caddy/              # TLS termination
│   └── security-audit/     # Runbooks, checklists
│
├── tests/
│   └── load/               # k6 load tests
│
├── synapse-landing/        # Terminal-style landing
│   └── index.html
│
├── scripts/                # Deployment & ops
│   ├── install.sh          # One-liner node install
│   ├── smoke-test.sh
│   └── security-runbook.sh
│
└── docker-compose.yml      # Local dev stack
```

---

## Smart Contracts

### HSKToken
- **Purpose**: Settlement token for the network
- **Key Features**:
  - ERC20 with EIP-2612 permit (gasless approvals)
  - Pausable transfers
  - Minting controlled by Treasury only
  - Max supply: 1B HSK

### Treasury
- **Purpose**: Controlled token issuance
- **Key Features**:
  - 2-day timelock for sensitive operations
  - Daily mint cap: 10M HSK
  - Operator roles for routine operations
  - Whitelisted minters for instant mints

### ComputeEscrow
- **Purpose**: User deposits and charging
- **Key Features**:
  - Users deposit HSK as prepayment
  - Gateway charges per job completion
  - 1-day withdrawal timelock
  - Batch charging for efficiency

### NodeRegistry
- **Purpose**: Node authentication and staking
- **Key Features**:
  - Nodes register with Ed25519 pubkey
  - 10,000 HSK minimum stake
  - Slashing for fraud (50% of stake)
  - Nonce registry for replay protection
  - Health score tracking

### NodeRewards
- **Purpose**: Epoch-based reward distribution
- **Key Features**:
  - 7-day epochs (configurable)
  - Merkle tree distribution
  - Nodes claim with Merkle proofs
  - 90-day claim expiration
  - Batch claiming support

---

## Services

### Gateway API
**Responsibilities**:
- OpenAI-compatible REST API
- API key validation (Argon2id hashed)
- Rate limiting (100 req/min per key)
- IP-based abuse detection
- Request metering
- Stream responses to users

**Authentication**:
- API keys in `Authorization: Bearer` header
- Ed25519 signatures for internal service auth
- mTLS between gateway and router

**Endpoints**:
- `GET /v1/models` - List available models
- `POST /v1/chat/completions` - Main inference endpoint (streaming)
- `GET /v1/usage` - User usage stats
- `POST /v1/keys` - Generate API key (requires wallet)

### Router
**Responsibilities**:
- Job distribution to nodes
- Node health tracking
- Challenge job insertion (fraud detection)
- Receipt verification
- Regional federation support

**Scoring Algorithm**:
```
score = success_rate * health / (1 + latency_penalty) / price_factor
```

**Challenge Jobs**:
- 1% of traffic is canary jobs with known expected outputs
- Failed challenges reduce node health
- Repeated failures trigger slashing

**Federation Modes**:
- **Regional**: Handles local nodes, reports to coordinator
- **Coordinator**: Global view, distributes snapshots

### Node Agent
**Responsibilities**:
- Connect to router via WebSocket
- Run inference (vLLM or fallback)
- Sign receipts with Ed25519
- Report metrics (tok/s, VRAM, queue depth)
- Auto-reconnect on disconnect

**Receipt Format**:
```json
{
  "job_id": "uuid",
  "prompt_hash": "sha256",
  "output_hash": "sha256",
  "tokens_in": 100,
  "tokens_out": 50,
  "served_model": "deepseek-v3",
  "timestamp": 1234567890,
  "nonce": 42,
  "node_signature": "ed25519_sig"
}
```

### Settlement Service
**Responsibilities**:
- Ingest receipts from router
- Verify signatures against NodeRegistry
- Check nonces for replay protection
- Aggregate per-node earnings per epoch
- Apply protocol fee (10%)
- Generate Merkle trees
- Publish roots on-chain

**Epoch Pipeline**:
1. Collect receipts for epoch
2. Validate signatures + nonces
3. Sum earnings per node
4. Deduct protocol fee
5. Build Merkle tree
6. Submit root to NodeRewards contract
7. Store proofs for node queries

### Billing Service
**Responsibilities**:
- Track usage per API key
- Calculate costs based on tier
- Generate invoices
- Enforce daily token quotas

**Pricing Tiers**:
- Starter: $10 per 1M tokens
- Growth: $8 per 1M tokens (1M+ tokens)
- Scale: $6 per 1M tokens (10M+ tokens)
- Enterprise: $4 per 1M tokens (100M+ tokens)

---

## Data Flow

### User Request Flow
```
1. User → Landing Page
   Enter ETH address → POST /v1/keys
   
2. Gateway API
   - Validate wallet signature
   - Create API key (Argon2id hash)
   - Return key to user

3. User → POST /v1/chat/completions
   Authorization: Bearer <key>
   
4. Gateway API
   - Validate key
   - Check quota
   - Forward to Router

5. Router
   - Select best node (scoring algorithm)
   - Send job via WebSocket
   
6. Node Agent
   - Run inference (vLLM)
   - Stream chunks back
   - Sign receipt

7. Router → Gateway → User
   - Stream response chunks
   - Include synapse_meta header

8. Settlement (async)
   - Verify receipt signature
   - Record usage
   - Charge ComputeEscrow
```

### Miner Reward Flow
```
1. Daily Epoch Close
   Settlement aggregates receipts
   
2. Calculate Rewards
   - Sum tokens per node
   - Apply success rate multiplier
   - Deduct 10% protocol fee
   
3. Build Merkle Tree
   - Leaf: keccak256(wallet, amount)
   - Publish root to NodeRewards
   
4. Node Claims
   - Query settlement for proof
   - Call NodeRewards.claim()
   - Receive HSK tokens
```

---

## Security Model

### Authentication Layers
1. **User → Gateway**: API key (Argon2id)
2. **Gateway → Router**: mTLS + Ed25519 challenges
3. **Router → Node**: Ed25519 signed receipts
4. **Service → Contract**: Wallet signatures

### Fraud Prevention
1. **Challenge Jobs**: 1% canary traffic with known outputs
2. **Receipt Verification**: All receipts signed and nonce-checked
3. **Slashing**: 50% stake penalty for provable fraud
4. **Health Scoring**: Aggressive penalties for failures

### Rate Limiting
- Per-key: 100 req/min
- Per-IP: 200 req/min  
- Global: 10k req/sec
- Abuse detection with auto-blocking

---

## Economics

### User Side
- Deposit HSK into ComputeEscrow
- Pay per token used (tiered pricing)
- 1-day withdrawal timelock

### Miner Side
- Stake 10,000 HSK to register
- Earn per token processed (weighted by success rate)
- Rewards claimable after epoch close

### Protocol Revenue
- 10% fee on all user payments
- 50% of slashed stake
- Treasury controlled emissions

---

## Infrastructure

### Local Dev
```bash
docker-compose up
```
- SQLite database
- Single-node router
- No TLS (HTTP only)

### Staging
- EKS cluster (3 nodes)
- RDS PostgreSQL
- ElastiCache Redis
- Let's Encrypt TLS

### Production
- Multi-region EKS
- Aurora PostgreSQL (HA)
- Global router federation
- CloudFlare DDoS protection

---

## Deployment

### Contract Deployment
```bash
cd hsk-contracts
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

### Service Deployment
```bash
# Kubernetes
kubectl apply -f infra/k8s/

# Terraform
terraform -chdir=infra/terraform apply
```

---

## Testing

### Contract Tests
```bash
cd hsk-contracts
forge test
```

### Integration Tests
```bash
./scripts/smoke-test.sh
```

### Load Tests
```bash
k6 run tests/load/spike-test.js
```

---

## Operational Runbooks

See `/infra/security-audit/`:
- `security-runbook.sh` - Incident response
- `CHECKLIST.md` - Pre-launch security audit
- `README.md` - Audit preparation guide

---

## Known Limitations

1. **Privacy**: Not private by default. Client-side encryption or TEEs required for privacy.
2. **Finality**: Receipts are optimistically accepted; challenges may retroactively slash.
3. **Centralization**: Treasury and admin keys are centralized (timelocked).
4. **Censorship**: Router can technically censor nodes (mitigated by federation).

---

## Next Development Priorities

1. TEE integration for privacy-preserving inference
2. DAO transition for treasury control
3. Additional model support (Llama, Claude, etc.)
4. Mobile SDK for edge device inference

---

*This document reflects implemented code. Do not add aspirational features here.*

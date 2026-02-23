# Synapse Architecture

## System Overview

Synapse is a decentralized AI inference network that connects clients needing AI inference with nodes providing GPU/CPU compute resources.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SYNAPSE NETWORK                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐    │
│  │   Client     │────▶│  Gateway API │────▶│  Router (Load Balancer)  │    │
│  │  (Web/Mobile)│◄────│   (Port 3001)│◄────│     (Port 3002)          │    │
│  └──────────────┘     └──────────────┘     └────────────┬─────────────┘    │
│                                                         │                    │
│                              WebSocket                  │                    │
│                              Job Distribution           │                    │
│                                                         ▼                    │
│                              ┌─────────────────────────────────────────┐    │
│                              │         Inference Nodes                 │    │
│                              │  ┌──────────┐  ┌──────────┐  ┌────────┐ │    │
│                              │  │ Node #1  │  │ Node #2  │  │Node #N │ │    │
│                              │  │(GPU/vLLM)│  │(GPU/vLLM)│  │(CPU)   │ │    │
│                              │  └──────────┘  └──────────┘  └────────┘ │    │
│                              └─────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Gateway API (`services/gateway-api`)

**Purpose**: Client-facing REST API (OpenAI-compatible)

**Port**: 3001

**Responsibilities**:
- API key management
- Request validation
- Authentication/authorization
- Usage tracking
- Billing/receipts
- Rate limiting

**Key Features**:
- OpenAI API compatibility (`/v1/chat/completions`)
- SQLite database for local state
- bcrypt-secured API keys
- Zod input validation
- Fastify rate limiting

**Tech Stack**:
- Fastify 4.x
- better-sqlite3
- bcryptjs
- Zod

```
┌─────────────────────────────────────────┐
│           Gateway API                   │
├─────────────────────────────────────────┤
│  Auth Middleware                        │
│  ├── Bearer token extraction            │
│  ├── API key validation (bcrypt)        │
│  └── Rate limiting (100 req/min)        │
│                                         │
│  Routes                                 │
│  ├── POST /auth/api-key                 │
│  ├── POST /v1/chat/completions          │
│  ├── GET  /v1/models                    │
│  ├── GET  /stats                        │
│  ├── GET  /usage                        │
│  └── GET  /health                       │
│                                         │
│  Database                               │
│  ├── api_keys (hashed)                  │
│  ├── usage_events                       │
│  └── nodes (cache)                      │
└─────────────────────────────────────────┘
```

### 2. Router (`services/router`)

**Purpose**: Intelligent job distribution to nodes

**Port**: 3002

**Responsibilities**:
- Node registration via WebSocket
- Health monitoring
- Job routing algorithm
- Reliability tracking
- Failover handling

**Key Features**:
- WebSocket-based node communication
- Health score tracking per node
- Success rate monitoring
- Automatic failover
- Stale job cleanup

**Routing Algorithm**:

```
Score = (success_rate × health_score × 100) 
        ÷ (1 + latency_penalty) 
        ÷ price_factor

Where:
- latency_penalty = min(avg_latency_ms / 1000, 10)
- price_factor = 1 + (price_per_1m / 0.01)
```

**Node Selection Criteria**:
1. Model availability
2. Health score > 0.3
3. Success rate > 0.5
4. Load < concurrency

**Tech Stack**:
- Fastify 4.x
- @fastify/websocket
- In-memory node registry

```
┌─────────────────────────────────────────┐
│              Router                     │
├─────────────────────────────────────────┤
│  WebSocket Server (Port 3002)           │
│  ├── Node Registration                  │
│  ├── Heartbeat Monitoring               │
│  └── Job Distribution                   │
│                                         │
│  Job Dispatcher                         │
│  ├── Score nodes by reliability         │
│  ├── Try best node first                │
│  ├── Automatic retry on failure         │
│  └── Fallback to echo-stub              │
│                                         │
│  Health Monitor (3s interval)           │
│  ├── Remove dead nodes (15s timeout)    │
│  └── Cleanup stale jobs (35s timeout)   │
│                                         │
│  Node Stats per Node:                   │
│  ├── healthScore (0-1)                  │
│  ├── successRate (0-1)                  │
│  ├── avgLatencyMs                       │
│  └── totalJobs / successfulJobs         │
└─────────────────────────────────────────┘
```

### 3. Node Agent (`services/node-agent`)

**Purpose**: Run inference workloads

**Responsibilities**:
- Connect to router via WebSocket
- Register capabilities
- Execute inference jobs
- Sign receipts for verification
- Send heartbeats

**Profiles**:

| Profile | Hardware | Models | Use Case |
|---------|----------|--------|----------|
| `echo-stub` | Any CPU | echo-stub | Testing, fallback |
| `vllm` | NVIDIA GPU 24GB+ | deepseek-v3 | Production inference |

**Receipt Signing**:
- Ed25519 keypair generated on startup
- Signs: jobId, nodeId, promptHash, outputHash, tokens, timestamp
- Prevents fraud via verifiable receipts

**Tech Stack**:
- Node.js 20
- ws (WebSocket client)
- crypto (Ed25519 signing)
- dotenv

```
┌─────────────────────────────────────────┐
│           Node Agent                    │
├─────────────────────────────────────────┤
│  WebSocket Client                       │
│  ├── Connect to Router                  │
│  ├── REGISTER with capabilities         │
│  ├── Send HEARTBEAT (10s)               │
│  └── Receive/Process JOBS               │
│                                         │
│  Inference Handlers                     │
│  ├── echo-stub: CPU echo                │
│  └── vLLM: GPU inference                │
│      └── HTTP to vLLM container         │
│                                         │
│  Receipt Generation                     │
│  ├── SHA-256 hash of prompt/output      │
│  ├── Ed25519 signature                  │
│  └── Return signed result               │
│                                         │
│  Auto-reconnect                         │
│  └── Exit on disconnect (Docker restart)│
└─────────────────────────────────────────┘
```

### 4. Web UI (`services/web-ui`)

**Purpose**: User-facing web interface

**Port**: 3000

**Responsibilities**:
- API key generation UI
- Usage statistics display
- Network status visualization

**Tech Stack**:
- React 18
- Vite
- TypeScript

---

## Data Flow

### 1. Chat Completion Request

```
┌────────┐   ┌─────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│ Client │──▶│ Gateway │──▶│ Router │──▶│  Node  │──▶│  vLLM  │
└────────┘   └─────────┘   └────────┘   └────────┘   └────────┘
    │            │            │            │            │
    │  POST /v1  │  dispatch  │   JOB      │  HTTP      │
    │  /chat/    │   HTTP     │ WebSocket  │  POST      │
    │ completions│            │            │ /v1/chat/  │
    │            │            │            │ completions│
    │            │            │            │            │
    │            │◄─ signed ──┤◄─ RESULT ──┤◄─ JSON ────┘
    │            │  receipt   │ WebSocket  │
    │◄─ OpenAI ──┘            │            │
    │  response               │            │
    └─────────────────────────┴────────────┘
```

### 2. Node Registration

```
┌────────┐                        ┌────────┐
│  Node  │───────────────────────▶│ Router │
└────────┘   WebSocket /ws         └────────┘
    │                                   │
    │  {type: "REGISTER",               │
    │   nodeId, wallet,                 │
    │   models, pricePer1m}             │
    │──────────────────────────────────▶│
    │                                   │
    │◄─ {type: "REGISTERED",            │
    │    nodeId, models}                │
    │                                   │
    │  {type: "HEARTBEAT", ...}  (10s)  │
    │──────────────────────────────────▶│
```

### 3. Job Execution with Receipt

```
┌────────┐     ┌────────┐     ┌────────┐
│ Router │────▶│  Node  │────▶│  Job   │
└────────┘     └────────┘     └────────┘
    │              │              │
    │ JOB          │ execute      │
    │─────────────▶│─────────────▶│
    │              │              │
    │              │              │
    │              │◄─────────────│ result
    │              │              │
    │              │ generate     │
    │              │ receipt:     │
    │              │ - promptHash │
    │              │ - outputHash │
    │              │ - signature  │
    │              │              │
    │◄─ RESULT ────┘              │
    │  (signed)                   │
```

---

## Database Schema

### API Keys Table

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,           -- UUID
  key_hash TEXT NOT NULL UNIQUE, -- bcrypt hash
  key_id_prefix TEXT,            -- Fast lookup prefix
  owner_email TEXT,
  owner_wallet TEXT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,            -- NULL if active
  last_used_at INTEGER,
  use_count INTEGER DEFAULT 0
);

CREATE INDEX idx_api_keys_prefix ON api_keys(key_id_prefix);
```

### Usage Events Table

```sql
CREATE TABLE usage_events (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  cost_estimate REAL NOT NULL,
  status TEXT NOT NULL,          -- 'success' | 'error'
  created_at INTEGER NOT NULL,
  prompt_hash TEXT,              -- For verification
  output_hash TEXT,
  receipt_json TEXT,             -- Signed receipt
  FOREIGN KEY (key_id) REFERENCES api_keys(id)
);
```

### Nodes Cache Table

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  status TEXT NOT NULL,
  models TEXT NOT NULL,          -- JSON array
  price_per_1m REAL NOT NULL,
  concurrency INTEGER NOT NULL,
  hardware TEXT,
  last_seen INTEGER NOT NULL,
  uptime_score REAL DEFAULT 1.0
);
```

---

## Security Architecture

### Authentication Layers

```
┌─────────────────────────────────────────────────┐
│ Level 1: Transport                              │
│ ├── HTTPS/WSS in production                     │
│ └── TLS termination at reverse proxy            │
├─────────────────────────────────────────────────┤
│ Level 2: API Key (Gateway)                      │
│ ├── Bearer token authentication                 │
│ ├── bcrypt-secured key storage                  │
│ └── Rate limiting (100 req/min)                 │
├─────────────────────────────────────────────────┤
│ Level 3: Router Secret (optional)               │
│ ├── X-Router-Secret header                      │
│ └── Protects dispatch endpoint                  │
├─────────────────────────────────────────────────┤
│ Level 4: Receipt Signing (Nodes)                │
│ ├── Ed25519 signatures                          │
│ └── Prevents result forgery                     │
└─────────────────────────────────────────────────┘
```

### Threat Model

| Threat | Mitigation |
|--------|------------|
| API key theft | bcrypt hashing, rate limiting |
| DDoS | Rate limiting, body size limits |
| Node impersonation | Receipt signatures |
| Result tampering | Hash verification |
| Replay attacks | Nonce in receipts |
| SQL injection | Parameterized queries |

---

## Scaling Considerations

### Horizontal Scaling

**Gateway API**:
- Stateless, can run multiple instances
- Requires shared database or external DB

**Router**:
- Currently single instance (stateful WebSocket connections)
- Could shard by model type or geography

**Nodes**:
- Naturally horizontally scalable
- Each node is independent

### Vertical Scaling

**vLLM Optimization**:
- Tensor parallelism for multi-GPU
- Quantization (AWQ, GPTQ) for memory efficiency
- Continuous batching for throughput

---

## Deployment Options

### Single Machine (Development)

```bash
docker compose up -d
```

### GPU Node (Production)

```bash
docker compose --profile gpu up -d
```

### Kubernetes (Future)

See `deployment/k8s/` for Kubernetes manifests.

---

## Monitoring & Observability

### Health Endpoints

| Service | Endpoint | Purpose |
|---------|----------|---------|
| Gateway | `/health` | Service health |
| Router | `/health` | Node count |
| Router | `/stats` | Detailed stats |

### Key Metrics

- Request rate (req/s)
- Latency percentiles (p50, p95, p99)
- Error rate
- Node health scores
- Token throughput

---

## Future Enhancements

1. **Streaming Support** - SSE for real-time responses
2. **Model Marketplace** - Dynamic model loading
3. **Payment Integration** - On-chain payments
4. **Federation** - Multiple router coordination
5. **Cache Layer** - Redis for distributed state
6. **Metrics** - Prometheus/Grafana integration

---

## Related Documentation

- [API.md](./API.md) - API Reference
- [OPERATOR.md](./OPERATOR.md) - Node Operator Guide
- [../README.md](../README.md) - Project Overview

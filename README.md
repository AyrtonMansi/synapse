# Synapse

Decentralized AI inference marketplace. Access DeepSeek V3 and other models via OpenAI-compatible API. Run GPU nodes, earn HSK tokens.

## Quick Start (Production)

### Prerequisites
- Docker & Docker Compose
- For GPU nodes: NVIDIA drivers + nvidia-docker

### Run Synapse

```bash
# Clone
git clone https://github.com/AyrtonMansi/synapse.git
cd synapse

# CPU mode (no GPU required)
docker compose up -d

# GPU mode (DeepSeek V3 inference)
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

### Verify Installation

```bash
# Run smoke tests
./scripts/smoke-test.sh        # CPU
./scripts/smoke-test-gpu.sh    # GPU (requires GPU host)

# Check status
curl http://localhost:3001/health
curl http://localhost:3002/stats
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Web UI    │────▶│ Gateway API  │────▶│   Router    │
│ (Port 3000) │     │ (Port 3001)  │     │ (Port 3002) │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                  │
                       ┌──────────────────────────┘
                       │
              ┌────────▼─────────┐
              │   Node Agents    │
              │ (GPU/CPU nodes)  │
              └──────────────────┘
```

## Services

| Service | Path | Port | Description |
|---------|------|------|-------------|
| **gateway-api** | `/services/gateway-api` | 3001 | OpenAI-compatible API, auth, billing |
| **router** | `/services/router` | 3002 | Node registry, job dispatch, scoring |
| **node-agent** | `/services/node-agent` | - | GPU/CPU inference node |
| **web-ui** | `/services/web-ui` | 3000 | Developer portal |

## Landing Page

The viral unlock landing page is standalone:

```bash
# Deploy to any static host
synapse-landing/index.html
```

## Development

### Structure

```
├── services/           # Canonical runtime (ONLY THIS)
│   ├── gateway-api/   # Node.js + Fastify
│   ├── router/        # Node.js + WebSocket
│   ├── node-agent/    # Node.js + vLLM client
│   └── web-ui/        # React + Vite
├── synapse-landing/   # Static landing page
├── scripts/           # Testing + utilities
├── docs/              # Documentation
└── archive/           # Legacy code (deprecated)
```

### Build from Source

```bash
cd services/gateway-api && npm install && npm run build
cd services/router && npm install && npm run build
cd services/node-agent && npm install && npm run build
cd services/web-ui && npm install && npm run build
```

### Testing

```bash
# Unit tests
npm test

# Integration tests
./scripts/integration-test.sh

# Load tests
./scripts/load-test.sh
```

## API Usage

### Generate API Key

```bash
curl -X POST http://localhost:3001/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0xYourWalletAddress"}'
```

### Chat Completion

```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v3",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Run a Node

### Quick Install

```bash
curl -sSL https://synapse.sh/install | bash
```

### Docker

```bash
docker run -d \
  -e ROUTER_URL=ws://router:3002/ws \
  -e NODE_WALLET=0xYourWallet \
  -e MODEL_PROFILE=vllm \
  --gpus all \
  ghcr.io/ayrtonmansi/synapse-node-agent:latest
```

## Production

See `/docs/production.md` for:
- TLS/mTLS setup
- Horizontal scaling
- Database migration (Postgres)
- Smart contract deployment
- Observability

## Contributing

See `CONTRIBUTING.md` for development workflow.

## License

MIT

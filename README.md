# Synapse MVP

Decentralized AI inference network. Access DeepSeek V3, Llama, and more via API. Run nodes, earn rewards.

## Quick Start

```bash
# 1. Start all services
docker compose up -d

# 2. Run smoke tests
./scripts/smoke-test.sh
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Web UI | 3000 | Minimal gateway for API key generation |
| Gateway API | 3001 | OpenAI-compatible API endpoints |
| Router | 3002 | WebSocket node registry & job dispatch |
| Node Agent | - | Handles inference jobs (vLLM or stub) |

## API Usage

### Generate API Key
```bash
curl -X POST http://localhost:3001/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

### List Models
```bash
curl http://localhost:3001/v1/models
```

### Chat Completion
```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v3",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Run a Node

### Quick Install (Local)
```bash
./scripts/install.sh
```

### Production (GHCR Image)
```bash
curl -sSL https://synapse.sh/install | bash
```

### Docker Manual
```bash
docker run -d \
  -e ROUTER_URL=ws://host.docker.internal:3002/ws \
  -e NODE_WALLET=0xYourWalletAddress \
  -e MODEL_PROFILE=echo-stub \
  ghcr.io/ayrtonmansi/synapse-node-agent:latest
```

### With vLLM (DeepSeek V3)
```bash
# Start vLLM first
docker run -d --gpus all \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  --model deepseek-ai/DeepSeek-V3

# Start node agent
docker run -d \
  -e ROUTER_URL=ws://host.docker.internal:3002/ws \
  -e NODE_WALLET=0xYourWalletAddress \
  -e MODEL_PROFILE=vllm-deepseek-v3 \
  -e VLLM_URL=http://host.docker.internal:8000 \
  --gpus all \
  ghcr.io/ayrtonmansi/synapse-node-agent:latest
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Web UI    │────▶│ Gateway API  │────▶│   Router    │
│  (Port 3000)│     │  (Port 3001) │     │  (Port 3002)│
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
                    ┌─────────────┐             │
                    │  Node Agent │◀────────────┘
                    │ (vLLM/stub) │
                    └─────────────┘
```

## Acceptance Tests (via smoke-test.sh)

1. ✅ `docker compose up -d` starts all services
2. ✅ `POST /auth/api-key` returns API key (email & wallet)
3. ✅ `GET /v1/models` returns model list
4. ✅ `POST /v1/chat/completions` returns completion
5. ✅ `GET /stats` returns nodes/jobs/latency fields
6. ✅ Usage events persisted in SQLite
7. ✅ Router tracks nodes via WebSocket
8. ✅ Parallel test: 10 concurrent requests, >=9 succeed
9. ✅ Usage stats reflect requests

## Router Reliability

- Success rate tracking per node
- Aggressive penalty on failure (0.5x health)
- Rolling latency average
- Automatic failover
- Pending job cleanup on disconnect

## Node Profiles

| Profile | Description |
|---------|-------------|
| `echo-stub` | CPU fallback, echoes input |
| `vllm-deepseek-v3` | GPU inference via vLLM |

## Development

```bash
# Install dependencies
cd services/gateway-api && npm install
cd services/router && npm install
cd services/node-agent && npm install

# Run locally
npm run dev  # in each service directory
```
# Synapse MVP

Decentralized AI inference network. Access DeepSeek V3, Llama, and more via API.

## Quick Start

```bash
# Start all services
docker compose up -d

# Run smoke test
./scripts/smoke-test.sh
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Web UI | 3000 | Minimal gateway for API key generation |
| Gateway API | 3001 | OpenAI-compatible API endpoints |
| Router | 3002 | WebSocket node registry & job dispatch |
| Node Agent | - | Handles inference jobs (stub mode) |

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

```bash
# One-line installer
curl -sSL https://synapse.sh/install | bash

# Or manually with Docker
docker run -d \
  -e ROUTER_URL=ws://host.docker.internal:3002/ws \
  -e NODE_WALLET=0xYourWalletAddress \
  synapse-node-agent
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Web UI    │────▶│ Gateway API  │────▶│   Router    │
│  (Port 3000)│     │  (Port 3001) │     │  (Port 3002)│
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
                    ┌─────────────┐             │
                    │ Node Agent  │◀────────────┘
                    │ (Stub mode) │
                    └─────────────┘
```

## Acceptance Tests

All tests must pass:

1. ✅ `docker compose up -d` starts all services
2. ✅ `POST /auth/api-key` returns API key
3. ✅ `GET /v1/models` returns model list
4. ✅ `POST /v1/chat/completions` returns completion
5. ✅ Usage events persisted in SQLite
6. ✅ Router tracks nodes via WebSocket
7. ✅ Node agent handles jobs
8. ✅ Minimal gateway UI at `/`

Run tests: `./scripts/smoke-test.sh`
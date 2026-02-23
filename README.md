# Synapse MVP

Decentralized AI inference network. Access DeepSeek V3 via API. Run nodes, earn rewards.

## Quick Start

### CPU Quickstart (No GPU Required)

```bash
# 1. Clone and start
git clone https://github.com/AyrtonMansi/synapse.git
cd synapse
docker compose up -d

# 2. Verify services
./scripts/smoke-test.sh

# 3. Open Web UI → http://localhost:3000
#    - Generate API key
#    - Test inference
```

### GPU Quickstart (DeepSeek V3)

```bash
# 1. Ensure NVIDIA drivers + nvidia-docker installed

# 2. Start with GPU overlay
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d

# 3. Verify GPU inference
./scripts/smoke-test-gpu.sh
```

### Run a Node

```bash
# One-liner installer
curl -sSL https://synapse.sh/install | bash

# Or Docker
docker run -d \
  -e ROUTER_URL=ws://host.docker.internal:3002/ws \
  -e NODE_WALLET=0xYourWallet \
  -e MODEL_PROFILE=vllm \
  ghcr.io/ayrtonmansi/synapse-node-agent:latest
```

### Test Call

```bash
# 1. Generate API key (via Web UI or curl)
curl -X POST http://localhost:3001/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
# → Returns: syn_live_xxxxxxxxxxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 2. Call inference
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-v3", "messages": [{"role": "user", "content": "Hello"}]}'

# 3. Check served-model header
# x-synapse-model-served: deepseek-v3 (or echo-stub if fallback)
```

### Served-Model Transparency

Synapse explicitly tracks which model actually served your request:

| Header | Description |
|--------|-------------|
| `x-synapse-model-served` | Actual model that processed the request |
| `x-synapse-model-requested` | Model you asked for |
| `x-synapse-fallback` | `true` if routed to fallback (echo-stub) |

Response body includes:
```json
{
  "model": "deepseek-v3",
  "synapse_meta": {
    "requested_model": "deepseek-v3",
    "served_model": "deepseek-v3",
    "fallback": false,
    "node_id": "node-abc123",
    "receipt_verified": "valid"
  }
}
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Web UI | 3000 | Minimal gateway for API key generation |
| Gateway API | 3001 | OpenAI-compatible API |
| Router | 3002 | Node registry & job dispatch |

## API Usage

### Generate API Key
```bash
curl -X POST http://localhost:3001/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

### Chat Completion
```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-v3", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Run a Node

```bash
# Quick install
curl -sSL https://synapse.sh/install | bash

# Or with Docker
docker run -d \
  -e ROUTER_URL=ws://host.docker.internal:3002/ws \
  -e NODE_WALLET=0xYourWallet \
  ghcr.io/ayrtonmansi/synapse-node-agent:latest
```

## Acceptance Tests

Run `./scripts/smoke-test.sh` to verify:
- ✅ `GET /stats` returns all fields (nodes_online, jobs_today, jobs_total, etc.)
- ✅ API key generation (email & wallet)
- ✅ 10 parallel completions, >=9 succeed
- ✅ jobs_today increments correctly
- ✅ nodes_online >= 1

## Architecture

```
Web UI → Gateway API → Router → Node Agent (vLLM/stub)
```

## Features

- **OpenAI-compatible API**: Drop-in replacement
- **Node receipts**: prompt_hash, output_hash for anti-fraud
- **Health scoring**: success_rate, latency tracking, aggressive penalties
- **Automatic failover**: Routes around failing nodes
- **vLLM support**: GPU inference with DeepSeek V3
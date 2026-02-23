# Synapse MVP

Decentralized AI inference network. Access DeepSeek V3 via API. Run nodes, earn rewards.

## Quick Start

```bash
# 1. Clone and start
git clone https://github.com/AyrtonMansi/synapse.git
cd synapse
docker compose up -d

# 2. Run smoke tests
./scripts/smoke-test.sh
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
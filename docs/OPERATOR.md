# Synapse Node Operator Guide

This guide explains how to run a Synapse inference node and participate in the decentralized AI network.

## Table of Contents

1. [Overview](#overview)
2. [Requirements](#requirements)
3. [Quick Start](#quick-start)
4. [Configuration](#configuration)
5. [GPU Node Setup](#gpu-node-setup)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)
8. [Security Best Practices](#security-best-practices)

---

## Overview

A Synapse node provides AI inference services to the network. Nodes:

- Connect to the router via WebSocket
- Receive inference jobs from the gateway
- Execute models and return signed results
- Earn tokens based on usage and reliability

### Node Types

| Type | Hardware | Models | Earnings |
|------|----------|--------|----------|
| CPU Stub | Any CPU | echo-stub | Low (testing only) |
| vLLM GPU | NVIDIA GPU + 24GB+ VRAM | deepseek-v3 | High |

---

## Requirements

### Minimum Requirements (CPU Stub)

- 1 vCPU
- 512MB RAM
- 1GB storage
- Internet connection

### Recommended Requirements (vLLM GPU)

- 8+ vCPUs
- NVIDIA GPU with 24GB+ VRAM (A10, A100, H100)
- 32GB+ system RAM
- 100GB+ NVMe storage
- 100Mbps+ internet

### Software

- Docker 20.10+
- Docker Compose 2.0+
- NVIDIA Docker runtime (for GPU nodes)

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/AyrtonMansi/synapse.git
cd synapse
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

Minimum required in `.env`:

```bash
NODE_WALLET=0xYourEthereumWalletAddress
MODEL_PROFILE=echo-stub
NODE_ID=my-first-node
```

### 3. Start Node

**CPU Mode (testing):**

```bash
docker compose up -d node-agent
```

**GPU Mode (production):**

```bash
docker compose --profile gpu up -d
```

### 4. Verify Node is Running

```bash
# Check node status
curl http://localhost:3002/stats

# View logs
docker compose logs -f node-agent
```

You should see your node in the `nodeDetails` array.

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_WALLET` | Yes | - | Your Ethereum wallet address (for earnings) |
| `MODEL_PROFILE` | Yes | `echo-stub` | `echo-stub` or `vllm` |
| `NODE_ID` | Yes | random UUID | Unique identifier for your node |
| `ROUTER_URL` | No | `ws://router:3002/ws` | Router WebSocket URL |
| `VLLM_URL` | No | `http://localhost:8000/v1` | vLLM endpoint (GPU only) |

### Advanced Configuration

Create `docker-compose.override.yml` for custom settings:

```yaml
services:
  node-agent:
    environment:
      - NODE_WALLET=0xYourWallet
      - MODEL_PROFILE=vllm
      - NODE_ID=my-custom-node
      # Optional: Custom pricing
      - PRICE_PER_1M=0.0010
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '8'
          memory: 32G
```

---

## GPU Node Setup

### Prerequisites

1. **NVIDIA Drivers**: Version 525.60.13 or newer

```bash
# Verify driver installation
nvidia-smi
```

2. **NVIDIA Container Toolkit**:

```bash
# Install on Ubuntu
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

3. **Verify GPU Access in Docker**:

```bash
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

### vLLM Configuration

The vLLM service is configured in `docker-compose.yml`:

```yaml
vllm:
  image: vllm/vllm-openai:latest
  command: >
    --model deepseek-ai/DeepSeek-V3
    --tensor-parallel-size 1
    --dtype float16
    --max-model-len 4096
    --api-key sk-vllm-local
```

**Customize for your hardware:**

| Flag | Description |
|------|-------------|
| `--tensor-parallel-size` | Number of GPUs to use |
| `--dtype` | `float16` or `bfloat16` |
| `--max-model-len` | Maximum sequence length |
| `--quantization` | `awq` or `gptq` for quantized models |

Example for multi-GPU:

```yaml
command: >
  --model deepseek-ai/DeepSeek-V3
  --tensor-parallel-size 2
  --dtype bfloat16
  --max-model-len 8192
```

### Model Storage

Models are cached in the `huggingface-cache` Docker volume:

```bash
# Check cache size
docker system df -v

# Clear cache (warning: re-downloads models)
docker volume rm synapse_huggingface-cache
```

To use a custom model cache location:

```yaml
volumes:
  - /path/to/your/models:/root/.cache/huggingface
```

---

## Monitoring

### Node Health

View your node's health score and stats:

```bash
curl -s http://localhost:3002/stats | jq '.nodeDetails[] | select(.id == "your-node-id")'
```

**Key Metrics:**

| Metric | Description | Good Value |
|--------|-------------|------------|
| `healthScore` | Overall health (0-1) | >0.8 |
| `successRate` | Job success ratio | >0.95 |
| `avgLatencyMs` | Average response time | <500ms |
| `totalJobs` | Total jobs completed | Growing |

### Logs

```bash
# Follow node logs
docker compose logs -f node-agent

# Follow vLLM logs (GPU)
docker compose logs -f vllm

# View last 100 lines
docker compose logs --tail=100 node-agent
```

### Prometheus Metrics (Optional)

Add to `docker-compose.override.yml`:

```yaml
services:
  node-agent:
    ports:
      - "9090:9090"  # Metrics port
    environment:
      - METRICS_PORT=9090
      - METRICS_ENABLED=true
```

---

## Troubleshooting

### Node Not Appearing in Stats

1. Check connection to router:

```bash
docker compose logs node-agent | grep -i "connected\|error"
```

2. Verify router is accessible:

```bash
curl http://localhost:3002/health
```

3. Check for registration errors:

```bash
docker compose logs node-agent | grep -i "register"
```

### vLLM Not Starting

1. Verify GPU is available:

```bash
nvidia-smi
```

2. Check vLLM logs:

```bash
docker compose logs vllm
```

3. Common issues:
   - **Out of memory**: Reduce `--max-model-len` or use quantization
   - **CUDA errors**: Update NVIDIA drivers
   - **Model download fails**: Check internet connection

### Low Health Score

| Issue | Solution |
|-------|----------|
| `successRate` < 0.5 | Check model is loaded correctly |
| Frequent timeouts | Increase resources or reduce concurrency |
| `healthScore` drops | Check for errors in logs |

### Connection Drops

Nodes automatically reconnect. If connection is unstable:

1. Check network stability
2. Verify firewall allows WebSocket (port 3002)
3. Increase heartbeat interval (requires code change)

---

## Security Best Practices

### 1. Wallet Security

- **Use a dedicated node wallet** - Don't use your main wallet
- **Never share private keys** - Node only needs the address
- **Monitor wallet activity** - Watch for unexpected transactions

### 2. Network Security

```bash
# Run behind firewall
ufw default deny incoming
ufw allow 22/tcp      # SSH
ufw allow 3000/tcp    # Web UI (if needed)
ufw enable

# Use VPN for remote nodes
wireguard-go wg0
```

### 3. Container Security

```yaml
services:
  node-agent:
    read_only: true
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

### 4. Regular Updates

```bash
# Pull latest images
docker compose pull
docker compose up -d

# Update repository
git pull origin main
docker compose up -d --build
```

---

## Earnings & Economics

### How Earnings Work

1. Nodes are paid per 1M tokens processed
2. Default rate: $0.0015 per 1M tokens
3. Reliable nodes (high health score) get priority routing

### Optimizing Earnings

1. **Keep node online** - Health score affects routing
2. **Minimize latency** - Faster responses = more jobs
3. **Competitive pricing** - Lower rates may get more jobs
4. **High availability** - Downtime reduces reputation

### Tracking Earnings

Earnings are recorded on-chain. Check your wallet:

```bash
# View earnings via API (when implemented)
curl http://localhost:3001/node-earnings?wallet=0xYourWallet
```

---

## Support

- **Discord**: https://discord.gg/synapse
- **GitHub Issues**: https://github.com/AyrtonMansi/synapse/issues
- **Documentation**: https://docs.synapse.network

---

## License

MIT License - See LICENSE file

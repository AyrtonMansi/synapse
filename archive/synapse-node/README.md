# Synapse Node

Decentralized AI inference node for the Synapse Network. Run AI models on your GPU and earn rewards for providing compute to the network.

## Features

- **GPU Auto-Detection**: Automatically detects and utilizes NVIDIA GPUs
- **Model Auto-Download**: Downloads and caches models from HuggingFace Hub
- **vLLM Inference**: High-performance inference using vLLM engine
- **P2P Mesh Networking**: WebSocket-based peer-to-peer network communication
- **ZK Proof Generation**: Zero-knowledge proofs for verifiable work
- **Docker Support**: Containerized deployment with NVIDIA runtime
- **CLI Tool**: Easy wallet setup, node management, and monitoring

## Quick Start

### Prerequisites

- NVIDIA GPU with CUDA support (8GB+ VRAM recommended)
- NVIDIA Container Toolkit installed
- Docker and Docker Compose

### 1. Clone and Configure

```bash
cd synapse-node

cp .env.example .env
# Edit .env with your settings:
# - Set SYNAPSE_WALLET_PRIVATE_KEY
# - Set HUGGING_FACE_HUB_TOKEN (for gated models)
```

### 2. Start with Docker Compose

```bash
# Basic startup
docker-compose up -d

# With monitoring stack
docker-compose --profile monitoring up -d

# View logs
docker-compose logs -f synapse-node
```

### 3. Verify Node Status

```bash
# Install CLI tool
pip install -e .

# Check status
synapse node status

# View logs
synapse logs show -f
```

## CLI Usage

### Wallet Management

```bash
# Create a new wallet
synapse wallet create

# Import existing wallet
synapse wallet import

# Show wallet info
synapse wallet show
```

### Node Operations

```bash
# Register node
synapse node register --name my-node --stake 0.1

# Start node
synapse node start

# Check status
synapse node status

# Stop node
synapse node stop
```

### View Logs

```bash
# Show recent logs
synapse logs show

# Follow logs in real-time
synapse logs show -f

# Clear logs
synapse logs clear
```

### Check Earnings

```bash
# Show earnings summary
synapse earnings show

# View earnings history
synapse earnings history
```

## API Endpoints

The node exposes a REST API on port 8080:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/status` | GET | Detailed node status |
| `/inference` | POST | Run inference |
| `/models` | GET | List available models |
| `/models/{id}/load` | POST | Load a model |

### Example: Run Inference

```bash
curl -X POST http://localhost:8080/inference \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is the capital of France?",
    "model": "meta-llama/Llama-2-7b-chat-hf",
    "max_tokens": 256
  }'
```

## Configuration

Environment variables (all prefixed with `SYNAPSE_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_NAME` | synapse-node | Human-readable node name |
| `NETWORK_RPC_URL` | wss://mesh.synapse.network | Mesh network WebSocket URL |
| `API_PORT` | 8080 | API server port |
| `GPU_MEMORY_FRACTION` | 0.9 | Fraction of GPU memory to use |
| `DEFAULT_MODELS` | - | Comma-separated models to preload |
| `MAX_CONCURRENT_REQUESTS` | 32 | Max parallel inference requests |
| `PROOF_ENABLED` | true | Enable ZK proof generation |
| `WALLET_PRIVATE_KEY` | - | Ethereum wallet private key |

## Systemd Installation

For production deployments:

```bash
# Copy service file
sudo cp systemd/synapse-node.service /etc/systemd/system/

# Create user and directories
sudo useradd -r -s /bin/false synapse
sudo mkdir -p /opt/synapse /var/lib/synapse/models /var/log/synapse
sudo chown -R synapse:synapse /opt/synapse /var/lib/synapse /var/log/synapse

# Install application
sudo cp -r . /opt/synapse/
sudo -u synapse python3 -m venv /opt/synapse/venv
sudo -u synapse /opt/synapse/venv/bin/pip install -e /opt/synapse/src

# Configure environment
sudo cp .env /etc/synapse/node.env
sudo chmod 600 /etc/synapse/node.env

# Start service
sudo systemctl daemon-reload
sudo systemctl enable synapse-node
sudo systemctl start synapse-node

# Check status
sudo systemctl status synapse-node
sudo journalctl -u synapse-node -f
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Synapse Node                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   API Server │  │  Inference   │  │   GPU Mgr    │      │
│  │   (FastAPI)  │  │   (vLLM)     │  │   (NVML)     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │              │
│  ┌──────▼─────────────────▼─────────────────▼──────┐      │
│  │              Node Runtime                        │      │
│  └──────┬─────────────────┬─────────────────┬──────┘      │
│         │                 │                 │              │
│  ┌──────▼─────┐    ┌──────▼─────┐    ┌──────▼─────┐      │
│  │  Network   │    │   Proof    │    │   Model    │      │
│  │   Mesh     │    │    ZK      │    │   Manager  │      │
│  └────────────┘    └────────────┘    └────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Development

```bash
# Install development dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black src/
ruff check src/

# Type checking
mypy src/
```

## Troubleshooting

### GPU Not Detected

```bash
# Check NVIDIA driver
nvidia-smi

# Verify Docker runtime
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
```

### Model Download Issues

```bash
# Set HuggingFace token in .env
HUGGING_FACE_HUB_TOKEN=hf_...

# Or login manually
huggingface-cli login
```

### Connection Issues

```bash
# Check mesh connectivity
synapse node status

# View detailed logs
docker-compose logs -f synapse-node
```

## License

MIT License - See LICENSE file

## Support

- Documentation: https://docs.synapse.network
- Discord: https://discord.gg/synapse
- Issues: https://github.com/synapse-network/node/issues

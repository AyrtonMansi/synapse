# Node Setup Guide

## Prerequisites

### Hardware Requirements

#### Minimum (GPU Node)
- GPU: NVIDIA RTX 2080+ (8GB+ VRAM)
- CPU: 8 cores
- RAM: 32 GB
- Storage: 500 GB SSD
- Network: 100 Mbps
- OS: Ubuntu 22.04 LTS (recommended)

#### Recommended
- GPU: RTX 4090 or A100
- CPU: 16+ cores
- RAM: 64+ GB
- Storage: 2 TB NVMe
- Network: 1 Gbps

### Software Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install NVIDIA Docker (for GPU nodes)
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt update
sudo apt install -y nvidia-docker2
sudo systemctl restart docker

# Verify GPU access
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

## Installation

### Option 1: Automated Install

```bash
curl -sSL https://install.synapse.io | bash
```

### Option 2: Manual Install

```bash
# Download latest release
wget https://github.com/synapse-protocol/node/releases/latest/download/synapse-node-linux-amd64
chmod +x synapse-node-linux-amd64
sudo mv synapse-node-linux-amd64 /usr/local/bin/synapse-node

# Create config directory
mkdir -p ~/.synapse
```

## Configuration

### Create Config File

```bash
synapse-node init
```

Or manually create `~/.synapse/config.yaml`:

```yaml
node:
  name: "my-node-01"
  type: "gpu"
  region: "us-east-1"
  
blockchain:
  network: "mainnet"  # or "testnet"
  wallet_private_key: "${WALLET_PRIVATE_KEY}"  # Use env var
  
hardware:
  gpu:
    enabled: true
    device_ids: [0]  # GPU indices
  cpu:
    enabled: false
    
resources:
  max_concurrent_tasks: 4
  max_memory_gb: 28  # Leave some for OS
  
pricing:
  base_multiplier: 1.0  # 1.0 = market rate
  
monitoring:
  enabled: true
  prometheus_port: 9090
```

### Environment Variables

Create `~/.synapse/.env`:

```bash
WALLET_PRIVATE_KEY=your_private_key_here
SYNAPSE_API_KEY=your_api_key_here
```

### Stake Tokens

```bash
# Check current stake requirement
synapse-node requirements

# Stake tokens (interactive)
synapse-node stake --amount 50000

# Or specify all parameters
synapse-node stake \
  --amount 50000 \
  --network mainnet \
  --private-key $WALLET_PRIVATE_KEY
```

## Running the Node

### Start Node

```bash
# Foreground (for testing)
synapse-node run

# Background with systemd
sudo systemctl enable synapse-node
sudo systemctl start synapse-node
```

### Check Status

```bash
# Node status
synapse-node status

# Detailed status
synapse-node status --detailed

# View logs
synapse-node logs --follow

# Check metrics
synapse-node metrics
```

## Verification

### Health Check

```bash
# Run diagnostics
synapse-node doctor

# Check all components
synapse-node doctor --full
```

### Benchmark

```bash
# Run performance benchmarks
synapse-node benchmark

# View results
synapse-node benchmark --results
```

## Monitoring

### Dashboard Access

View your node at: https://dashboard.synapse.io/nodes/{node_id}

### Alerts Setup

```yaml
# ~/.synapse/alerts.yaml
alerts:
  - name: downtime
    condition: node.status != 'active'
    channels:
      - type: email
        to: admin@example.com
      - type: webhook
        url: https://hooks.slack.com/...
        
  - name: low_earnings
    condition: earnings.daily < 10
    threshold: 3  # days
```

## Updating

```bash
# Check for updates
synapse-node update --check

# Update to latest
synapse-node update

# Restart after update
sudo systemctl restart synapse-node
```

## Troubleshooting

### Node Won't Start

```bash
# Check logs
synapse-node logs --since=1h

# Verify configuration
synapse-node config validate

# Test blockchain connection
synapse-node test-connection
```

### TEE Issues

```bash
# Test TEE
synapse-node test-tee

# Reinstall drivers if needed
sudo apt install --reinstall linux-headers-$(uname -r)
```

### Low Task Assignment

```bash
# Check node score
synapse-node status --score

# View network competition
synapse-node network-stats

# Adjust pricing
synapse-node config set pricing.discount=5%
```

## Security Best Practices

1. **Use dedicated wallet** - Don't use your main wallet
2. **Enable firewall** - Only open necessary ports
3. **Regular updates** - Keep software current
4. **Monitor logs** - Watch for anomalies
5. **Backup keys** - Securely store recovery phrases

## Next Steps

- Join the node operator Discord channel
- Set up monitoring alerts
- Optimize your pricing strategy
- Scale with additional nodes

## Support

- Documentation: https://docs.synapse.io
- Discord: #node-operators channel
- Email: nodes@synapse.io

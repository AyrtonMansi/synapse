# 🚀 Synapse Frictionless Mining Setup

A complete, one-command setup system for deploying Synapse AI mining nodes with automatic configuration, GPU detection, and mobile monitoring.

## ✨ Features

### 1. One-Command Setup
```bash
curl -fsSL https://get.synapse.network/setup.sh | bash
```

This single command will:
- ✅ Detect your GPU (NVIDIA/AMD/Apple Silicon)
- ✅ Install Docker if not present
- ✅ Configure NVIDIA Container Toolkit automatically
- ✅ Detect optimal region via geolocation
- ✅ Create or import wallet
- ✅ Download optimized AI models
- ✅ Start the node automatically

### 2. Web-Based Setup Wizard
Visit `/setup` for a step-by-step visual guide:
- System requirement checks with visual feedback
- Wallet connection and configuration
- Node customization (name, region, stake)
- QR code for mobile setup continuation
- Browser-based installation option

### 3. Node Dashboard (`/node-dashboard`)
Real-time monitoring interface with:
- **Live GPU Metrics**: Temperature, utilization, power consumption
- **Earnings Visualization**: Charts and historical data
- **Job Queue**: Real-time job processing status
- **Payout History**: Track all reward distributions
- **Emergency Stop**: One-click node shutdown
- **Push Notifications**: Mobile alerts for earnings

### 4. Mobile PWA (`/mobile/`)
Progressive Web App for monitoring on-the-go:
- iOS & Android compatible
- Push notifications for new earnings
- Emergency stop button
- Real-time GPU stats
- Claim rewards from mobile

### 5. Comprehensive Documentation
- 📹 Video tutorials for all skill levels
- 🔧 Troubleshooting guides organized by category
- 💬 Community support links (Discord, Telegram, etc.)
- 📚 Detailed FAQ section

## 📁 Project Structure

```
synapse-node/
├── setup.sh              # One-command installer script
├── quickstart.sh         # Quick start helper
├── docker-compose.yml    # Docker configuration
└── src/                  # Node source code

synapse-frontend/
├── src/pages/
│   ├── SetupWizard.tsx       # Web setup wizard (/setup)
│   ├── NodeDashboard.tsx     # Real-time dashboard (/node-dashboard)
│   └── docs/
│       └── Documentation.tsx # Support & docs (/docs/support)
└── public/mobile/
    ├── index.html       # Mobile PWA
    ├── manifest.json    # PWA manifest
    └── sw.js            # Service worker
```

## 🛠️ Installation Options

### Option 1: One-Liner (Recommended)
```bash
curl -fsSL https://get.synapse.network/setup.sh | bash
```

### Option 2: With Custom Parameters
```bash
curl -fsSL https://get.synapse.network/setup.sh | bash -s -- \
  --name "my-node" \
  --region us-east-1 \
  --wallet 0x... \
  --stake 10000
```

### Option 3: Web Wizard
1. Visit https://app.synapse.network/setup
2. Follow the step-by-step guide
3. Copy the generated command or install via browser

### Option 4: Manual Docker
```bash
docker run -d --gpus all \
  -e SYNAPSE_NODE_NAME="my-node" \
  -e SYNAPSE_WALLET_ADDRESS="0x..." \
  -e SYNAPSE_STAKE_AMOUNT=10000 \
  synapse/node:latest
```

## 📊 Dashboard Features

### Real-Time Metrics
- GPU temperature with color-coded warnings
- Utilization percentage and power draw
- VRAM usage monitoring
- Network peer connections
- Block synchronization status

### Earnings Tracking
- Total earnings (SYN and USD equivalent)
- Pending rewards display
- Historical charts (24h/7d/30d/all)
- Job completion statistics
- Success rate monitoring

### Job Queue Visualization
- Running, queued, and completed jobs
- Model inference details
- Token processing counts
- Earnings per job
- Duration tracking

## 📱 Mobile App Features

### Monitoring
- Live GPU temperature and utilization
- Earnings counter
- Node status (active/paused/error)
- Uptime tracking

### Controls
- Emergency stop button
- Refresh node status
- Claim rewards
- Push notification settings

### Setup
- QR code scan for quick pairing
- Manual node ID entry
- Multiple node support

## 🔧 Troubleshooting

### Common Issues

#### GPU Not Detected
```bash
# Install NVIDIA drivers
sudo apt install nvidia-driver-535

# Install container toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt update && sudo apt install -y nvidia-container-toolkit
sudo systemctl restart docker
```

#### Permission Denied
```bash
sudo usermod -aG docker $USER
newgrp docker
```

#### Port Conflicts
```bash
# Check what's using port 8080
sudo lsof -i :8080

# Kill process or change Synapse port
export SYNAPSE_PORT=8081
```

## 📈 Hardware Requirements

| Tier | GPU | VRAM | Est. Earnings | Recommended For |
|------|-----|------|---------------|-----------------|
| Entry | GTX 1080 | 8GB | $50-100/mo | Beginners |
| Mid | RTX 4080 | 16GB | $200-400/mo | Hobbyists |
| High | RTX 4090 | 24GB | $500-1000/mo | Serious miners |
| Pro | A100 | 48GB | $1500-3000/mo | Professionals |
| Enterprise | H100 | 80GB | $5000-10000/mo | Data centers |

## 🔐 Security

- Private keys stored in `~/.synapse/.wallet.key` (0600 permissions)
- Encrypted communication with network
- Optional hardware wallet support (Ledger/Trezor)
- Emergency stop functionality

## 🤝 Community & Support

- **Discord**: https://discord.gg/synapse (50K+ members)
- **Telegram**: https://t.me/synapse_network (25K+ members)
- **GitHub**: https://github.com/synapse-network
- **Email**: support@synapse.network

## 📝 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Docker for containerization
- NVIDIA for GPU drivers and toolkit
- Web3 community for wallet integrations
- Contributors and beta testers

---

**Ready to start mining?** 
```bash
curl -fsSL https://get.synapse.network/setup.sh | bash
```

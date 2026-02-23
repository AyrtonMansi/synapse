# Synapse Runbook

## Local Development

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Python 3.10+ (for node software)
- Git

### Clone & Setup
```bash
git clone https://github.com/synapse-network/synapse.git
cd synapse

# Copy environment
cp .env.example .env
# Edit .env with your settings
```

### Start Local Development

#### Option 1: Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

#### Option 2: Manual Setup

**Smart Contracts:**
```bash
cd synapse-contracts
npm install
npx hardhat node  # Local blockchain
npx hardhat run scripts/deploy.ts --network localhost
```

**Backend:**
```bash
cd synapse-backend
npm install
docker-compose -f docker-compose.dev.yml up -d  # Redis, IPFS, PostgreSQL
npm run dev
```

**Frontend:**
```bash
cd synapse-frontend
npm install
npm run dev  # http://localhost:5173
```

**Node Software:**
```bash
cd synapse-node
pip install -r requirements.txt
python -m synapse_node start --wallet 0x... --dev
```

### Running Tests
```bash
# All tests
npm test

# Specific suites
npm run test:contracts
npm run test:integration
npm run test:e2e
```

## Deployment

### Testnet (Sepolia)

1. **Configure Environment**
```bash
export PRIVATE_KEY=your_private_key
export RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

2. **Deploy Contracts**
```bash
cd synapse-contracts
npx hardhat run scripts/deploy.ts --network sepolia
# Save contract addresses
```

3. **Deploy Backend**
```bash
cd synapse-backend
docker-compose -f docker-compose.testnet.yml up -d
```

4. **Deploy Frontend**
```bash
cd synapse-frontend
npm run build:ipfs
# Upload dist/ to IPFS
```

### Mainnet

⚠️ **WARNING: Production deployment**

1. **Full Security Audit Required**
- Complete all security fixes
- Third-party audit passed
- Bug bounty active

2. **Deploy Contracts**
```bash
cd synapse-contracts
npx hardhat run scripts/deploy.ts --network mainnet
```

3. **Verify Contracts**
```bash
npx hardhat verify --network mainnet CONTRACT_ADDRESS
```

4. **Deploy Infrastructure**
```bash
# Production docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

## Monitoring

### Local
```bash
# Start monitoring stack
cd monitoring
docker-compose up -d

# Access Grafana
open http://localhost:3001
```

### Production
- Grafana: https://grafana.synapse.network
- Status: https://status.synapse.network

## Troubleshooting

### Contract deployment fails
- Check ETH balance
- Verify RPC URL
- Check network congestion

### Node won't start
- Verify GPU: `nvidia-smi`
- Check Docker logs: `docker logs synapse-node`
- Verify wallet has stake

### API errors
- Check contract addresses in .env
- Verify backend is running
- Check rate limits

## Emergency Procedures

### Contract Pause
```bash
# Only DAO can execute
cd synapse-contracts
npx hardhat run scripts/emergency-pause.ts --network mainnet
```

### Rollback
```bash
# Revert to previous version
docker-compose pull
docker-compose up -d
```

## Support
- Discord: https://discord.gg/synapse
- Docs: https://docs.synapse.network
- Status: https://status.synapse.network

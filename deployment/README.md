# Synapse Network Deployment

This directory contains all scripts, configurations, and documentation for deploying Synapse Network to testnet and mainnet.

## Directory Structure

```
deployment/
├── testnet/              # Testnet deployment scripts
│   ├── deploy-testnet.js
│   ├── fund-test-accounts.js
│   ├── verify-testnet.sh
│   └── testnet-config.json
├── mainnet/              # Mainnet deployment scripts
│   ├── deploy-mainnet.js
│   ├── verify-mainnet.sh
│   ├── verify-gas-optimization.sh
│   ├── security-checklist.sh
│   └── mainnet-config.json
├── infrastructure/       # Docker Compose files
│   ├── docker-compose.ipfs.yml
│   ├── docker-compose.api.yml
│   └── docker-compose.monitoring.yml
├── subgraph/            # Subgraph deployment
│   ├── deploy-subgraph.sh
│   └── subgraph.template.yaml
├── configs/             # Configuration files
│   ├── prometheus.yml
│   └── alerts.yml
├── emergency/           # Emergency procedures
│   ├── emergency-pause.sh
│   └── rollback-procedure.sh
├── scripts/             # Utility scripts
│   ├── launch-sequence.sh
│   ├── health-check.sh
│   ├── verify-deployment.sh
│   ├── setup-ssl.sh
│   └── setup-backup.sh
└── docs/                # Documentation
    ├── launch-announcement.md
    └── support-procedures.md
```

## Quick Start

### Testnet Deployment (Sepolia)

```bash
cd deployment/testnet
node deploy-testnet.js
```

### Mainnet Deployment

```bash
# 1. Run security checklist
cd deployment/mainnet
./security-checklist.sh

# 2. Deploy contracts
node deploy-mainnet.js

# 3. Verify on Etherscan
./verify-mainnet.sh
```

### Infrastructure Setup

```bash
# Start all infrastructure
docker-compose -f deployment/infrastructure/docker-compose.ipfs.yml up -d
docker-compose -f deployment/infrastructure/docker-compose.api.yml up -d
docker-compose -f deployment/infrastructure/docker-compose.monitoring.yml up -d

# Run health checks
deployment/scripts/health-check.sh
```

## Complete Launch Sequence

```bash
# Full mainnet launch (all phases)
deployment/scripts/launch-sequence.sh
```

This will execute:
1. Pre-flight checks
2. Smart contract verification
3. Gas optimization check
4. Security checklist
5. Subgraph deployment
6. Infrastructure deployment
7. Health checks
8. SSL certificate setup
9. Backup procedures
10. Final verification

## Contract Addresses

### Testnet (Sepolia)
Deployed addresses saved to: `deployment/testnet/testnet-deployment.json`

### Mainnet (Ethereum)
Deployed addresses saved to: `deployment/mainnet/mainnet-deployment.json`

## Emergency Procedures

### Pause Contracts
```bash
deployment/emergency/emergency-pause.sh pause-all
```

### Rollback Plan
```bash
deployment/emergency/rollback-procedure.sh plan <contract-name>
```

## Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000
- **Status Page**: http://localhost:3001

## Support

See `deployment/docs/support-procedures.md` for detailed support procedures.

## License

MIT - See LICENSE file for details.

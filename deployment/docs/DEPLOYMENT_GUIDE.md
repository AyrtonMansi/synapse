# Step-by-Step Deployment Guide

This guide walks through the complete deployment process for Synapse Network.

## Table of Contents

1. [Pre-Deployment](#pre-deployment)
2. [Testnet Deployment](#testnet-deployment)
3. [Mainnet Preparation](#mainnet-preparation)
4. [Mainnet Deployment](#mainnet-deployment)
5. [Infrastructure Setup](#infrastructure-setup)
6. [Launch](#launch)

---

## Pre-Deployment

### Prerequisites

- [ ] Git installed
- [ ] Node.js 18+ installed
- [ ] Docker and Docker Compose installed
- [ ] Access to Ethereum RPC endpoints
- [ ] Etherscan API key
- [ ] Hardware wallet for mainnet deployment
- [ ] Multisig wallet configured (Gnosis Safe recommended)

### Setup

```bash
# Clone repository
git clone https://github.com/synapse-network/synapse.git
cd synapse

# Install dependencies
cd synapse-contracts
npm install
cd ..

# Configure environment
cp deployment/configs/.env.example .env
# Edit .env with your values
```

---

## Testnet Deployment

### Step 1: Fund Deployer Wallet

Get Sepolia ETH from:
- https://sepoliafaucet.com
- https://www.infura.io/faucet/sepolia

```bash
# Check balance
cast balance $DEPLOYER_ADDRESS --rpc-url $SEPOLIA_RPC_URL
```

### Step 2: Deploy Contracts

```bash
cd deployment/testnet
node deploy-testnet.js
```

This will:
- Deploy all 6 contracts
- Configure contract relationships
- Mint test tokens
- Save deployment info to `testnet-deployment.json`

### Step 3: Verify on Etherscan

```bash
./verify-testnet.sh
```

### Step 4: Deploy Subgraph

```bash
cd ../subgraph
./deploy-subgraph.sh sepolia v0.0.1
```

### Step 5: Fund Test Accounts

```bash
cd ../testnet
node fund-test-accounts.js
```

### Step 6: Run Integration Tests

```bash
cd ../../synapse-testing
npm test
```

---

## Mainnet Preparation

### Step 1: Security Audit

- [ ] Third-party audit completed
- [ ] All findings addressed
- [ ] Bug bounty program configured

### Step 2: Gas Optimization

```bash
cd deployment/mainnet
./verify-gas-optimization.sh
```

### Step 3: Security Checklist

```bash
./security-checklist.sh
```

Must pass all checks before proceeding.

### Step 4: Multisig Setup

1. Create Gnosis Safe at https://app.safe.global
2. Add 5 signers with 3-of-5 threshold
3. Fund with deployment ETH
4. Test transaction flow

---

## Mainnet Deployment

### ⚠️ WARNING

This uses **REAL ETH**. Double-check everything.

### Step 1: Final Review

```bash
# Review deployment script
cat deployment/mainnet/deploy-mainnet.js

# Check environment variables
grep -E '^(MAINNET|MULTISIG)' .env
```

### Step 2: Execute Deployment

```bash
cd deployment/mainnet
node deploy-mainnet.js
```

You will be prompted multiple times for confirmation.

### Step 3: Verify Contracts

```bash
./verify-mainnet.sh
```

### Step 4: Transfer Ownership

Transfer admin roles to multisig:
- HSKToken ownership
- TreasuryDAO roles
- All contract admin roles

---

## Infrastructure Setup

### Step 1: Deploy IPFS Cluster

```bash
docker-compose -f deployment/infrastructure/docker-compose.ipfs.yml up -d
```

Verify:
```bash
curl http://localhost:5001/api/v0/version
```

### Step 2: Deploy API Gateways

```bash
docker-compose -f deployment/infrastructure/docker-compose.api.yml up -d
```

Verify:
```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

### Step 3: Deploy Monitoring

```bash
docker-compose -f deployment/infrastructure/docker-compose.monitoring.yml up -d
```

Access:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000
- Status Page: http://localhost:3001

### Step 4: Setup SSL

```bash
./deployment/scripts/setup-ssl.sh synapse.network admin@synapse.network
```

### Step 5: Setup Backups

```bash
./deployment/scripts/setup-backup.sh /backup/synapse
```

---

## Launch

### Step 1: Run Health Checks

```bash
./deployment/scripts/health-check.sh
```

### Step 2: Final Verification

```bash
./deployment/scripts/verify-deployment.sh
```

### Step 3: Execute Launch Sequence

```bash
./deployment/scripts/launch-sequence.sh
```

### Step 4: Post-Launch

1. **Monitor metrics** for 24 hours
2. **Enable alerts** in AlertManager
3. **Announce launch** using template in `deployment/docs/`
4. **Support channels** ready
5. **Bug bounty** live

---

## Rollback Procedures

If issues arise:

```bash
# Check pause status
deployment/emergency/emergency-pause.sh status

# Pause contracts if needed
deployment/emergency/emergency-pause.sh pause-all

# Create rollback plan
deployment/emergency/rollback-procedure.sh plan JobRegistry

# Execute rollback (requires multisig)
deployment/emergency/rollback-procedure.sh execute JobRegistry
```

---

## Troubleshooting

### Contract Deployment Fails
- Check gas price
- Verify sufficient ETH balance
- Check network connectivity

### Infrastructure Issues
```bash
# Check logs
docker-compose -f deployment/infrastructure/docker-compose.api.yml logs -f

# Restart service
docker-compose -f deployment/infrastructure/docker-compose.api.yml restart api-gateway-1
```

### Verification Fails
- Wait for contract to be indexed
- Check Etherscan API key
- Verify constructor arguments

---

## Support

For issues during deployment:
- Check `deployment/docs/support-procedures.md`
- Create GitHub issue
- Contact core team on Discord

---

*Last Updated: February 2026*

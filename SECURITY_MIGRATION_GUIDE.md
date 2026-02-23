# Security Migration Guide

## Quick Start: Replacing Files with Secure Versions

### 1. Smart Contracts

#### Replace DisputeResolver.sol
```bash
# Backup old version
cp synapse-contracts/contracts/DisputeResolver.sol \
   synapse-contracts/contracts/DisputeResolver.sol.backup

# Use new secure version
cp synapse-contracts/contracts/DisputeResolverSecure.sol \
   synapse-contracts/contracts/DisputeResolver.sol
```

**Changes Required:**
- Deploy new contract with Chainlink VRF configuration
- Update `vrfCoordinator`, `vrfKeyHash`, `vrfSubscriptionId` in constructor
- Grant `PAUSER_ROLE` to appropriate addresses

#### Replace SynapseGovernor.sol
```bash
cp synapse-contracts/governance/SynapseGovernorSecure.sol \
   synapse-contracts/governance/SynapseGovernor.sol
```

**Changes Required:**
- Update EIP-712 domain name/version if needed
- Set `pauser` address during deployment
- Test signature-based voting with new format

### 2. Backend

#### Replace SIWE Service
```bash
cp synapse-backend/api-gateway/src/services/siweSecure.js \
   synapse-backend/api-gateway/src/services/siwe.js
```

**Environment Variables Required:**
```bash
# Required - must be at least 32 characters
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Optional - auto-generated if not set
CSRF_SECRET=your-csrf-secret-key

# Required for SIWE domain validation
APP_DOMAIN=synapse.network
CHAIN_ID=1
```

#### Replace Auth Routes
```bash
cp synapse-backend/api-gateway/src/routes/authSecure.js \
   synapse-backend/api-gateway/src/routes/auth.js
```

**Dependencies to Install:**
```bash
npm install express-validator
```

### 3. Node

#### Replace Node Core
```bash
cp synapse-node/src/synapse_node/core/node_secure.py \
   synapse-node/src/synapse_node/core/node.py

cp synapse-node/src/synapse_node/core/model_manager_secure.py \
   synapse-node/src/synapse_node/core/model_manager.py
```

**Configuration Updates:**
```python
# In config.py or config.yaml
allowed_hosts:
  - "api.synapse.network"
  - "localhost"

cors_origins:
  - "https://synapse.network"

max_cache_size_gb: 100
```

### 4. Frontend

#### Replace WAGMI Config
```bash
cp synapse-frontend/src/utils/wagmiSecure.ts \
   synapse-frontend/src/utils/wagmi.ts
```

**Environment Variables:**
```bash
# .env file
VITE_MAINNET_TOKEN_ADDRESS=0x...
VITE_MAINNET_REGISTRY_ADDRESS=0x...
VITE_MAINNET_STAKING_ADDRESS=0x...
VITE_SEPOLIA_TOKEN_ADDRESS=0x...
# ... etc for all chains

VITE_WC_PROJECT_ID=your-walletconnect-project-id
VITE_CHAIN_ID=1
```

---

## Security Checklist by Component

### Smart Contracts ✅
- [x] ReentrancyGuard on all external calls
- [x] Integer overflow protection (Solidity 0.8.x + bounds checking)
- [x] Access control audit (all functions have proper modifiers)
- [x] Emergency pause mechanism (Pausable with roles)
- [x] Upgrade proxy security (UUPS with role-based authorization)
- [x] Input validation on all public functions
- [x] Event emissions for all state changes
- [x] Secure randomness (Chainlink VRF)

### Backend ✅
- [x] SQL injection prevention (parameterized queries, mongo-sanitize)
- [x] XSS protection (helmet.js CSP headers)
- [x] CSRF tokens (HMAC-based per-session)
- [x] Input sanitization (express-validator, custom validators)
- [x] JWT best practices (HS256, short expiry, proper claims)
- [x] Rate limiting (per-IP, per-address)
- [x] DDoS protection (slow-down middleware)

### Frontend ✅
- [x] CSP headers (via helmet.js)
- [x] XSS prevention (input sanitization)
- [x] Secure storage (EncryptedStorage on mobile)
- [x] Wallet connection security (WalletConnect v2, domain validation)
- [x] API key handling (integrity hashes, secure storage)

### Node ✅
- [x] Sandbox execution (file path validation)
- [x] Resource limits (max prompt length, max tokens)
- [x] Model validation (regex patterns, blocked characters)
- [x] Network isolation (CORS, trusted hosts)
- [x] Secrets management (environment variables only)

---

## Testing Secure Versions

### Run Unit Tests
```bash
# Smart Contracts
npx hardhat test test/DisputeResolver.test.js
npx hardhat test test/SynapseGovernor.test.js

# Backend
npm test -- routes/auth.test.js
npm test -- services/siwe.test.js

# Node
python -m pytest tests/test_synapse_node.py -v

# Frontend
npm run test -- --watchAll=false
```

### Integration Tests
```bash
# Full authentication flow
npm run test:integration:auth

# Contract interaction tests
npx hardhat test test/integration/*.test.js

# End-to-end tests
npm run test:e2e
```

### Security Tests
```bash
# Run security-focused tests
npm run test:security

# Fuzz testing (requires Echidna or similar)
echidna-test contracts/DisputeResolverSecure.sol --contract DisputeResolver
```

---

## Rollback Plan

If issues are encountered:

1. **Revert Contract Changes:**
   ```bash
   git checkout synapse-contracts/contracts/DisputeResolver.sol
   git checkout synapse-contracts/governance/SynapseGovernor.sol
   ```

2. **Revert Backend:**
   ```bash
   git checkout synapse-backend/api-gateway/src/services/siwe.js
   git checkout synapse-backend/api-gateway/src/routes/auth.js
   ```

3. **Revert Node:**
   ```bash
   git checkout synapse-node/src/synapse_node/core/node.py
   git checkout synapse-node/src/synapse_node/core/model_manager.py
   ```

4. **Revert Frontend:**
   ```bash
   git checkout synapse-frontend/src/utils/wagmi.ts
   ```

---

## Monitoring Security

### Metrics to Track
1. Failed authentication attempts
2. Rate limit triggers
3. Invalid signature attempts
4. Reverted transactions
5. Suspicious prompt patterns

### Alerts
```javascript
// Example: Alert on suspicious activity
if (failedAuthAttempts > 10) {
  sendAlert('Possible brute force attack detected');
}
```

---

## Support

For questions or issues with the security fixes:
1. Review SECURITY_FIXES_SUMMARY.md
2. Check the test files for usage examples
3. Review inline code comments for security notes

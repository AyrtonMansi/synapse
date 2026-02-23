# Synapse Decentralization Fixes Summary

This document summarizes all the fixes created to address centralization risks in the Synapse protocol.

## Quick Fix Application Guide

### Smart Contracts

#### 1. DAOSafety.sol
**Location:** `synapse-contracts/fixes/DAOSafety.sol`  
**Purpose:** Adds timelock and emergency pause capabilities to DAO-controlled contracts  
**Severity:** High  
**How to Apply:**
1. Deploy DAOSafety contract with 2-day minimum delay
2. Transfer admin roles from contracts to DAOSafety
3. All admin actions now require queueing + time delay

```solidity
// Before: Direct admin action
jobRegistry.setPlatformFeeRate(500); // Immediate

// After: Through timelock
 daoSafety.queueTransaction(
     address(jobRegistry),
     0,
     "setPlatformFeeRate(uint256)",
     abi.encode(500),
     block.timestamp + 2 days
 );
 // Wait 2 days...
 daoSafety.executeTransaction(...);
```

#### 2. DisputeResolverKleros.sol
**Location:** `synapse-contracts/fixes/DisputeResolverKleros.sol`  
**Purpose:** Integrates Kleros for decentralized dispute resolution  
**Severity:** High  
**How to Apply:**
1. Deploy with Kleros arbitrator address
2. Replace existing DisputeResolver
3. Requires minimum 3 arbitrator contracts

#### 3. JobRegistryUpgradeable.sol
**Location:** `synapse-contracts/fixes/JobRegistryUpgradeable.sol`  
**Purpose:** UUPS upgradeable pattern with DAO-controlled upgrades  
**Severity:** High  
**How to Apply:**
1. Deploy implementation contract
2. Deploy ERC1967Proxy pointing to implementation
3. Initialize through proxy
4. Future upgrades require DAO vote + timelock

### Backend

#### 4. Redis Session Store
**Location:** `synapse-backend/fixes/redis-session.js`  
**Purpose:** Replaces in-memory NodeCache with distributed Redis  
**Severity:** High  
**How to Apply:**
```bash
# Install Redis client
npm install ioredis

# Set environment variable
export REDIS_URL=redis://localhost:6379

# Replace in siwe.js:
- const nonceCache = new NodeCache({ stdTTL: 300 });
+ const { getSessionStore } = require('./fixes/redis-session');
+ const store = getSessionStore();
+ await store.storeNonce(address, nonce);
```

#### 5. IPFS Cluster
**Location:** `synapse-backend/fixes/ipfs-cluster.js`  
**Purpose:** Multi-node IPFS with external pinning  
**Severity:** Medium  
**How to Apply:**
```bash
# Install dependencies
npm install axios

# Configure environment
export IPFS_NODES="http://ipfs-1:5001,http://ipfs-2:5001,http://ipfs-3:5001"
export PINATA_API_KEY="your-key"
export NFT_STORAGE_KEY="your-key"

# Replace IPFS client initialization
- const ipfs = create({ url: process.env.IPFS_API_URL });
+ const { getDecentralizedIPFS } = require('./fixes/ipfs-cluster');
+ const ipfs = getDecentralizedIPFS();
```

#### 6. JWT Secret Enforcement
**Location:** `synapse-backend/fixes/require-jwt-secret.js`  
**Purpose:** Prevents startup with insecure JWT secrets  
**Severity:** High  
**How to Apply:**
```javascript
// At top of api-gateway/src/index.js
const { requireJwtSecret } = require('./fixes/require-jwt-secret');
requireJwtSecret(); // Exits if JWT_SECRET insecure
```

### Frontend

#### 7. Contract Configuration
**Location:** `synapse-frontend/fixes/contractConfig.ts`  
**Purpose:** Environment-based contract addresses  
**Severity:** High  
**How to Apply:**
1. Replace hardcoded addresses in useSynapse.ts:
```typescript
- const SYNAPSE_TOKEN_ADDRESS = '0x1234...';
+ import { getContractAddresses } from '../fixes/contractConfig';
+ const addresses = getContractAddresses(chainId);
+ const SYNAPSE_TOKEN_ADDRESS = addresses.synapseToken;
```

2. Add to .env:
```bash
VITE_SEPOLIA_TOKEN_ADDRESS=0x...
VITE_MAINNET_TOKEN_ADDRESS=0x...
# etc for all chains
```

#### 8. Decentralized RPC
**Location:** `synapse-frontend/fixes/decentralizedRpc.ts`  
**Purpose:** Multi-RPC fallback with user-defined endpoints  
**Severity:** Medium  
**How to Apply:**
```typescript
// In wagmi.ts
import { rpcProvider } from './fixes/decentralizedRpc';

// Replace default transports
- transports: { [mainnet.id]: http() }
+ transports: { [mainnet.id]: rpcProvider.createClient(mainnet).transport }
```

#### 9. Self-Hosted Fonts
**Location:** `synapse-frontend/fixes/selfHostedFonts.css`  
**Purpose:** Removes Google Fonts CDN dependency  
**Severity:** Low  
**How to Apply:**
1. Download fonts from Google Fonts
2. Place in `public/fonts/`
3. Replace in index.html:
```html
- <link rel="preconnect" href="https://fonts.googleapis.com">
+ <link rel="stylesheet" href="/fixes/selfHostedFonts.css">
```

### Node

#### 10. Bootstrap Configuration
**Location:** `synapse-node/fixes/bootstrap_config.py`  
**Purpose:** Multiple bootstrap methods (DNS, DHT, local)  
**Severity:** High  
**How to Apply:**
```python
# In mesh.py
- self.mesh_url = mesh_url or self.config.network_rpc_url
+ from .fixes.bootstrap_config import get_bootstrap_manager
+ bootstrap = get_bootstrap_manager()
+ peers = bootstrap.get_all_bootstrap_peers()
```

#### 11. Hardware Wallet Support
**Location:** `synapse-node/fixes/hardware_wallet.py`  
**Purpose:** Secure key management with Ledger/Trezor  
**Severity:** Medium  
**How to Apply:**
```python
# In node.py
- wallet_private_key: Optional[str] = Field(default=None)
+ from .fixes.hardware_wallet import get_node_wallet
+ wallet = get_node_wallet()
+ await wallet.setup_hardware_wallet()  # Or setup_keystore()
```

## Fix Priority Matrix

| Fix | Before Mainnet | 3 Months | 6 Months | Effort |
|-----|----------------|----------|----------|--------|
| Contract Upgradeability | ✅ | | | High |
| JWT Secret Enforcement | ✅ | | | Low |
| Contract Address Config | ✅ | | | Low |
| Redis Session Store | ✅ | | | Medium |
| DAOSafety Timelock | | ✅ | | Medium |
| Decentralized RPC | | ✅ | | Medium |
| IPFS Cluster | | ✅ | | Medium |
| Kleros Integration | | ✅ | | High |
| Hardware Wallet | | | ✅ | Medium |
| Self-Hosted Fonts | | | ✅ | Low |

## Testing the Fixes

### Smart Contracts
```bash
cd synapse-contracts
npx hardhat test test/DAOSafety.test.ts
npx hardhat test test/JobRegistryUpgradeable.test.ts
```

### Backend
```bash
cd synapse-backend
npm test -- fixes/redis-session.test.js
npm test -- fixes/ipfs-cluster.test.js
```

### Frontend
```bash
cd synapse-frontend
npm run build  # Validates contract addresses
npm run test -- fixes/decentralizedRpc.test.ts
```

### Node
```bash
cd synapse-node
python -m pytest tests/test_bootstrap_config.py
python -m pytest tests/test_hardware_wallet.py
```

## Migration Checklist

- [ ] Deploy DAOSafety contract
- [ ] Transfer contract ownership to DAOSafety
- [ ] Deploy upgradeable contract proxies
- [ ] Migrate state from old contracts
- [ ] Set up Redis cluster
- [ ] Configure IPFS multi-node setup
- [ ] Update frontend environment variables
- [ ] Deploy with self-hosted fonts
- [ ] Test hardware wallet integration
- [ ] Document new bootstrap methods

## Rollback Plan

If issues occur:
1. Keep old contract addresses in environment
2. Maintain NodeCache fallback in backend
3. Frontend supports both old and new address formats
4. Nodes can fall back to WebSocket bootstrap

## Monitoring

After applying fixes, monitor:
- Timelock transaction queue depth
- Redis connection health
- IPFS node sync status
- RPC endpoint response times
- Hardware wallet connection rates

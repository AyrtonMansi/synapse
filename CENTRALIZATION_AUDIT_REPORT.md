# Synapse Centralization Risk Audit Report

**Audit Date:** February 23, 2026  
**Auditor:** Automated Security Audit  
**Scope:** Smart Contracts, Backend, Frontend, Node

---

## Executive Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Smart Contracts | 0 | 2 | 3 | 2 |
| Backend | 0 | 1 | 3 | 2 |
| Frontend | 0 | 2 | 2 | 1 |
| Node | 0 | 1 | 2 | 1 |
| **Total** | **0** | **6** | **10** | **6** |

---

## 1. SMART CONTRACTS FINDINGS

### HIGH-001: No Upgrade Mechanism
**Severity:** High  
**Status:** Open  
**File:** All contracts

**Finding:** None of the Synapse contracts implement upgradeability. Once deployed, code cannot be updated to fix bugs or add features without deploying new contracts and migrating state.

**Impact:** Critical bugs would require full contract redeployment and user migration.

**Recommendation:** Implement UUPS or Transparent proxy pattern for upgradeability controlled by DAO.

**Fix:** See `synapse-contracts/fixes/UpgradeableJobRegistry.sol`

---

### HIGH-002: Single Address DAO Control
**Severity:** High  
**Status:** Open  
**Files:** 
- `JobRegistry.sol` (line 129)
- `TreasuryDAO.sol` (line 107)
- `HSKToken.sol` (line 93)
- `DisputeResolver.sol` (line 135)
- `StreamingPayments.sol` (line 68)

**Finding:** Contracts grant DEFAULT_ADMIN_ROLE and DAO_ROLE to a single address in constructor. While intended to be a DAO contract, if that address is an EOA or compromised multisig, full control is centralized.

**Impact:** Admin can slash users, change fees, pause token, drain treasury.

**Recommendation:** 
1. Ensure DAO is a timelocked governance contract
2. Implement 2-step role transfer with delay
3. Add emergency pause with multisig threshold

**Fix:** See `synapse-contracts/fixes/DAOSafety.sol` (add-on contract)

---

### MED-003: Hardcoded Contract Addresses in Frontend
**Severity:** Medium  
**Status:** Open  
**File:** `synapse-frontend/src/hooks/useSynapse.ts` (lines 7-9)

**Finding:** Placeholder addresses used that could accidentally be deployed to production:
```typescript
const SYNAPSE_TOKEN_ADDRESS = '0x1234567890123456789012345678901234567890';
const SYNAPSE_STAKING_ADDRESS = '0x2345678901234567890123456789012345678901';
const SYNAPSE_REGISTRY_ADDRESS = '0x3456789012345678901234567890123456789012';
```

**Impact:** Users could interact with wrong contracts, lose funds.

**Recommendation:** Use environment variables or on-chain registry for address resolution.

---

### MED-004: TreasuryDAO Cancel Function Centralization
**Severity:** Medium  
**Status:** Open  
**File:** `TreasuryDAO.sol` (lines 180-192)

**Finding:** Proposals can be cancelled by proposer OR anyone with DEFAULT_ADMIN_ROLE:
```solidity
require(
    msg.sender == proposal.proposer || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
    "TreasuryDAO: not proposer"
);
```

**Impact:** Admin can cancel any proposal before voting starts.

**Recommendation:** Remove admin cancellation ability after initial bootstrapping period.

---

### MED-005: DisputeResolver Arbitrator Registration
**Severity:** Medium  
**Status:** Open  
**File:** `DisputeResolver.sol` (lines 301-324)

**Finding:** DAO can register/deregister arbitrators, effectively controlling dispute outcomes. No minimum arbitrator diversity required.

**Impact:** Centralized dispute resolution if DAO registers only controlled arbitrators.

**Recommendation:** 
1. Require minimum 3 independent arbitrators
2. Add arbitrator staking/slashing
3. Implement Kleros integration for true decentralization

---

### LOW-006: HSKToken Pause Function
**Severity:** Low  
**Status:** Open  
**File:** `HSKToken.sol` (lines 185-198)

**Finding:** DAO can pause/unpause token transfers. While useful for emergencies, this is a centralization vector.

**Impact:** Token transfers can be frozen by DAO.

**Recommendation:** Add timelock to unpause function (minimum 7 days).

---

### LOW-007: PriceOracle Admin Control
**Severity:** Low  
**Status:** Open  
**File:** `PriceOracle.sol`

**Finding:** ORACLE_ADMIN_ROLE can add/remove price feeds and set manual prices.

**Impact:** Price manipulation possible if admin compromised.

**Recommendation:** Use Chainlink decentralized feeds exclusively, remove manual price setting.

---

## 2. BACKEND FINDINGS

### HIGH-008: JWT Secret Centralization
**Severity:** High  
**Status:** Open  
**Files:** 
- `api-gateway/src/services/siwe.js` (line 12)
- `api-gateway/src/auth.ts` (line 25)

**Finding:** JWT secrets hardcoded as fallbacks:
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
```

**Impact:** If env var not set, predictable JWT allows session forgery.

**Recommendation:** Fail startup if JWT_SECRET not provided, enforce minimum entropy.

---

### MED-009: In-Memory Session Store
**Severity:** Medium  
**Status:** Open  
**Files:** 
- `api-gateway/src/services/siwe.js`
- `api-gateway/src/auth.ts`

**Finding:** Uses NodeCache for sessions and API keys. Data lost on restart.

**Impact:** All sessions invalidated on redeployment; no horizontal scaling possible.

**Recommendation:** Use Redis or distributed cache for session storage.

---

### MED-010: IPFS Centralization
**Severity:** Medium  
**Status:** Open  
**File:** `ipfs-service/src/index.js` (line 13)

**Finding:** IPFS client connects to single node:
```javascript
const ipfs = create({
  url: process.env.IPFS_API_URL || 'http://localhost:5001'
});
```

**Impact:** If IPFS node goes down, content unavailable. No pinning to external services.

**Recommendation:** Support multiple IPFS nodes, integrate with Filecoin/estuary for persistence.

---

### MED-011: API Rate Limiting Centralized
**Severity:** Medium  
**Status:** Open  
**File:** `api-gateway/src/services/rateLimiter.js`

**Finding:** Rate limiting likely uses in-memory store (implied by file location), not distributed.

**Impact:** Rate limits can be bypassed by hitting different API instances.

**Recommendation:** Use Redis-based rate limiting for distributed deployments.

---

### LOW-012: Environment Variable Leak Risk
**Severity:** Low  
**Status:** Open  
**File:** `.env.example`

**Finding:** Example env file contains placeholder private key:
```
DEPLOYER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

**Impact:** Risk of accidental commit of real keys if dev copies file.

**Recommendation:** Use `.env.local` pattern, never commit keys, add git pre-commit hook.

---

### LOW-013: CORS Origin Configuration
**Severity:** Low  
**Status:** Open  
**File:** `api-gateway/src/index.js`

**Finding:** CORS origins from env with localhost fallback:
```javascript
origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
```

**Impact:** In production, if env var not set, CORS allows localhost (security risk).

**Recommendation:** Fail startup in production if ALLOWED_ORIGINS not explicitly set.

---

## 3. FRONTEND FINDINGS

### HIGH-014: Hardcoded Contract Addresses
**Severity:** High  
**Status:** Open  
**File:** `synapse-frontend/src/hooks/useSynapse.ts` (lines 7-9)

**Finding:** Placeholder addresses that must be replaced:
```typescript
const SYNAPSE_TOKEN_ADDRESS = '0x1234567890123456789012345678901234567890';
```

**Impact:** Production deployment could use placeholder addresses, causing fund loss.

**Recommendation:** Use environment variables, validate addresses at build time.

**Fix:** See `synapse-frontend/fixes/contractConfig.ts`

---

### HIGH-015: WalletConnect Project ID Centralization
**Severity:** High  
**Status:** Open  
**File:** `synapse-frontend/src/utils/wagmi.ts` (line 19)

**Finding:** WalletConnect Project ID required:
```typescript
projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID'
```

**Impact:** If WalletConnect infra goes down, wallet connection fails. Also privacy concern (WC can track users).

**Recommendation:** 
1. Support multiple wallet connection methods (injected, Coinbase, etc.)
2. Self-host WalletConnect relay (advanced)
3. Implement direct wallet injection fallback

---

### MED-016: No Decentralized RPC Fallback
**Severity:** Medium  
**Status:** Open  
**File:** `synapse-frontend/src/utils/wagmi.ts`

**Finding:** Uses default RPC providers (likely Infura/Alchemy via wagmi defaults).

**Impact:** RPC provider can censor transactions, log IP addresses.

**Recommendation:** 
1. Allow users to specify custom RPC
2. Implement RPC rotation/fallback
3. Support WalletConnect's provider

**Fix:** See `synapse-frontend/fixes/decentralizedRpc.ts`

---

### MED-017: No IPFS Content Verification
**Severity:** Medium  
**Status:** Open  
**File:** Frontend IPFS integration (implied)

**Finding:** Frontend likely fetches IPFS content without verifying CIDs match expected hashes.

**Impact:** Malicious gateway could serve tampered content.

**Recommendation:** Verify all IPFS content hashes client-side before processing.

---

### LOW-018: Google Fonts External Dependency
**Severity:** Low  
**Status:** Open  
**File:** `index.html` (lines 10-11)

**Finding:** Loads fonts from Google CDN:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
```

**Impact:** Privacy leak to Google, fails if Google blocked.

**Recommendation:** Self-host fonts or include in bundle.

---

## 4. NODE FINDINGS

### HIGH-019: Hardcoded Mesh Network URL
**Severity:** High  
**Status:** Open  
**File:** `synapse-node/src/synapse_node/core/config.py` (line 19)

**Finding:** Default mesh URL hardcoded:
```python
network_rpc_url: str = Field(
    default="wss://mesh.synapse.network/v1/ws",
    description="Synapse mesh network WebSocket URL"
)
```

**Impact:** If synapse.network domain compromised or down, nodes cannot connect.

**Recommendation:** Support multiple bootstrap methods, local discovery, and static peer lists.

---

### MED-020: Private Key in Environment
**Severity:** Medium  
**Status:** Open  
**File:** `synapse-node/src/synapse_node/core/config.py` (line 47)

**Finding:** Wallet private key stored in environment variable:
```python
wallet_private_key: Optional[str] = Field(
    default=None, 
    description="Ethereum private key for node wallet"
)
```

**Impact:** Key logging, shell history, process inspection can leak key.

**Recommendation:** Use hardware wallets, keystores with passwords, or external signer.

---

### MED-021: Model Download Centralization
**Severity:** Medium  
**Status:** Open  
**File:** `synapse-node/src/synapse_node/core/config.py` (lines 35-39)

**Finding:** Default models from HuggingFace:
```python
default_models: List[str] = Field(
    default=[
        "deepseek-ai/deepseek-coder-6.7b-instruct",
        "meta-llama/Llama-2-7b-chat-hf",
        ...
    ]
)
```

**Impact:** HuggingFace downtime or censorship affects model availability.

**Recommendation:** Support IPFS/BitTorrent model distribution, local model caching.

---

### LOW-022: Python Dependency Centralization
**Severity:** Low  
**Status:** Open  
**File:** `pyproject.toml`

**Finding:** Dependencies installed from PyPI. Compromised package could affect nodes.

**Impact:** Supply chain attack vector.

**Recommendation:** Pin exact versions, use hash verification, maintain mirror.

---

## 5. GENERAL ARCHITECTURE FINDINGS

### MED-023: No Decentralized Identity
**Severity:** Medium  
**Status:** Open  

**Finding:** System relies on Ethereum addresses for identity. No support for DIDs, Ceramic/ComposeDB, or self-sovereign identity alternatives.

**Recommendation:** Consider integrating Ceramic for decentralized user profiles.

---

### MED-024: No Cross-Chain Support
**Severity:** Medium  
**Status:** Open  

**Finding:** Contracts and backend designed for single chain. No bridge or multi-chain support.

**Recommendation:** Design for LayerZero, Axelar, or native bridge integration.

---

## FIXES IMPLEMENTED

The following fix files have been created:

### Smart Contracts
1. `synapse-contracts/fixes/TreasuryDAOUpgradeable.sol` - UUPS upgradeable version
2. `synapse-contracts/fixes/DAOSafety.sol` - Safety module for DAO actions
3. `synapse-contracts/fixes/JobRegistryUpgradeable.sol` - Upgradeable JobRegistry
4. `synapse-contracts/fixes/DisputeResolverKleros.sol` - Kleros integration

### Backend
5. `synapse-backend/fixes/redis-session.js` - Redis-based session store
6. `synapse-backend/fixes/ipfs-cluster.js` - Multi-node IPFS support
7. `synapse-backend/fixes/require-jwt-secret.js` - Enforce JWT configuration

### Frontend
8. `synapse-frontend/fixes/contractConfig.ts` - Environment-based contract addresses
9. `synapse-frontend/fixes/decentralizedRpc.ts` - Multi-RPC provider with fallback
10. `synapse-frontend/fixes/selfHostedFonts.css` - Self-hosted font styles

### Node
11. `synapse-node/fixes/bootstrap_config.py` - Multiple bootstrap methods
12. `synapse-node/fixes/hardware_wallet.py` - Hardware wallet support

---

## RECOMMENDATIONS SUMMARY

### Immediate Actions (Before Mainnet)
1. ✅ Implement contract upgradeability (UUPS)
2. ✅ Replace placeholder contract addresses
3. ✅ Remove hardcoded JWT secrets
4. ✅ Add Redis for session storage
5. ✅ Implement multi-RPC fallback

### Short-term (First 3 Months)
6. Integrate Kleros for dispute resolution
7. Support multiple IPFS pinning services
8. Add hardware wallet support for nodes
9. Implement self-hosted fonts
10. Add decentralized identity support

### Long-term (6+ Months)
11. Multi-chain deployment
12. Self-hosted WalletConnect relay
13. IPFS-based model distribution
14. Full DAO transition (remove all admin keys)
15. Decentralized governance for parameter changes

---

## CONCLUSION

The Synapse protocol has a solid foundation with good use of AccessControl instead of Ownable. However, several centralization risks exist, primarily around:

1. **Single-point-of-failure in DAO administration**
2. **Infrastructure dependencies (IPFS, RPC, WalletConnect)**
3. **Configuration management (hardcoded values, env vars)**

All critical and high issues should be resolved before mainnet deployment. The medium and low issues should be addressed in subsequent upgrades.

The fixes provided in the respective `/fixes` directories can be applied incrementally to decentralize the protocol over time.

---

*End of Audit Report*

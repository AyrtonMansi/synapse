# Synapse Protocol Decentralization Audit Report

**Date:** 2026-02-23  
**Scope:** synapse-contracts, synapse-backend, synapse-frontend  
**Audit Type:** Comprehensive Centralization Risk Assessment

---

## Executive Summary

This audit identifies centralization risks across the Synapse protocol stack. The project shows a **mixed decentralization posture** with strong decentralized elements in the smart contract layer but significant centralization risks in the backend infrastructure and frontend dependencies.

| Component | Decentralization Score | Risk Level |
|-----------|----------------------|------------|
| Smart Contracts | 8/10 | Low |
| Backend Services | 4/10 | High |
| Frontend | 5/10 | Medium |
| **Overall** | **5.7/10** | **Medium-High** |

---

## 1. Smart Contract Analysis

### 1.1 Contracts Reviewed

- `HSKToken.sol` - Governance token with vesting and mining
- `JobRegistry.sol` - Job marketplace with escrow
- `PriceOracle.sol` - Chainlink price feed integration
- `StreamingPayments.sol` - Payment streaming
- `DisputeResolver.sol` - Decentralized dispute resolution
- `TreasuryDAO.sol` - DAO-controlled treasury

### 1.2 onlyOwner / Admin Functions

#### HSKToken.sol
| Function | Modifier | Risk | Notes |
|----------|----------|------|-------|
| `createVestingSchedule()` | `onlyDAO` | Low | DAO-controlled, intended |
| `revokeVesting()` | `onlyDAO` | Low | DAO-controlled, revocable flag required |
| `setMiningCap()` | `onlyDAO` | Low | DAO-controlled emissions |
| `pause()` | `onlyDAO` | Medium | Emergency pause - acceptable for security |
| `unpause()` | `onlyDAO` | Low | DAO-controlled unpause |
| `transferDAORole()` | `onlyDAO` | Low | Self-governance mechanism |
| `mintMiningReward()` | `onlyMining` | Medium | Mining controller can mint - needs decentralization |

**FINDING:** The `MINING_ROLE` is a centralization vector. If held by a single address, it can unilaterally mint tokens.

#### JobRegistry.sol
| Function | Modifier | Risk | Notes |
|----------|----------|------|-------|
| `initialize()` | N/A | Low | One-time initialization |
| `_authorizeUpgrade()` | `onlyRole(UPGRADER_ROLE)` | Medium | Timelock is used - acceptable |
| `slashUser()` | `onlyRole(DAO_ROLE)` | Low | DAO governance required |
| `verifyFreelancer()` | `onlyRole(DAO_ROLE)` | Low | DAO-controlled verification |
| `setPlatformFeeRate()` | `onlyRole(DAO_ROLE)` | Low | DAO-controlled |
| `setMinStakeAmount()` | `onlyRole(DAO_ROLE)` | Low | DAO-controlled |
| `setDisputeResolver()` | `onlyRole(DAO_ROLE)` | Low | DAO-controlled |
| `resolveDispute()` | `onlyRole(DISPUTE_RESOLVER_ROLE)` | Low | External arbitrator role |

**FINDING:** Uses TimelockController for critical operations (UPGRADER_ROLE) - good practice.

#### PriceOracle.sol
| Function | Modifier | Risk | Notes |
|----------|----------|------|-------|
| `addPriceFeed()` | `onlyRole(ORACLE_ADMIN_ROLE)` | High | Can add any price feed |
| `removePriceFeed()` | `onlyRole(ORACLE_ADMIN_ROLE)` | High | Can remove feeds |
| `setManualPrice()` | `onlyRole(ORACLE_ADMIN_ROLE)` | Critical | Can set arbitrary prices! |
| `setStalenessThreshold()` | `onlyRole(ORACLE_ADMIN_ROLE)` | Medium | Affects price validity |

**CRITICAL FINDING:** `setManualPrice()` allows admin to set arbitrary prices without oracle validation. This is a significant centralization risk.

#### StreamingPayments.sol
| Function | Modifier | Risk | Notes |
|----------|----------|------|-------|
| `addSupportedToken()` | `onlyRole(DAO_ROLE)` | Low | DAO-controlled |
| `removeSupportedToken()` | `onlyRole(DAO_ROLE)` | Medium | Can lock existing streams |
| `setPlatformFeeRate()` | `onlyRole(DAO_ROLE)` | Low | DAO-controlled, max 5% |

#### DisputeResolver.sol
| Function | Modifier | Risk | Notes |
|----------|----------|------|-------|
| `registerArbitrator()` | `onlyRole(DAO_ROLE)` | Low | DAO adds arbitrators |
| `deregisterArbitrator()` | `onlyRole(DAO_ROLE)` | Medium | Can remove arbitrators |
| `setDefaultArbitrator()` | `onlyRole(DAO_ROLE)` | Low | DAO-controlled |

**FINDING:** Dispute resolution relies on registered arbitrators. While DAO-controlled, arbitrator selection is centralized.

#### TreasuryDAO.sol
| Function | Access Control | Risk | Notes |
|----------|---------------|------|-------|
| All functions | Token-weighted voting | Low | Fully DAO-governed |

**POSITIVE:** TreasuryDAO has no admin functions - all actions require proposal and voting.

### 1.3 Hardcoded Addresses

| File | Address | Purpose | Risk |
|------|---------|---------|------|
| useSynapse.ts | 0x1234567890123456789012345678901234567890 | SYNAPSE_TOKEN | Critical - Placeholder used |
| useSynapse.ts | 0x2345678901234567890123456789012345678901 | STAKING | Critical - Placeholder used |
| useSynapse.ts | 0x3456789012345678901234567890123456789012 | REGISTRY | Critical - Placeholder used |

**CRITICAL FINDINGS:**
1. Frontend uses placeholder addresses (0x1234..., 0x2345..., 0x3456...). These must be updated for production.
2. No contract address configuration management detected in deployment scripts.

### 1.4 Centralized Oracle Usage

| Contract | Oracle Type | Risk | Mitigation |
|----------|-------------|------|------------|
| PriceOracle.sol | Chainlink | Medium | Multiple feeds supported, staleness checks |

**FINDINGS:**
- Chainlink feeds are decentralized at the data layer
- `setManualPrice()` fallback introduces centralization risk
- No TWAP (Time-Weighted Average Price) implementation
- Single oracle provider (Chainlink only)

### 1.5 Upgradeability Analysis

| Contract | Pattern | Risk | Notes |
|----------|---------|------|-------|
| JobRegistry.sol | UUPS + Timelock | Low | Upgrades require timelock |
| All others | Immutable | Low | No upgrade risks |

---

## 2. Backend Analysis

### 2.1 Database Dependencies

| Service | Database | Purpose | Centralization Risk |
|---------|----------|---------|-------------------|
| PostgreSQL | Postgres 15 | The Graph indexing | Medium - Indexing can be rebuilt |

**FINDINGS:**
- PostgreSQL is used ONLY for The Graph node indexing
- No application state stored in databases
- All critical state is on-chain
- **POSITIVE:** IPFS used for decentralized storage

### 2.2 Centralized API Bottlenecks

| Service | Port | Function | Risk |
|---------|------|----------|------|
| api-gateway | 3000 | Authentication & routing | **HIGH** |
| job-router | 4000 | P2P job coordination | Medium |
| ipfs-service | 5002 | IPFS proxy | Medium |

**CRITICAL FINDINGS:**

1. **API Gateway Centralization**
   - Single authentication endpoint
   - JWT-based sessions stored in memory (NodeCache)
   - API keys generated server-side
   - No redundancy/failover mechanism
   - Rate limiting is centralized

2. **Job Router**
   - Uses libp2p mesh networking (decentralized)
   - But bootstrap peers are configured via env var
   - Single point if bootstrap nodes fail

3. **IPFS Service**
   - Proxies all IPFS operations
   - Can be bypassed by connecting directly to IPFS node

### 2.3 Single Points of Failure

| Component | SPOF Type | Impact | Mitigation |
|-----------|-----------|--------|------------|
| api-gateway | Single instance | Auth failure | Docker restart policy only |
| job-router bootstrap | Configured peers | Network partition | No fallback mechanism |
| IPFS node | Single node | Data unavailability | Content can be pinned elsewhere |
| Ethereum node | Single Anvil instance | Chain unavailable | Can connect to public RPCs |

**FINDINGS:**
- No load balancing configured
- No horizontal scaling setup
- No health-based auto-failover
- Monitoring is optional (Grafana/Prometheus in separate profile)

### 2.4 Infrastructure Dependencies

| Service | External Dependency | Risk |
|---------|-------------------|------|
| All | Docker | Infrastructure lock-in |
| job-router | libp2p bootstrap nodes | Network isolation risk |
| ipfs-service | IPFS Kubo | Implementation dependency |

---

## 3. Frontend Analysis

### 3.1 Centralized Analytics

| Source | Analytics Detected | Risk |
|--------|-------------------|------|
| index.html | **NONE** | Low |
| App.tsx | **NONE** | Low |
| All pages | **NONE** | Low |

**POSITIVE:** No Google Analytics, Mixpanel, or other tracking scripts detected.

### 3.2 API Keys & Secrets

| File | Key/Secret | Risk | Notes |
|------|-----------|------|-------|
| .env.example | VITE_WALLET_CONNECT_PROJECT_ID | Medium | Required for WalletConnect |
| wagmi.ts | projectId fallback | Low | Has placeholder fallback |

**FINDINGS:**
- WalletConnect Project ID is the only required API key
- No centralized backend API keys in frontend
- No RPC API keys embedded in code

### 3.3 RPC Dependencies

| Chain | RPC Configuration | Risk |
|-------|------------------|------|
| All chains | `http()` default | **HIGH** |

**CRITICAL FINDING:**
```typescript
// wagmi.ts
export const config = getDefaultConfig({
  // ...
  transports: {
    [mainnet.id]: http(),  // Uses public RPC!
    [sepolia.id]: http(),
    // ... all chains use default http()
  },
});
```

- Using `http()` without URL defaults to public RPC endpoints
- Public RPCs are:
  - Rate limited
  - Unreliable
  - Potential censorship vectors
  - No SLA guarantees

### 3.4 External Service Dependencies

| Service | Provider | Risk |
|---------|----------|------|
| Wallet connection | RainbowKit + wagmi | Low |
| Fonts | Google Fonts (preconnect) | Low |
| RPC | Public endpoints | High |

**FINDINGS:**
- RainbowKit is a centralized service but for wallet connection only
- No direct calls to centralized APIs
- All data reads come from blockchain

---

## 4. Detailed Risk Assessment

### 4.1 Critical Risks (Immediate Action Required)

| # | Risk | Component | Impact | Likelihood |
|---|------|-----------|--------|------------|
| 1 | Placeholder contract addresses in frontend | synapse-frontend | Protocol unusable | Certain |
| 2 | Public RPC endpoints | synapse-frontend | Service disruption | High |
| 3 | `setManualPrice()` arbitrary price setting | PriceOracle.sol | Price manipulation | Medium |
| 4 | Single API gateway instance | synapse-backend | Total service outage | Medium |
| 5 | Mining role centralization | HSKToken.sol | Uncontrolled minting | Medium |

### 4.2 High Risks (Address Before Mainnet)

| # | Risk | Component | Impact |
|---|------|-----------|--------|
| 6 | No oracle redundancy (Chainlink only) | PriceOracle.sol | Price feed failure |
| 7 | Bootstrap peer single point of failure | job-router | Network partition |
| 8 | No timelock on DAO parameter changes | JobRegistry.sol | Rapid parameter manipulation |
| 9 | Manual price fallback in oracle | PriceOracle.sol | Incorrect pricing |
| 10 | No contract address verification | Frontend/Backend | Phishing/scam risk |

### 4.3 Medium Risks (Address Post-Launch)

| # | Risk | Component | Impact |
|---|------|-----------|--------|
| 11 | PostgreSQL single instance | The Graph | Indexing downtime |
| 12 | No CDN for frontend assets | Frontend | Slow global access |
| 13 | IPFS single node | IPFS | Content unavailability |
| 14 | No disaster recovery plan | Backend | Extended outages |
| 15 | Centralized dispute arbitrator selection | DisputeResolver | Biased resolutions |

---

## 5. Decentralization Recommendations

### 5.1 Smart Contract Improvements

1. **Remove or Restrict `setManualPrice()`**
   ```solidity
   // Option A: Remove manual price entirely
   // Option B: Add timelock and limits
   function setManualPrice(bytes32 asset, uint256 price) external onlyRole(ORACLE_ADMIN_ROLE) {
       require(price >= manualPrices[asset] * 90 / 100, "Price decrease > 10%");
       require(price <= manualPrices[asset] * 110 / 100, "Price increase > 10%");
       require(block.timestamp > lastManualUpdate + 1 days, "Too frequent");
       // ...
   }
   ```

2. **Implement Multi-Oracle Support**
   - Add Chainlink, Pyth, and Uniswap TWAP
   - Use median of multiple sources
   - Revert if sources diverge > 5%

3. **Decentralize Mining Role**
   - Use multiple mining controllers with rate limits
   - Implement proof-of-work mining
   - Use DAO-authorized Merkle distributor

4. **Add Timelock to All Admin Functions**
   - Currently only UPGRADER_ROLE has timelock
   - Extend to all DAO_ROLE functions

### 5.2 Backend Improvements

1. **Deploy Multiple API Gateway Instances**
   ```yaml
   # docker-compose.yml
   api-gateway:
     deploy:
       replicas: 3
       update_config:
         parallelism: 1
         delay: 10s
   ```

2. **Implement Decentralized Authentication**
   - Replace JWT with signed messages
   - Use SIWE for all authentication
   - Remove API key generation service

3. **Add Bootstrap Redundancy**
   ```typescript
   // mesh.ts
   const BOOTSTRAP_PEERS = [
     '/dns4/bootstrap1.synapse.network/tcp/10000',
     '/dns4/bootstrap2.synapse.network/tcp/10000',
     '/dns4/bootstrap3.synapse.network/tcp/10000',
   ];
   ```

4. **Configure Public RPC Fallbacks**
   ```yaml
   # docker-compose.yml
   ethereum:
     environment:
       - FALLBACK_RPC_1=https://eth.llamarpc.com
       - FALLBACK_RPC_2=https://rpc.ankr.com/eth
   ```

### 5.3 Frontend Improvements

1. **Implement Multi-RPC Strategy**
   ```typescript
   // wagmi.ts
   const transports = {
     [mainnet.id]: fallback([
       http('https://eth-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_KEY}'),
       http('https://eth.llamarpc.com'),
       http('https://rpc.ankr.com/eth'),
     ]),
   };
   ```

2. **Use IPFS for Frontend Hosting**
   - Deploy to IPFS for censorship resistance
   - Use ENS or Unstoppable Domains
   - Provide IPFS hash in releases

3. **Add Contract Verification UI**
   - Display contract addresses with verification badges
   - Link to Etherscan/source code
   - Show upgrade timestamps

---

## 6. Compliance with Decentralization Principles

| Principle | Status | Notes |
|-----------|--------|-------|
| No admin keys (TreasuryDAO) | ✅ Pass | Fully DAO-governed |
| Upgrade timelocks | ✅ Pass | UUPS + TimelockController |
| Decentralized storage | ✅ Pass | IPFS integration |
| P2P networking | ✅ Pass | libp2p mesh |
| Multi-sig critical ops | ⚠️ Partial | DAO uses token voting |
| No single points of failure | ❌ Fail | API gateway is SPOF |
| Decentralized oracle | ❌ Fail | Chainlink only + manual fallback |
| Open source | ✅ Pass | All code visible |
| Permissionless participation | ✅ Pass | Anyone can run node |
| Censorship resistant | ⚠️ Partial | Centralized API gateway |

---

## 7. Conclusion

### Overall Assessment: MEDIUM-HIGH RISK

The Synapse protocol demonstrates good decentralization at the smart contract layer with proper DAO governance, timelocks, and minimal admin privileges. However, significant centralization risks exist in:

1. **Backend Infrastructure** - Single-instance services with no redundancy
2. **Oracle Design** - Manual price override capability and single provider
3. **Frontend Dependencies** - Public RPC usage and placeholder configurations

### Priority Actions

1. **Before Mainnet Launch:**
   - Remove or heavily restrict `setManualPrice()`
   - Implement multi-RPC in frontend
   - Deploy real contract addresses
   - Add API gateway redundancy

2. **Within 30 Days of Launch:**
   - Implement multi-oracle support
   - Decentralize mining emissions
   - Deploy to IPFS
   - Add monitoring/alerting

3. **Within 90 Days:**
   - Decentralize dispute resolution (Kleros integration)
   - Implement distributed API gateways
   - Add automated failover
   - Create disaster recovery runbooks

---

## Appendix A: Contract Addresses Checklist

| Contract | Deployed Address | Verified | Notes |
|----------|-----------------|----------|-------|
| HSKToken | TBD | ⬜ | |
| JobRegistry | TBD | ⬜ | |
| PriceOracle | TBD | ⬜ | |
| StreamingPayments | TBD | ⬜ | |
| DisputeResolver | TBD | ⬜ | |
| TreasuryDAO | TBD | ⬜ | |

## Appendix B: Environment Variables Audit

| Variable | Location | Sensitive | Encrypted |
|----------|----------|-----------|-----------|
| JWT_SECRET | backend/.env.example | Yes | No |
| DEPLOYER_KEY | backend/.env.example | Yes | No |
| PINNING_KEY | backend/.env.example | Yes | No |
| VITE_WALLET_CONNECT_PROJECT_ID | frontend/.env.example | No | N/A |
| SYNAPSE_WALLET_PRIVATE_KEY | node/.env.example | Yes | No |

---

*Report generated by OpenClaw Subagent*  
*Auditor: AI Security Analyst*  
*Methodology: Static code analysis, configuration review, architecture assessment*

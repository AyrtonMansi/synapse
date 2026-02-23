# Synapse Design Decisions

## Architecture Decisions

### 1. Smart Contract Platform: Ethereum + L2s
**Decision:** Build on Ethereum with L2 expansion  
**Rationale:**
- Largest developer ecosystem
- Proven security
- Easy L2 bridging (Arbitrum, Optimism)
- Tradeoff: Higher gas costs mitigated by L2s

### 2. No Centralized Database
**Decision:** Use IPFS + blockchain for all state  
**Rationale:**
- True decentralization
- Censorship resistance
- No single point of failure
- Tradeoff: Slower reads, requires indexing

### 3. P2P Mesh vs Central API
**Decision:** P2P mesh with gossip protocol  
**Rationale:**
- No central server to shut down
- Natural load distribution
- Resilient to outages
- Tradeoff: More complex to debug

### 4. Wallet-Only Auth (SIWE)
**Decision:** No email/password, only wallets  
**Rationale:**
- Self-sovereign identity
- No KYC/AML requirements
- Natural web3 UX
- Tradeoff: Higher barrier for non-crypto users

### 5. Token: HSK
**Decision:** ERC20 with deflationary burn  
**Rationale:**
- Align incentives between users and nodes
- Captures network value
- Tradeoff: Regulatory uncertainty

## Technical Tradeoffs

### Performance vs Decentralization
**Chose:** Decentralization first, optimize performance  
- P2P adds latency but removes centralization
- IPFS is slower but uncensorable
- ZK proofs add compute but enable trustlessness

### Upgradeability vs Immutability
**Chose:** Upgradeable via DAO governance  
- Uses UUPS proxy pattern
- All upgrades require 48h timelock + DAO vote
- Tradeoff: Complexity vs ability to fix bugs

### Model Verification
**Chose:** ZK proofs for verification  
- Trustless verification of compute
- Higher overhead but removes need for trusted validators
- Tradeoff: Slower validation vs trustlessness

## Security Assumptions

1. **Chainlink Oracles:** Trusted for price feeds (with fallback)
2. **IPFS Network:** Assumed available and reliable
3. **Node Operators:** Rational actors, economically incentivized
4. **DAO Governance:** Assumes token holders act in network's best interest

## Economic Model

### Pricing
- **User pays:** Per-token usage
- **Node earns:** 90% of payment
- **Treasury:** 10% platform fee
- **Burn:** 1% of all transfers

### Staking
- **Minimum:** 10,000 HSK to run node
- **Slash condition:** Failed jobs, downtime, fraud
- **Reward:** Proportional to compute provided

## Scalability Plan

### Phase 1 (Launch)
- Single chain (Ethereum mainnet)
- ~100 nodes
- ~10,000 daily jobs

### Phase 2 (Growth)
- Add L2 deployment
- ~1,000 nodes
- ~1M daily jobs

### Phase 3 (Maturity)
- Multi-chain (Solana, Cosmos)
- ~10,000 nodes
- ~10M daily jobs

## Open Questions

1. **Regulatory:** How to handle potential securities laws?
2. **Competition:** Response if OpenAI launches decentralized competitor?
3. **Token Value:** What drives long-term HSK demand?
4. **Governance:** Prevent plutocracy while maintaining security?

## Rejected Alternatives

### ❌ Centralized API Gateway
- Rejected: Single point of failure, censorship risk

### ❌ Traditional Database (PostgreSQL primary)
- Rejected: Requires trusting operator

### ❌ Proof-of-Stake Consensus
- Rejected: Waste of energy, no useful work

### ❌ Closed Source
- Rejected: Against decentralization ethos

## Future Considerations

- **ZK-Rollups:** For even cheaper verification
- **TEE (Trusted Execution):** Hardware-based security
- **FHE (Fully Homomorphic Encryption):** Private inference
- **Quantum Resistance:** Post-quantum cryptography

---

*Last Updated: 2026-02-23*  
*Next Review: Post-mainnet launch*

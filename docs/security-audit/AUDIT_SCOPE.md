# Synapse Security Audit Scope

## Executive Summary

**Project**: Synapse Network - Decentralized AI Inference Marketplace  
**Contracts**: 5 Solidity contracts (approx. 2,500 LOC)  
**Audit Focus**: Economic security, access control, consensus integrity  
**Timeline**: 2-3 weeks  
**Budget**: $50,000-$100,000 (depending on firm)

---

## Attack Surfaces

### 1. Economic Attacks
| Attack Vector | Impact | Mitigation Status |
|--------------|--------|-------------------|
| Sybil nodes (fake capacity) | Network spam, poor service | ✅ Stake requirement (10k HSK) |
| Fake receipt submission | Unauthorized rewards | ⚠️ Signature verification (partial) |
| Double-claiming rewards | Treasury drain | ✅ Nonce tracking |
| Price oracle manipulation | Incorrect pricing | ⚠️ Manual updates (risk) |
| Front-running claims | MEV extraction | ❌ No protection |

### 2. Access Control
| Component | Risk | Status |
|-----------|------|--------|
| Treasury ownership | Centralized control | ✅ Timelock planned |
| Settlement daemon key | Compromise = drained rewards | ⚠️ Needs key rotation |
| Contract upgradeability | No upgrade pattern | ✅ Immutable (by design) |
| Admin functions | Single point of failure | ⚠️ Multisig recommended |

### 3. Consensus/Integrity
| Risk | Description | Severity |
|------|-------------|----------|
| Challenge job bypass | Nodes serve fake inference | Medium |
| Receipt replay | Old receipts resubmitted | Low (nonces) |
| Model impersonation | Node claims wrong model | Medium |
| Latency gaming | Slow nodes appear healthy | Low (scoring) |

---

## Trust Assumptions

### Explicit Trust
1. **Settlement Daemon**: Honest aggregation of receipts
2. **Router**: Fair job distribution, accurate health scoring
3. **Treasury Admin**: Responsible emission schedule
4. **Price Oracle**: Accurate HSK/USD rate

### Trust Minimization Goals
- Miner rewards: Cryptographically verified (Merkle proofs)
- User charges: On-chain escrow, deterministic pricing
- Node identity: Stake-based, challenge-verified

---

## Invariants (Must Hold)

```solidity
// INVARIANT 1: Total supply never exceeds 1B HSK
assert(hskToken.totalSupply() <= 1_000_000_000 * 1e18);

// INVARIANT 2: Rewards never exceed available treasury
assert(nodeRewards.totalDistributed() <= treasury.balance());

// INVARIANT 3: Escrow deposits >= total charged
assert(computeEscrow.totalDeposits() >= computeEscrow.totalCharged());

// INVARIANT 4: Node stake >= slash amount
assert(nodeRegistry.stake(nodeId) >= slashAmount);

// INVARIANT 5: Nonce uniqueness per node
assert(!nodeRegistry.isNonceUsed(nodeId, nonce));
```

---

## Contract-Specific Risks

### HSKToken.sol
- **Risk**: Minting bypass
- **Check**: Only Treasury can mint, max supply enforced

### Treasury.sol
- **Risk**: Excessive emission
- **Check**: Daily cap, timelock on changes

### ComputeEscrow.sol
- **Risk**: Reentrancy on withdrawal
- **Check**: CEI pattern, ReentrancyGuard

### NodeRegistry.sol
- **Risk**: Slashing bypass
- **Check**: Only owner can slash, events emitted

### NodeRewards.sol
- **Risk**: Double claims
- **Check**: Claimed mapping, Merkle verification

---

## Testnet Attack Scenarios

### Scenario 1: Sybil Attack
```
1. Attacker deploys 100 nodes with minimum stake
2. All nodes submit fake receipts
3. Settlement accepts receipts (no real inference)
4. Attacker claims rewards
```
**Detection**: Challenge job failures, abnormal token patterns

### Scenario 2: Receipt Replay
```
1. Attacker captures valid receipt from honest node
2. Replays receipt with different nonce
3. Gets double rewards
```
**Detection**: Nonce tracking should prevent

### Scenario 3: Front-Running
```
1. Settlement submits Merkle root
2. Attacker sees tx in mempool
3. Attacker submits claim with higher gas
4. Attacker extracts MEV
```
**Mitigation**: Commit-reveal scheme for large claims

---

## Audit Checklist

### Critical (Must Fix)
- [ ] Reentrancy in ComputeEscrow.withdraw
- [ ] Access control on Treasury.mint
- [ ] Overflow checks in reward calculations
- [ ] Signature verification in receipt validation

### High (Should Fix)
- [ ] Timelock on all admin functions
- [ ] Emergency pause circuit breaker
- [ ] Rate limiting on node registration
- [ ] Gas optimization for claim function

### Medium (Nice to Have)
- [ ] Event emission completeness
- [ ] Input validation strictness
- [ ] Documentation completeness

---

## Audit Firms Contact List

| Firm | Specialty | Est. Cost | Timeline |
|------|-----------|-----------|----------|
| Trail of Bits | DeFi, high assurance | $80k-120k | 3 weeks |
| OpenZeppelin | Standards, tooling | $60k-100k | 2-3 weeks |
| Spearbit | DAO, governance | $50k-80k | 2 weeks |
| Code4rena | Community, cost-effective | $25k-50k | 1 week |
| Immunefi | Bug bounty (ongoing) | Variable | Ongoing |

---

## Pre-Audit Checklist

- [ ] All contracts frozen (no commits during audit)
- [ ] 100% test coverage on Foundry
- [ ] Documentation complete (NatSpec)
- [ ] Testnet deployed and functional
- [ ] Known issues documented
- [ ] Access granted to auditors (repo, testnet)

---

## Post-Audit Steps

1. Fix all Critical and High findings
2. Re-audit fixes
3. Deploy to mainnet
4. Launch bug bounty (Immunefi)
5. Monitor for 30 days before scaling

---

*Document Version*: 1.0  
*Last Updated*: 2026-02-23

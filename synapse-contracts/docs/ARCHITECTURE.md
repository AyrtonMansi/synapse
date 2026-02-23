# Synapse Protocol Architecture

## System Overview

Synapse is a decentralized gig economy platform built on Ethereum-compatible chains. It combines DeFi primitives with marketplace mechanics to create a trustless work environment.

## Core Components

### 1. Token Layer (HSKToken)
**Purpose**: Native utility and governance token

**Key Functions**:
- Medium of exchange for platform fees
- Governance voting power
- Staking collateral for reputation
- Mining rewards for ecosystem participants

**Tokenomics**:
- Total Supply: 100,000,000 HSK (fixed cap)
- Initial Supply: 20,000,000 HSK
- Mining Emissions: ~5% annual (declining)
- Vesting: Team, investors, advisors (1-4 year schedules)

### 2. Governance Layer (TreasuryDAO)
**Purpose**: Decentralized decision making

**Governance Process**:
1. **Proposal**: Create executable transaction(s)
2. **Voting**: Token-weighted voting period (3 days)
3. **Timelock**: Execution delay (1 day)
4. **Execution**: Automated on-chain execution

**Votable Actions**:
- Contract upgrades (via proxy)
- Parameter changes (fees, thresholds)
- Treasury allocation
- Arbitrator registration
- Emergency actions (pause/unpause)

### 3. Marketplace Layer (JobRegistry)
**Purpose**: Connect clients and freelancers

**Job Lifecycle**:
```
Created → Funded (escrow) → In Progress → Under Review → Completed
   ↓           ↓                ↓             ↓
Cancelled    Refund         Dispute      Disputed
```

**Payment Flow**:
1. Client creates job with metadata (IPFS)
2. Client funds escrow with milestone structure
3. Freelancer assigned and accepts
4. Milestones completed and approved
5. Funds released minus platform fee (2.5%)

**Reputation System**:
- On-chain ratings (1-5 stars)
- Completed job count
- Total earnings/spend
- Stake amount
- Slash history

### 4. Dispute Layer (DisputeResolver)
**Purpose**: Trustless conflict resolution

**Arbitration Process**:
1. Either party opens dispute
2. Evidence submission period (7 days)
3. Voting period (3 days)
4. Resolution with ruling
5. Appeal window (2 days)
6. Fund distribution

**Ruling Options**:
- 0: Refused to arbitrate (retry)
- 1: Client wins (100% to client)
- 2: Freelancer wins (100% to freelancer)
- 3: Split payment (custom %)

### 5. Oracle Layer (PriceOracle)
**Purpose**: Reliable price data for stable pricing

**Supported Feeds**:
- ETH/USD (Chainlink mainnet)
- USDC/USD
- DAI/USD
- HSK/USD (when available)

**Safety Features**:
- Staleness detection (1 hour default)
- Price deviation checks
- Multiple feed aggregation (future)
- Manual price fallback (DAO set)

### 6. Payment Layer (StreamingPayments)
**Purpose**: Continuous, real-time payments

**Use Cases**:
- Salaries (pay per second worked)
- Retainers (continuous engagement)
- Subscriptions (ongoing services)
- Royalties (continuous payment streams)

**How It Works**:
```
Sender deposits → Stream starts → Recipient withdraws accrued 
                                         ↓
                              (Cancel anytime, prorated refund)
```

## Security Model

### Access Control
```
DEFAULT_ADMIN_ROLE
├── DAO_ROLE (can do anything)
├── PAUSER_ROLE (emergency pause)
├── MINING_ROLE (mint rewards)
├── ARBITRATOR_ROLE (resolve disputes)
└── PROPOSER_ROLE (create proposals)
```

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Admin key compromise | No admin keys, only DAO |
| Contract bugs | OpenZeppelin libs + audits |
| Oracle manipulation | Chainlink + staleness checks |
| Reentrancy | ReentrancyGuard + CEI pattern |
| Front-running | Commit-reveal (future) |
| Sybil attacks | Staking requirements |

### Economic Security
- Freelancer staking required for verification
- Slashing for proven misconduct
- Platform fees fund insurance pool
- Dispute bonds prevent spam

## Integration Points

### External Protocols
- **Chainlink**: Price feeds for stable pricing
- **IPFS**: Off-chain storage (job details, evidence)
- **The Graph**: Indexing for frontend queries

### Internal Call Graph
```
JobRegistry
    ├── calls TreasuryDAO (fee collection)
    ├── calls DisputeResolver (disputes)
    └── calls HSKToken (payments)

TreasuryDAO
    └── calls any contract (via proposals)

DisputeResolver
    ├── calls JobRegistry (resolution)
    └── calls HSKToken (payments)

StreamingPayments
    └── calls TreasuryDAO (fees)
```

## Upgrade Path

All contracts are designed to be controlled by DAO. Upgrades follow:

1. **Proposal**: DAO proposes contract upgrade
2. **Vote**: Token holders vote
3. **Timelock**: Waiting period for security
4. **Execute**: Deploy new contract + migrate state
5. **Verify**: Community verifies correctness

Note: Contracts use immutable patterns where possible. New features deployed as new contracts.

## Scalability Considerations

### Current
- Single chain deployment
- On-chain storage minimal (IPFS for data)
- Efficient data structures

### Future
- Layer 2 deployment (Arbitrum/Optimism)
- Cross-chain messaging
- Sharded dispute resolution
- Off-chain computation (Truebit)

## Monitoring

### Key Metrics
- Total Value Locked (TVL)
- Active jobs
- Completed jobs
- Dispute rate
- Average job value
- Platform revenue

### Alerts
- Large withdrawals
- Dispute creations
- Failed proposals
- Oracle staleness
- Contract pauses

## Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Gas optimization complete
- [ ] Security audit (external)
- [ ] Bug bounty program setup
- [ ] Documentation complete

### Deployment
- [ ] Deploy contracts to testnet
- [ ] Verify on Etherscan
- [ ] Run integration tests
- [ ] Setup monitoring
- [ ] Deploy to mainnet

### Post-deployment
- [ ] Transfer DAO control to governance
- [ ] Initialize price feeds
- [ ] Register initial arbitrators
- [ ] Announce to community
- [ ] Begin bug bounty

## Gas Estimates

| Operation | Gas (approx) |
|-----------|-------------|
| Create job | 260,000 |
| Fund job | 120,000 |
| Approve milestone | 190,000 |
| Create stream | 426,000 |
| Create proposal | 380,000 |
| Cast vote | 98,000 |
| Execute proposal | 97,000 |
| Create dispute | 210,000 |
| Resolve dispute | 85,000 |

## Conclusion

Synapse provides a complete, decentralized infrastructure for the gig economy. By combining DeFi primitives with marketplace mechanics, it creates a trustless environment where participants can work together without intermediaries.

The modular architecture allows for future expansion while maintaining security through battle-tested patterns and comprehensive access control.

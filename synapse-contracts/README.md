# Synapse Smart Contract Suite

A fully decentralized DeFi protocol for the gig economy, built with OpenZeppelin v5 and Hardhat.

## Overview

Synapse is a trustless platform connecting clients with freelancers using:
- **DAO Governance** - No admin keys, fully decentralized
- **Escrow System** - Secure milestone-based payments
- **Reputation System** - On-chain ratings and staking
- **Dispute Resolution** - Kleros/UMA-style arbitration
- **Streaming Payments** - Per-second payment streams
- **Price Oracles** - Chainlink integration for stable pricing

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SYNAPSE ECOSYSTEM                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐             │
│  │   HSKToken   │   │  TreasuryDAO │   │ PriceOracle  │             │
│  │  (ERC20 +    │   │  (Governance)│   │ (Chainlink)  │             │
│  │   Vesting)   │   │              │   │              │             │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘             │
│         │                  │                  │                      │
│         └──────────────────┼──────────────────┘                      │
│                            │                                         │
│         ┌──────────────────┼──────────────────┐                      │
│         │                  │                  │                      │
│  ┌──────▼───────┐   ┌──────▼───────┐   ┌──────▼───────┐             │
│  │  JobRegistry │   │   Dispute    │   │   Streaming  │             │
│  │  (Escrow +   │   │   Resolver   │   │   Payments   │             │
│  │  Reputation) │   │(Arbitration) │   │   (Per-sec)  │             │
│  └──────────────┘   └──────────────┘   └──────────────┘             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Smart Contracts

### 1. HSKToken.sol
The native ERC20 token with advanced features:

- **ERC20 + Permit** - Gasless approvals via signatures
- **Burnable** - Deflationary mechanics
- **Vesting** - Time-locked token releases with cliffs
- **Mining Emissions** - Controlled inflation to incentivize participants
- **DAO Controlled** - No admin minting, all parameters set by DAO

```solidity
// Create vesting schedule for team/investors
function createVestingSchedule(
    address beneficiary,
    uint256 amount,
    uint256 startTime,
    uint256 duration,
    uint256 cliffDuration,
    bool revocable
) external onlyDAO;

// Release vested tokens (callable by anyone)
function releaseVestedTokens(address beneficiary) external;

// Mining rewards for validators/participants
function mintMiningReward(address to, uint256 blocks) external onlyMining;
```

### 2. TreasuryDAO.sol
Decentralized treasury and governance:

- **Proposal System** - Create, vote, and execute proposals
- **Quadratic Voting** - Token-weighted votes
- **Timelock** - Execution delay for security
- **Multi-asset** - Supports ETH and any ERC20

```solidity
// Create proposal
function propose(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description
) external returns (uint256 proposalId);

// Cast vote (0=against, 1=for, 2=abstain)
function castVote(uint256 proposalId, uint8 support) external;

// Execute successful proposal
function execute(uint256 proposalId) external payable;
```

### 3. JobRegistry.sol
Core marketplace for jobs and escrow:

- **Milestone Payments** - Break projects into deliverables
- **Reputation System** - On-chain ratings and history
- **Staking & Slashing** - Economic security for freelancers
- **Dispute Integration** - Automatic handoff to DisputeResolver

```solidity
// Create job posting
function createJob(
    uint256 totalBudget,
    address token,
    uint256 deadline,
    string calldata metadataURI
) external returns (uint256 jobId);

// Fund with escrow
function fundJob(uint256 jobId) external;

// Milestone management
function addMilestone(...), startMilestone(...), submitMilestone(...), approveMilestone(...)

// Rate completed work
function rateParty(uint256 jobId, uint256 rating) external; // 1-5 stars

// Stake for reputation
function depositStake(address token, uint256 amount) external;
```

### 4. DisputeResolver.sol
Decentralized arbitration system:

- **Multi-arbitrator** - Support for Kleros/UMA or custom arbitrators
- **Evidence Submission** - IPFS-based evidence storage
- **Voting Period** - Time-bound resolution
- **Appeals** - Multi-level dispute resolution
- **Enforcement** - Automatic fund distribution

```solidity
// Create dispute
function createDispute(
    uint256 jobId,
    address client,
    address freelancer,
    uint256 escrowAmount,
    address token,
    bytes32 evidenceHash,
    address preferredArbitrator
) external returns (uint256 disputeId);

// Submit evidence
function submitEvidence(uint256 disputeId, bytes32 evidenceHash) external;

// Resolve with ruling (1=client wins, 2=freelancer wins, 3=split)
function resolveDispute(uint256 disputeId, Ruling ruling, uint256 clientShare, uint256 freelancerShare) external;

// Appeal decision
function fileAppeal(uint256 disputeId, uint256 deposit, bytes32 evidenceHash) external returns (uint256 newDisputeId);
```

### 5. PriceOracle.sol
Chainlink-powered price feeds:

- **Multi-asset Support** - Any asset with Chainlink feed
- **Staleness Detection** - Reject outdated prices
- **USD Conversion** - Calculate values in stable terms
- **Cross-rate Conversion** - Convert between any two assets

```solidity
// Add Chainlink feed (DAO only)
function addPriceFeed(bytes32 asset, address feedAddress, uint256 heartbeat) external;

// Get latest price
function getLatestPrice(bytes32 asset) external view returns (uint256 price, uint8 decimals, uint256 timestamp);

// Convert between assets
function convert(bytes32 fromAsset, bytes32 toAsset, uint256 amount) external view returns (uint256);

// Calculate USD value
function getUSDValue(bytes32 asset, uint256 amount, uint8 tokenDecimals) external view returns (uint256);
```

### 6. StreamingPayments.sol
Superfluid-style money streaming:

- **Per-second Payments** - Continuous streaming
- **Cancel Anytime** - Prorated refunds
- **Extendable** - Add more funds/time
- **Gas Efficient** - Withdraw accumulated anytime

```solidity
// Create payment stream
function createStream(
    address recipient,
    address token,
    uint256 ratePerSecond,
    uint256 deposit,
    uint256 duration
) external returns (uint256 streamId);

// Withdraw accumulated (recipient only)
function withdrawFromStream(uint256 streamId) external;

// Cancel stream (sender gets refund of remaining)
function cancelStream(uint256 streamId) external;

// Check withdrawable amount
function calculateWithdrawableAmount(uint256 streamId) external view returns (uint256);
```

## Key Features

### 🛡️ No Admin Keys
- All contracts use AccessControl with only DAO_ROLE
- No `onlyOwner` patterns
- All upgrades/changes require DAO vote

### 🔒 Security
- ReentrancyGuard on all state-changing functions
- Checks-Effects-Interactions pattern
- Integer overflow protection (Solidity 0.8+)
- Comprehensive input validation

### ⚡ Gas Optimization
- Optimizer enabled (200 runs)
- viaIR compilation for stack optimization
- Efficient storage layouts
- Minimal external calls

### 🌐 Interoperability
- ERC20 standard compliance
- Chainlink oracle integration ready
- Cross-contract communication via interfaces

## Deployment

### Prerequisites
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your RPC URLs and private key
```

### Local Deployment
```bash
# Start local node
npx hardhat node

# Deploy to localhost
npm run deploy:local
```

### Sepolia Testnet
```bash
# Deploy to Sepolia
npm run deploy:sepolia
```

### Mainnet Deployment
```bash
# Deploy to mainnet (use with caution!)
npx hardhat run scripts/deploy.ts --network mainnet
```

## Testing

```bash
# Run all tests
npm test

# Run with gas report
REPORT_GAS=true npm test

# Run specific test file
npx hardhat test test/Synapse.test.cjs
```

## Contract Addresses (Example)

### Sepolia Testnet
| Contract | Address |
|----------|---------|
| HSKToken | 0x... |
| TreasuryDAO | 0x... |
| JobRegistry | 0x... |
| DisputeResolver | 0x... |
| PriceOracle | 0x... |
| StreamingPayments | 0x... |

## Usage Examples

### Creating a Job
```javascript
const tx = await jobRegistry.createJob(
  ethers.parseEther("1000"),    // Budget: 1000 HSK
  hskTokenAddress,               // Payment token
  deadline,                      // Unix timestamp
  "ipfs://QmJobDetails..."      // Job description
);
```

### Starting a Payment Stream
```javascript
const rate = ethers.parseEther("0.001"); // 0.001 HSK/sec
const duration = 30 * 24 * 60 * 60;      // 30 days
const deposit = rate * BigInt(duration);

await streamingPayments.createStream(
  freelancerAddress,
  hskTokenAddress,
  rate,
  deposit,
  duration
);
```

### Creating a DAO Proposal
```javascript
const targets = [treasuryAddress];
const values = [0];
const calldatas = [treasury.interface.encodeFunctionData("recoverTokens", [...])];

await treasuryDAO.propose(targets, values, calldatas, "Fund project X");
```

## Development

### Project Structure
```
synapse-contracts/
├── contracts/
│   ├── HSKToken.sol
│   ├── TreasuryDAO.sol
│   ├── JobRegistry.sol
│   ├── DisputeResolver.sol
│   ├── PriceOracle.sol
│   ├── StreamingPayments.sol
│   └── mocks/
│       └── MockAggregator.sol
├── test/
│   └── Synapse.test.cjs
├── scripts/
│   └── deploy.ts
├── docs/
└── hardhat.config.cjs
```

### Adding New Features
1. Create contract in `contracts/`
2. Add tests in `test/`
3. Update deployment script
4. Document in README

### Security Considerations
- All contracts use OpenZeppelin v5 battle-tested libraries
- No external calls in reentrant functions
- All state changes happen before external calls
- Comprehensive access control

## License

MIT License - see LICENSE file for details

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Resources

- [OpenZeppelin Contracts v5](https://docs.openzeppelin.com/contracts/5.x/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Chainlink Price Feeds](https://docs.chain.link/data-feeds)
- [EIP-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)

## Contact

For questions or support, please open an issue on GitHub.

---

**Disclaimer**: This software is provided as-is. Use at your own risk. Always audit smart contracts before mainnet deployment.
# Synapse Governance & DAO Features

This module provides comprehensive DAO governance functionality for the Synapse Protocol, including proposal management, voting with delegation, treasury analytics, timelock visualization, and Gnosis Safe multi-sig integration.

## Features

### 1. DAO Dashboard
- **Proposal Creation Interface**: Create proposals with multiple actions, choose proposal types (General, Treasury, Parameter, Upgrade), and enable quadratic voting
- **Voting Interface**: Cast votes (For/Against/Abstain) with real-time results, view voting power, and check voting receipts
- **Treasury Management UI**: View treasury assets, spending proposals, and revenue sharing
- **Delegation System**: Delegate voting power to trusted community members, track delegations, and revoke when needed

### 2. Advanced Governance Features
- **Quadratic Voting**: Option to apply square root to vote weights for more democratic outcomes
- **Vote Delegation Tracking**: Full delegation history and current delegation status
- **Proposal Templates**: Pre-defined proposal templates for common actions
- **Timelock Visualization**: Visual timeline of delayed governance operations with progress tracking

### 3. Treasury Analytics
- **Real-time Treasury Value**: Track total value in USD across all assets (ETH + ERC20 tokens)
- **Spending Proposals**: Propose and track spending with categories and approval workflows
- **Revenue Sharing Calculator**: Calculate burn, staking, and treasury allocations from revenue
- **Token Burn Tracking**: Historical burn data with value at time of burn

### 4. Multi-sig Integration
- **Gnosis Safe Support**: Register and manage Gnosis Safe wallets
- **Threshold Management**: Configure required confirmations per Safe
- **Transaction Builder**: Create, sign, and execute multi-sig transactions

## Smart Contracts

### SynapseGovernor.sol
The main governance contract handling:
- Proposal creation and voting
- Vote delegation
- Quadratic voting calculations
- Proposal queuing and execution

### SynapseTimelock.sol
Timelock controller for delayed execution:
- Operation scheduling with configurable delays
- Batch operations support
- Progress visualization data
- Emergency cancellation

### SynapseGnosisSafeModule.sol
Gnosis Safe integration module:
- Safe registration and management
- Transaction request and approval workflow
- Signature tracking
- Execution coordination

### TreasuryAnalytics.sol
Treasury tracking and analytics:
- Asset price tracking
- Spending proposal management
- Revenue share calculations
- Token burn recording

## Frontend Components

### ProposalCard
Displays proposal details with:
- State indicator (Pending, Active, Succeeded, etc.)
- Voting progress bars
- Quadratic voting breakdown (if enabled)
- Action buttons (Vote, Queue, Execute, Cancel)

### ProposalCreationModal
Three-step proposal creation:
1. Choose proposal type and voting method
2. Enter title and description
3. Add actions (targets, values, calldatas)

### TreasuryDashboard
Comprehensive treasury view:
- Asset allocation pie chart
- Revenue share calculator
- Burn history
- Spending proposals by category

### DelegationPanel
Vote delegation management:
- Current delegation status
- Delegate search and selection
- Delegation history
- Revocation functionality

### TimelockVisualization
Visual timelock tracker:
- Operation timeline
- Progress indicators
- State filtering
- Execute/Cancel actions

### GnosisSafeManager
Multi-sig wallet management:
- Safe registration
- Threshold configuration
- Transaction creation and signing
- Delegate management

## Usage

### Setting up Environment Variables

Add to your `.env` file:

```bash
VITE_GOVERNOR_ADDRESS=0x...
VITE_TREASURY_ADDRESS=0x...
VITE_ANALYTICS_ADDRESS=0x...
VITE_TIMELOCK_ADDRESS=0x...
VITE_SAFE_MODULE_ADDRESS=0x...
```

### Using the Governance Dashboard

```tsx
import { GovernanceDashboard } from './governance';

function App() {
  return (
    <GovernanceDashboard
      governorAddress={import.meta.env.VITE_GOVERNOR_ADDRESS}
      treasuryAddress={import.meta.env.VITE_TREASURY_ADDRESS}
      analyticsAddress={import.meta.env.VITE_ANALYTICS_ADDRESS}
      timelockAddress={import.meta.env.VITE_TIMELOCK_ADDRESS}
      safeModuleAddress={import.meta.env.VITE_SAFE_MODULE_ADDRESS}
    />
  );
}
```

### Using Individual Hooks

```tsx
import { useGovernanceContract, useTreasuryAnalytics } from './governance/hooks';

function MyComponent() {
  const { 
    proposalCount, 
    votingPower, 
    createProposal, 
    castVote 
  } = useGovernanceContract(governorAddress);

  const { 
    totalValueUSD, 
    assets, 
    takeSnapshot 
  } = useTreasuryAnalytics(analyticsAddress, treasuryAddress);

  // ...
}
```

## Contract Deployment

1. Deploy `SynapseGovernor.sol` with governance token and timelock addresses
2. Deploy `SynapseTimelock.sol` with minimum/maximum delay settings
3. Deploy `TreasuryAnalytics.sol` with treasury and oracle addresses
4. Deploy `SynapseGnosisSafeModule.sol` with governor and treasury addresses
5. Configure roles and permissions
6. Update frontend environment variables

## Testing

Run contract tests:
```bash
cd synapse-contracts
npm test
```

Run frontend tests:
```bash
cd synapse-frontend
npm test
```

## Security Considerations

- All treasury operations require DAO approval
- Timelock prevents immediate execution of sensitive operations
- Multi-sig requirement for large transfers
- Quadratic voting caps prevent whale dominance
- Delegation can be revoked at any time

## License

MIT License - See LICENSE file for details
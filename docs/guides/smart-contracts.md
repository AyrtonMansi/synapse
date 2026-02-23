# Smart Contract Interaction

## Overview

Synapse provides smart contracts for token operations, staking, task management, and governance.

## Quick Reference

### Contract Addresses (Mainnet)

| Contract | Address |
|----------|---------|
| SynapseToken | `0x1a2b...3c4d` |
| StakingManager | `0x5e6f...7g8h` |
| ComputeMarketplace | `0x9i0j...1k2l` |
| Governance | `0x3m4n...5o6p` |

## Token Operations

```javascript
// Using ethers.js
import { ethers } from 'ethers';
import { SynapseToken__factory } from '@synapse/contracts';

const provider = new ethers.JsonRpcProvider('https://rpc.synapse.io');
const signer = new ethers.Wallet(privateKey, provider);

const token = SynapseToken__factory.connect(tokenAddress, signer);

// Check balance
const balance = await token.balanceOf(address);

// Transfer
await token.transfer(recipient, ethers.parseEther('100'));

// Approve
await token.approve(spender, ethers.parseEther('1000'));
```

## Staking

```javascript
import { StakingManager__factory } from '@synapse/contracts';

const staking = StakingManager__factory.connect(stakingAddress, signer);

// Stake tokens
await staking.stake(ethers.parseEther('50000'));

// Register node
await staking.registerNode(
  hardwareSpecs,
  attestationProof,
  { value: ethers.parseEther('50000') }
);

// Claim rewards
await staking.claimRewards();

// Unstake (7-day cooldown)
await staking.initiateUnstake(ethers.parseEther('10000'));
```

## Governance

```javascript
import { Governance__factory } from '@synapse/contracts';

const governance = Governance__factory.connect(governanceAddress, signer);

// Create proposal
await governance.propose(
  [targetContract],
  [0],
  [calldata],
  "Proposal description"
);

// Vote
await governance.castVote(proposalId, 1); // 0=against, 1=for, 2=abstain

// Execute
await governance.execute(proposalId);
```

## Events

```javascript
// Listen for events
staking.on('StakeDeposited', (user, amount, event) => {
  console.log(`${user} staked ${ethers.formatEther(amount)} SYN`);
});

marketplace.on('TaskCompleted', (taskId, node, reward) => {
  console.log(`Task ${taskId} completed by ${node}`);
});
```

## Python Example

```python
from web3 import Web3

w3 = Web3(Web3.HTTPProvider('https://rpc.synapse.io'))

# Load contract
token = w3.eth.contract(address=token_address, abi=token_abi)

# Call function
balance = token.functions.balanceOf(address).call()

# Send transaction
tx = token.functions.transfer(
    recipient,
    w3.to_wei(100, 'ether')
).build_transaction({
    'from': account.address,
    'nonce': w3.eth.get_transaction_count(account.address),
    'gas': 100000,
    'gasPrice': w3.eth.gas_price
})

signed = w3.eth.account.sign_transaction(tx, private_key)
tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
```

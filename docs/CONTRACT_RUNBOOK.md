# Contract Interaction Runbook

## Quick Reference: Contract Addresses

See `hsk-contracts/deployment-testnet.json` for current testnet addresses.

## Common Operations

### 1. Check HSK Balance
```bash
cast call <HSK_TOKEN> "balanceOf(address)" <ADDRESS> --rpc-url $RPC_URL
```

### 2. Transfer HSK
```bash
cast send <HSK_TOKEN> "transfer(address,uint256)" <TO> <AMOUNT> \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY
```

### 3. Register Node (Miner)
```bash
# Stake 10,000 HSK minimum
cast send <NODE_REGISTRY> "register(bytes32,bytes32,string,string[])" \
    <NODE_ID> <PUBKEY> <ENDPOINT> <MODELS_JSON> \
    --rpc-url $RPC_URL \
    --private-key $MINER_KEY \
    --value 10000000000000000000000
```

### 4. Deposit to Escrow (User)
```bash
# Approve first
cast send <HSK_TOKEN> "approve(address,uint256)" <ESCROW> <AMOUNT> \
    --rpc-url $RPC_URL \
    --private-key $USER_KEY

# Deposit
cast send <ESCROW> "deposit(uint256)" <AMOUNT> \
    --rpc-url $RPC_URL \
    --private-key $USER_KEY
```

### 5. Check Escrow Balance
```bash
cast call <ESCROW> "deposits(address)" <USER_ADDR> --rpc-url $RPC_URL
```

### 6. Submit Epoch Merkle Root (Settlement Service)
```bash
cast send <NODE_REWARDS> "submitEpochMerkleRoot(uint256,bytes32,uint256)" \
    <EPOCH_ID> <MERKLE_ROOT> <TOTAL_REWARDS> \
    --rpc-url $RPC_URL \
    --private-key $SETTLEMENT_KEY
```

### 7. Claim Rewards (Miner)
```bash
cast send <NODE_REWARDS> "claim(uint256,uint256,bytes32[])" \
    <EPOCH_ID> <AMOUNT> <PROOF_ARRAY> \
    --rpc-url $RPC_URL \
    --private-key $MINER_KEY
```

### 8. Slash Malicious Node (Admin)
```bash
cast send <NODE_REGISTRY> "slash(bytes32,uint256,string)" \
    <NODE_ID> <AMOUNT> "Fraud reason" \
    --rpc-url $RPC_URL \
    --private-key $ADMIN_KEY
```

## Emergency Procedures

### Pause Contracts
```bash
# HSKToken
cast send <HSK_TOKEN> "pause()" --rpc-url $RPC_URL --private-key $ADMIN_KEY

# Treasury
cast send <TREASURY> "pause()" --rpc-url $RPC_URL --private-key $ADMIN_KEY

# ComputeEscrow
cast send <ESCROW> "pause()" --rpc-url $RPC_URL --private-key $ADMIN_KEY
```

### Update Treasury
```bash
cast send <HSK_TOKEN> "setTreasury(address)" <NEW_TREASURY> \
    --rpc-url $RPC_URL --private-key $ADMIN_KEY
```

## Gas Estimation

| Operation | Typical Gas |
|-----------|-------------|
| HSKToken.transfer | ~65,000 |
| NodeRegistry.register | ~200,000 |
| ComputeEscrow.deposit | ~110,000 |
| ComputeEscrow.charge | ~170,000 |
| NodeRewards.claim | ~365,000 |
| Treasury.executeMint | ~210,000 |

## Troubleshooting

### "Insufficient funds"
- Miner needs ETH for gas
- User needs HSK for escrow deposit

### "OnlyTreasury" error
- Only Treasury contract can mint HSK
- Check Treasury address is set correctly in HSKToken

### "UnauthorizedProvider" error
- Gateway address not added as provider in ComputeEscrow
- Call `addProvider(gatewayAddress)` as escrow owner

### "NonceAlreadyUsed" error
- Receipt nonce already claimed
- Each job must use unique nonce

## Monitoring

### Check Contract Status
```bash
# Is paused?
cast call <CONTRACT> "paused()" --rpc-url $RPC_URL

# Current owner
cast call <CONTRACT> "owner()" --rpc-url $RPC_URL

# Node count
cast call <NODE_REGISTRY> "activeNodeCount()" --rpc-url $RPC_URL
```

### Settlement Status
```bash
# Current epoch
cast call <NODE_REWARDS> "currentEpoch()" --rpc-url $RPC_URL

# Epoch duration
cast call <NODE_REWARDS> "epochDuration()" --rpc-url $RPC_URL

# Claim expiration
cast call <NODE_REWARDS> "claimExpiration()" --rpc-url $RPC_URL
```

## Mainnet Deployment Checklist

- [ ] All contracts deployed and verified
- [ ] Treasury funded with initial HSK
- [ ] NodeRewards whitelisted as minter
- [ ] Gateway added as escrow provider
- [ ] Owner keys secured in multisig
- [ ] Timelock configured (48+ hours)
- [ ] Emergency pause procedures tested
- [ ] Settlement daemon wallet funded
- [ ] Monitoring alerts configured
- [ ] Incident response team notified

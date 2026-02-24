# Synapse Contract Deployment Log
**Date**: 2026-02-23 23:12+10  
**Mode**: Contract Activation  
**Status**: FAILED - Compilation errors, no testnet deployment

---

## Commands Executed

### 1. Generated Test Wallet
```bash
$ cast wallet new --json
```
**Output**:
```json
{
  "address": "0x27C678e0952a7408e8667f9215d0372297dD5AbF",
  "private_key": "0xdb7f8f3900ae3dcbeb7b44ee6de839699f9d75f051e6370d8ed8cec795cd58b1"
}
```

### 2. Attempted Testnet Deployment
```bash
$ PRIVATE_KEY="0xdb7f8f3900ae3dcbeb7b44ee6de839699f9d75f051e6370d8ed8cec795cd58b1" \
  RPC_URL="https://sepolia.base.org" \
  ./scripts/deploy-testnet.sh
```

---

## Deployment Results

| Contract | Status | Error |
|----------|--------|-------|
| HSKToken | ❌ FAIL | Parser error in forge create |
| Treasury | ❌ FAIL | Parser error |
| ComputeEscrow | ❌ FAIL | Parser error |
| NodeRegistry | ❌ **FAIL** | Compiler error (Critical) |
| NodeRewards | ❌ FAIL | Parser error |

---

## Critical Error: NodeRegistry Compilation

```
Error (1834): Copying nested calldata dynamic arrays to storage is not implemented in the old code generator.
  --> src/NodeRegistry.sol:16:1:
   |
16 | contract NodeRegistry is Ownable, Pausable, ReentrancyGuard {
   | ^ (Relevant source part starts from here)
```

**Root Cause**: The `models` array (string[]) passed to `register()` cannot be directly stored in storage with the current Solidity version/codegen.

**Affected Code**: `src/NodeRegistry.sol` line 88-95
```solidity
function register(
    bytes32 nodeId,
    bytes32 pubkey,
    string calldata endpoint,
    string[] calldata models  // <-- Problem: copying calldata array to storage
) external payable nonReentrant whenNotPaused {
    // ...
    node.models = models;  // <-- This line causes the error
}
```

---

## Contract Addresses

**NONE DEPLOYED** - All deployments failed before reaching testnet.

Target addresses would have been:
- HSKToken: `TBD`
- Treasury: `TBD`
- ComputeEscrow: `TBD`
- NodeRegistry: `TBD`
- NodeRewards: `TBD`

---

## Claim Transaction Hash

**NONE** - No contracts deployed, no claims possible.

---

## Validation Logs

### Pre-deployment Checklist
- [x] Test wallet generated
- [x] RPC endpoint accessible (Base Sepolia)
- [x] Deployment script executable
- [ ] Contracts compile ✗
- [ ] Deployer has ETH ✗ (not checked due to early failure)

### Compilation Output
```
$ forge build
[⠃] Compiling...
[⠆] Compiling 28 files with 0.8.20
[⠰] Compiling 30 files with 0.8.20
Error: 
Compiler run failed:
Error (1834): Copying nested calldata dynamic arrays to storage is not implemented in the old code generator.
```

---

## Runbook for Redeploy

### Prerequisites
1. **Fix NodeRegistry.sol**:
   ```solidity
   // Change from:
   string[] calldata models
   
   // To either:
   string[] memory models  // If not storing
   // OR implement manual array copying
   ```

2. **Verify Foundry Version**:
   ```bash
   forge --version
   # Should be >= 0.2.0 for modern codegen
   ```

3. **Get Testnet ETH**:
   ```bash
   # For Base Sepolia
   https://www.alchemy.com/faucets/base-sepolia
   ```

### Deployment Steps (After Fix)
```bash
# 1. Set environment
export PRIVATE_KEY="0x..."
export RPC_URL="https://sepolia.base.org"
export ETHERSCAN_API_KEY="..."

# 2. Run deployment
./scripts/deploy-testnet.sh

# 3. Verify output
ls hsk-contracts/deployment-testnet.json

# 4. Test deployment
cast call <HSK_TOKEN> "totalSupply()" --rpc-url $RPC_URL
```

### Simulation Steps (After Deploy)
```bash
# 1. User deposit
export USER_KEY="0x..."
cast send <HSK_TOKEN> "approve(address,uint256)" <ESCROW> 1000000000000000000000 --rpc-url $RPC_URL --private-key $USER_KEY
cast send <ESCROW> "deposit(uint256)" 100000000000000000000 --rpc-url $RPC_URL --private-key $USER_KEY

# 2. Node stake
export MINER_KEY="0x..."
export NODE_ID=$(cast keccak "node-1")
cast send <REGISTRY> "register(bytes32,bytes32,string,string[])" $NODE_ID $(cast keccak "pubkey") "wss://node1.com" '["deepseek-v3"]' --rpc-url $RPC_URL --private-key $MINER_KEY --value 10000000000000000000000

# 3. Epoch close (settlement daemon or manual)
cast send <REWARDS> "submitEpochMerkleRoot(uint256,bytes32,uint256)" 0 $(cast keccak "root") 10000000000000000000 --rpc-url $RPC_URL --private-key $SETTLEMENT_KEY

# 4. Miner claim
cast send <REWARDS> "claim(uint256,uint256,bytes32[])" 0 10000000000000000000 [] --rpc-url $RPC_URL --private-key $MINER_KEY
```

---

## Blockers Summary

| Blocker | Severity | Resolution |
|---------|----------|------------|
| NodeRegistry compilation | **CRITICAL** | Fix array storage pattern |
| Script parser errors | HIGH | Debug forge command escaping |
| No testnet ETH | MEDIUM | Get from faucet |
| Etherscan API key | LOW | Optional for testnet |

---

## Verdict

**Contracts NOT deployed.**  
**Status**: Compilation failure blocks all deployments.  
**ETA to working deployment**: 2-4 hours (after fixing NodeRegistry).

---

*Log completed*: 2026-02-23 23:13+10  
*Contracts deployed*: 0  
*Transactions*: 0  
*Claims executed*: 0

# Synapse Settlement Bridge: Off-Chain → On-Chain

> How compute work becomes HSK rewards

## Overview

The settlement bridge connects decentralized GPU mining to blockchain payments through a trust-minimized pipeline:

```
Job Completion → Signed Receipt → Earnings Ledger → Merkle Root → Contract → Claim
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           OFF-CHAIN (Trustless Compute)                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐                 │
│  │  vLLM    │───▶│  Receipt │───▶│  Gateway │───▶│   DB     │                 │
│  │  Node    │    │  Signed  │    │   Logs   │    │ (SQLite) │                 │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘                 │
│                                                        │                        │
│                            ┌───────────────────────────┘                        │
│                            │                                                    │
│                            ▼                                                    │
│                   ┌─────────────────┐                                          │
│                   │ Settlement      │                                          │
│                   │ Service         │                                          │
│                   │ (Node.js)       │                                          │
│                   └────────┬────────┘                                          │
│                            │                                                    │
└────────────────────────────┼────────────────────────────────────────────────────┘
                             │
                             │ Epoch Finalization (24h)
                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ON-CHAIN (Ethereum L2)                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                          NodeRewards Contract                             │  │
│  │  ┌────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │  │
│  │  │  submitEpoch   │────▶│  Merkle Root     │────▶│  Rewards Locked  │    │  │
│  │  │  MerkleRoot()  │     │  Stored          │     │  (Claimable)     │    │  │
│  │  └────────────────┘     └──────────────────┘     └──────────────────┘    │  │
│  │                            ▲                                              │  │
│  │                            │                                              │  │
│  │  ┌─────────────────────────┴──────────────────┐                          │  │
│  │  │              NODE CLAIMS                    │                          │  │
│  │  │  claim(epoch, amount, proof[]) ─────────────┼─────▶ HSK Transfer      │  │
│  │  │  MerkleProof.verify(leaf, root, proof)     │                          │  │
│  │  └─────────────────────────────────────────────┘                          │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## The 5-Stage Pipeline

### Stage 1: Job Execution → Signed Receipt

**Where:** Node Agent (miner's GPU machine)

```typescript
// Node Agent executes inference
const output = await vllm.generate(prompt);

// Creates cryptographic proof
const receipt = {
  jobId: "job_abc123",
  nodeId: "node_0x7f3a...",
  model: "deepseek-v3",
  nonce: 123456,           // Prevent replay attacks
  promptHash: sha256(prompt),
  outputHash: sha256(output),
  tokensIn: 150,
  tokensOut: 250,
  timestamp: Date.now()
};

// Signs with node's Ed25519 key
const signature = ed25519.sign(receipt, nodePrivateKey);
```

**Security:**
- Unique nonce per job (on-chain nonce tracking)
- Ed25519 signatures (fast, secure)
- Key fingerprint identifies node

---

### Stage 2: Receipt → Earnings Ledger

**Where:** Gateway API + Settlement Service

```typescript
// Gateway receives result + receipt + signature
const result = {
  jobId, nodeId, output,
  signature,  // Ed25519 signature
  receipt     // Full receipt data
};

// 1. Verify signature
const isValid = ed25519.verify(
  signature,
  receipt,
  nodePublicKey
);

// 2. Verify nonce (prevent double-spending)
const nonceUsed = await nodeRegistry.isNonceUsed(nodeId, nonce);
if (nonceUsed) throw new Error("Nonce replay detected");

// 3. Mark nonce as used
await nodeRegistry.useNonce(nodeId, nonce);

// 4. Record in earnings ledger (SQLite)
db.run(`
  INSERT INTO epoch_receipts 
  (job_id, node_id, epoch_id, tokens_in, tokens_out, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`, [jobId, nodeId, currentEpoch, tokensIn, tokensOut, now]);

// 5. Charge user escrow
await computeEscrow.charge(userAddress, cost);
```

**Database Schema:**
```sql
CREATE TABLE epoch_receipts (
  job_id TEXT,           -- Unique job identifier
  node_id TEXT,          -- Node fingerprint
  epoch_id INTEGER,      -- Which epoch (24h period)
  tokens_in INTEGER,     -- Input tokens processed
  tokens_out INTEGER,    -- Output tokens generated
  created_at INTEGER     -- Unix timestamp
);
```

---

### Stage 3: Epoch Aggregation → Merkle Tree

**Where:** Settlement Service (runs every 24 hours)

```typescript
// 1. Aggregate all receipts for current epoch
const receipts = db.query(`
  SELECT node_id, 
         SUM(tokens_in + tokens_out) as total_tokens,
         COUNT(*) as jobs
  FROM epoch_receipts
  WHERE epoch_id = ?
  GROUP BY node_id
`, [currentEpoch]);

// 2. Calculate rewards per node
const earnings = receipts.map(r => {
  const proportion = r.total_tokens / totalNetworkTokens;
  const baseReward = proportion * EPOCH_REWARD_POOL;
  
  // Apply challenge pass rate multiplier
  const challengeRate = getChallengePassRate(r.node_id);
  const adjustedReward = baseReward * challengeRate;
  
  return {
    wallet: getNodeWallet(r.node_id),  // ETH address
    amount: adjustedReward
  };
});

// 3. Build Merkle tree
import { createMerkleTree, getProof } from './merkle';

const distribution = new Map(
  earnings.map(e => [e.wallet, e.amount])
);

const tree = createMerkleTree(distribution);
// tree.root: bytes32
// tree.leaves: [{wallet, amount, index, hash}]
```

**Merkle Tree Structure:**
```
                    Root Hash
                        │
            ┌───────────┴───────────┐
            │                       │
        Hash(AB)                Hash(CD)
            │                       │
      ┌─────┴─────┐           ┌─────┴─────┐
      │           │           │           │
   Hash(A)    Hash(B)     Hash(C)     Hash(D)
      │           │           │           │
   Leaf A     Leaf B      Leaf C      Leaf D
   (addr1,   (addr2,    (addr3,    (addr4,
   1000)     2500)      800)       1200)
```

---

### Stage 4: Merkle Root → Smart Contract

**Where:** Ethereum L2 (e.g., Base, Arbitrum)

```solidity
// Settlement service submits to contract
transaction = await nodeRewards.submitEpochMerkleRoot(
  epochId: 42,
  merkleRoot: "0x7f3a...b2c9",  // 32 bytes
  totalRewards: 1000000 * 10**18  // 1M HSK
);

await transaction.wait();  // Confirmed on-chain
```

**Contract Storage:**
```solidity
struct Epoch {
  bytes32 merkleRoot;      // Root hash
  uint256 totalRewards;    // Total HSK for this epoch
  uint256 claimedRewards;  // How much claimed so far
  uint256 startTime;
  uint256 endTime;
  bool finalized;          // Can now claim
}

mapping(uint256 => Epoch) public epochs;
```

**After submission:**
- Root is immutable (can't be changed)
- Miners can now claim
- 7-day claim window before rollover

---

### Stage 5: Node Claim → HSK Payout

**Where:** Node owner claims via contract

```solidity
// Miner calls claim with proof
function claim(
  uint256 epochId,        // Which epoch
  uint256 amount,         // Their reward amount
  bytes32[] calldata merkleProof  // Proof from settlement service
) external {
  Epoch storage epoch = epochs[epochId];
  require(epoch.finalized, "Epoch not finalized");
  require(!hasClaimed[epochId][msg.sender], "Already claimed");
  
  // Verify proof
  bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
  require(
    MerkleProof.verify(merkleProof, epoch.merkleRoot, leaf),
    "Invalid proof"
  );
  
  // Mark claimed
  hasClaimed[epochId][msg.sender] = true;
  epoch.claimedRewards += amount;
  
  // Transfer HSK (minus 5% protocol fee)
  uint256 fee = amount * 500 / 10000;  // 5%
  uint256 netAmount = amount - fee;
  
  hskToken.transfer(msg.sender, netAmount);
  hskToken.transfer(treasury, fee);
  
  emit RewardsClaimed(epochId, msg.sender, amount);
}
```

**Claim Flow:**
```
Node Owner                     Settlement Service
     │                                 │
     │─── GET /claim-proof ─────────▶│
     │         (wallet, epoch)       │
     │                                 │
     │◄─── {amount, proof[]} ────────│
     │                                 │
     │─── claim(epoch, amount, proof)─┼───────▶ Contract
     │         (on-chain tx)         │
     │                                 │
     │◄─── HSK tokens received ◄─────┤
```

---

## Trust Assumptions

| Component | Trust Level | Mitigation |
|-----------|-------------|------------|
| Node Agent | Trustless | Signed receipts, slashing |
| Gateway API | Semi-trusted | Receipts signed, can be audited |
| Settlement Service | Trusted | Multi-sig upgrade, open source |
| Merkle Root | Trustless | On-chain, verifiable |
| Contract | Trustless | Audited, immutable |

**Risk:** Settlement service could submit wrong Merkle root
**Mitigation:** 
- Multi-sig required (2-of-3 operators)
- Roots published off-chain for verification
- 7-day delay before claims open (challenge window)

---

## Gas Optimization

| Operation | Gas Cost | Frequency |
|-----------|----------|-----------|
| Submit Merkle Root | ~50,000 | Daily (1x per epoch) |
| Claim Reward | ~65,000 | Per miner per epoch |
| Batch Claim (10) | ~120,000 | 10 miners together |

**At 1000 miners:**
- 1000 individual claims: 65M gas (~$65 on L2)
- Batch into 100 groups: 1.2M gas (~$1.20)

---

## Current Implementation Status

| Component | Status | File |
|-----------|--------|------|
| Receipt Signing | ✅ Complete | `services/node-agent/src/index.ts` |
| Receipt Verification | ✅ Complete | `services/gateway-api/src/index.ts` |
| Earnings Ledger | ✅ Complete | SQLite schema in settlement |
| Merkle Tree | ✅ Complete | `services/settlement/src/merkle.ts` |
| Root Submission | ✅ Complete | `services/settlement/src/index.ts` |
| Claim Verification | ✅ Complete | `contracts/src/NodeRewards.sol` |
| Token Transfer | ✅ Complete | `contracts/src/HSKToken.sol` |

---

## Running the Settlement Bridge

```bash
# 1. Deploy contracts
npx hardhat run contracts/scripts/deploy.js --network holesky

# 2. Start settlement daemon
node services/settlement/src/daemon.js

# 3. Verify epoch finalization
curl http://localhost:3003/stats
# {
#   "currentEpoch": 42,
#   "totalSettled": "1000000000000000000000", // 1000 HSK
#   "totalProtocolFees": "50000000000000000000", // 50 HSK
#   "pendingClaims": 47
# }

# 4. Get claim proof for a miner
curl http://localhost:3003/claim-proof \
  -d '{"wallet": "0x123...", "epoch": 42}'
# {
#   "amount": "25000000000000000000", // 25 HSK
#   "proof": ["0xabc...", "0xdef..."]
# }

# 5. Miner claims on-chain
# (via contract UI or direct contract call)
```

---

## Summary

| Stage | Input | Output | Time |
|-------|-------|--------|------|
| 1. Job | Prompt | Signed Receipt | ~1s |
| 2. Ledger | Receipt | DB Record | ~10ms |
| 3. Epoch | DB Records | Merkle Tree | Every 24h |
| 4. Submit | Merkle Root | On-chain Root | ~5s (L2) |
| 5. Claim | Proof | HSK Tokens | ~2s (L2) |

**The bridge enables trustless compute mining:**
- Miners prove work with cryptography
- Settlement batches payments efficiently
- Smart contracts enforce rules trustlessly
- Gas costs amortized across all miners

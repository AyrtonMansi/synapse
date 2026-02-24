# Synapse Miner/Node Operator Readiness Assessment

## ✅ What's Complete

### Node Agent (services/node-agent/)
| Feature | Status | Details |
|---------|--------|---------|
| **WebSocket Connection** | ✅ | Connects to router, auto-reconnects |
| **Node Registration** | ✅ | Registers with wallet + models + pricing |
| **Ed25519 Keypair** | ✅ | Persistent key generation for signing receipts |
| **Proof of Compute** | ✅ | Signs SHA-256 hashes of prompts/outputs |
| **Receipts** | ✅ | Cryptographic proof of work with timestamps |
| **vLLM Integration** | ✅ | GPU inference via vLLM API |
| **Echo Fallback** | ✅ | CPU-only mode for testing |
| **Benchmarking** | ✅ | Measures tok/sec at startup |
| **Heartbeats** | ✅ | Reports load, latency, utilization every 10s |
| **GPU Detection** | ✅ | VRAM monitoring, temperature |

### Router (services/router/)
| Feature | Status | Details |
|---------|--------|---------|
| **Node Registry** | ✅ | Tracks online nodes, health status |
| **Job Routing** | ✅ | Routes to least-loaded node |
| **Load Balancing** | ✅ | Latency-based + health checks |
| **Fallback Logic** | ✅ | Falls back to echo-stub if GPU fails |
| **Receipt Verification** | ✅ | Verifies Ed25519 signatures |

### Gateway API (services/gateway-api/)
| Feature | Status | Details |
|---------|--------|---------|
| **API Key Auth** | ✅ | Bearer token validation |
| **Rate Limiting** | ✅ | 100 req/min per IP |
| **Quota Management** | ✅ | Daily token/cost limits |
| **Usage Logging** | ✅ | Logs all requests with receipts |
| **Billing Integration** | ✅ | Charges users, tracks balances |

## 🔴 What's Missing (Blocking Miner Payments)

### Smart Contracts
**Current Status:** Archived contracts are for freelance DeFi, NOT compute mining

**Missing Contracts:**
1. **NodeRewards.sol** - Distributes HSK to miners based on compute contributed
2. **NodeRegistry.sol** - On-chain node registration + staking
3. **ComputeEscrow.sol** - Holds user deposits, pays miners
4. **EpochManager.sol** - 24-hour epochs for reward calculation
5. **MerkleDistributor.sol** - Gas-efficient reward claims

### Settlement Service
**Current Status:** Skeleton implementation exists but NOT wired to real contracts

**Missing:**
1. Contract ABIs are placeholders
2. No deployed contract addresses
3. Merkle tree calculation is stubbed
4. No actual HSK token integration
5. No slashing mechanism

### Token Economics
**Missing:**
1. HSK token contract deployment
2. Token distribution (airdrop/IDO)
3. Emissions schedule for miners
4. Staking requirements
5. Slashing conditions

## 🟡 Partial Implementation

### Node Agent Can:
- ✅ Connect to network
- ✅ Process inference jobs  
- ✅ Generate signed receipts
- ✅ Report metrics

### Node Agent Cannot:
- ❌ Actually receive HSK payments
- ❌ Stake collateral
- ❌ Be slashed for bad behavior
- ❌ Claim rewards on-chain

## 📊 Current State

```
┌─────────────────────────────────────────────────────────────┐
│                    USER REQUEST FLOW                         │
│                     (All Working ✅)                         │
├─────────────────────────────────────────────────────────────┤
│  User → API Key → Gateway → Router → Node Agent → vLLM      │
│                                      ↓                      │
│                              Receipt Signed ✅              │
│                                      ↓                      │
│                              Gateway Logs ✅                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼  (BLOCKED - No contracts)
┌─────────────────────────────────────────────────────────────┐
│                    MINER PAYMENT FLOW                        │
│                   (NOT IMPLEMENTED ❌)                       │
├─────────────────────────────────────────────────────────────┤
│  Settlement Service → Epoch Calculation → Merkle Root       │
│       ❌ Contract               ❌ No contracts deployed     │
│       ❌ Not wired              ❌ No HSK token              │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 What Miners Can Do Now

1. **Test the Network** ✅
   ```bash
   cd services/node-agent
   MODEL_PROFILE=vllm VLLM_URL=http://localhost:8000 npm run dev
   ```

2. **Generate Receipts** ✅
   - Every job creates a signed receipt
   - Proves work was done
   - Stored in gateway logs

3. **See Their Stats** ✅
   - tok/sec benchmark
   - Jobs completed
   - Utilization %
   - Heartbeats visible in router

## 🎯 What Miners CANNOT Do Yet

1. **Earn Real Money** ❌
   - No HSK token exists
   - No reward distribution
   - No claiming mechanism

2. **Stake Collateral** ❌
   - No bonding requirement
   - No slashing risk
   - No Sybil resistance

## 🚀 Path to Production for Miners

### Phase 1: Token Launch (2-3 weeks)
1. Deploy HSK token contract
2. Deploy NodeRegistry (staking)
3. Deploy NodeRewards (Merkle distributor)
4. Deploy ComputeEscrow

### Phase 2: Settlement Integration (1 week)
1. Wire settlement service to contracts
2. Implement Merkle tree calculation
3. Test reward distribution

### Phase 3: Miner Onboarding (1 week)
1. Staking UI for miners
2. Reward dashboard
3. Claim functionality
4. Documentation

**Total time to paying miners: 4-5 weeks**

## 📝 Current Miner Experience

```bash
# What works:
$ docker run synapse/node-agent \
  -e MODEL_PROFILE=vllm \
  -e VLLM_URL=http://localhost:8000 \
  -e NODE_WALLET=0x123...

> Connected to router
> Registered node: abc123
> Benchmark: 45.2 tok/sec (deepseek-v3)
> Processing job: job_001
> Job completed in 1200ms (signed receipt)
> Heartbeat: 1 job/hour, 15% utilization

# What's missing:
> Earned: 0 HSK (token not launched)
> Balance: 0 (settlement not active)
> Stake: 0 (registration not required)
```

## 💰 Estimated Miner Earnings (When Live)

| GPU | Tok/sec | $/1M tokens | Est. Daily HSK |
|-----|---------|-------------|----------------|
| RTX 4090 | 80 | $0.0015 | ~50 HSK |
| RTX 3090 | 50 | $0.0015 | ~30 HSK |
| A100 80GB | 120 | $0.0015 | ~75 HSK |
| CPU (stub) | 0.5 | $0.0001 | ~0.5 HSK |

*HSK price assumed at $0.10 for estimation*

## Recommendation

**For immediate testing:** Node agent is ready - miners CAN connect and process jobs now.

**For production mining:** Need 4-5 weeks to deploy token contracts and settlement infrastructure.

**Interim solution:** Run as "beta testnet" - miners earn "test credits" convertible to HSK at launch.

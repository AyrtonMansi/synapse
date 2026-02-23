# Synapse Economic Model & Dynamic Architecture

## 🚨 Critical Issue: Token-Pricing Correlation

### The Problem

**Current setup (WRONG):**
- User pays 100 HSK for a job
- If HSK = $0.05 → Job costs $5
- If HSK moons to $0.50 → Same job costs $50
- **Result**: Customers leave when token pumps

**Real-world example:**
- Akash Network had this problem early on
- AKT went from $0.10 to $5.00
- Cloud prices became 50x more expensive
- Had to implement USD-pegged pricing

### The Solution (USD-Pegged, HSK-Settled)

**How it works:**
1. All prices quoted in **stable USD** (customers see $0.0015/1K tokens)
2. Payment settled in **HSK** at real-time exchange rate
3. Chainlink oracle provides HSK/USD price feed
4. Customer pays: `$0.0015 / HSK_price` in HSK tokens

**Example:**
```
Job cost: $0.0015

Scenario A: HSK = $0.05
- Customer pays: 0.0015 / 0.05 = 0.03 HSK

Scenario B: HSK = $0.50  (10x pump)
- Customer pays: 0.0015 / 0.50 = 0.003 HSK
- Same USD cost, just less HSK needed
```

**Benefits:**
- ✅ Customer pricing stable (predictable)
- ✅ Node earnings stable in USD terms
- ✅ HSK price can appreciate without hurting network
- ✅ Founder treasury earns more HSK when price low, less when high (dollar-cost averaging)

---

## 🧠 Dynamic Model Routing (Not Rigid)

### Current Problem

**Rigid approach (WRONG):**
- User specifies: "Use DeepSeek-V2"
- If no DeepSeek nodes available → Job fails
- If DeepSeek nodes overloaded → Long wait

### Dynamic Approach (CORRECT)

**Smart routing based on customer preferences:**

```typescript
// Customer API call - flexible
const response = await synapse.chat.create({
  // Option 1: Specify exact model
  model: "deepseek-v2",  // Must be exact
  
  // Option 2: Specify quality tier (RECOMMENDED)
  quality: "high",  // Routes to best available: GPT-4, Claude, DeepSeek
  maxPrice: 0.002,  // USD per 1K tokens
  
  // Option 3: Specify task type
  task: "code",     // Optimizes for code models
  speed: "fast",    // Prioritizes low latency
});
```

**Routing algorithm:**
1. Filter: Nodes that can handle the request type
2. Score: price × quality × speed × reputation
3. Select: Best match for customer preference
4. Fallback: If preferred model unavailable, offer alternatives

**Example routing:**
```
User wants: "high quality, max $0.005/1K tokens"

Available nodes:
- Node A: GPT-4, $0.004, 200ms latency
- Node B: DeepSeek, $0.001, 500ms latency  
- Node C: Claude, $0.004, 300ms latency

Selected: Node A (best quality within budget)
```

---

## 🛡️ Guardrails (How Similar Projects Do It)

### 1. Akash Network (Cloud Compute)

**Their approach:**
- **Providers** set their own prices (free market)
- **Tenants** browse and select providers
- **Escrow** holds payment until work verified
- **Dispute** resolution via on-chain arbitration

**Guardrails:**
- Minimum provider stake: Prevents Sybil attacks
- Uptime tracking: Bad providers lose reputation
- Provider certificates: Verified identity

**What we copy:**
- Staking requirement (already implemented)
- Reputation scoring (already implemented)
- Escrow system (already implemented)

### 2. Render Network (GPU Rendering)

**Their approach:**
- **Job creators** post jobs with RNDR budget
- **Artists** (nodes) bid on jobs
- **OctaneBench** scores determine node capability
- **Multi-tier** pricing based on speed/quality

**Guardrails:**
- OctaneBench: Standardized performance benchmark
- Escrow: Payment held until verification
- Reputation: Track success rate over time

**What we copy:**
- Benchmark scores for nodes (measure actual inference speed)
- Tiered pricing (already implemented via priority)
- Escrow + reputation (already implemented)

### 3. Filecoin (Storage)

**Their approach:**
- **Storage deals** negotiated off-chain
- **On-chain** settlement and verification
- **Proof of Spacetime** verifies storage
- **Slashing** if provider fails

**Guardrails:**
- Proof systems: Cryptographic verification
- Slashing: Economic penalty for failure
- Deal duration: Time-bound commitments

**What we copy:**
- ZK proofs for inference verification (planned)
- Slashing on failure (already implemented)

### 4. Golem Network (Compute)

**Their approach:**
- **Requestors** define tasks
- **Providers** offer compute
- **Marketplace** matches based on price/reputation
- **Local verification** of results

**Guardrails:**
- Reputation system: Track provider reliability
- Task verification: Ensure correct results
- Local testing: Small jobs to test providers

**What we copy:**
- Reputation-based matching
- Small test jobs for new nodes
- Result verification

---

## 📊 Token-Pricing Architecture

### Price Feed Integration

```solidity
contract JobRegistry {
    // Chainlink HSK/USD price feed
    AggregatorV3Interface public priceFeed;
    
    // Job prices stored in USD (8 decimals, like Chainlink)
    uint256 public basePricePerToken = 150; // $0.00000150 = $0.0015 per 1K
    
    function calculateHSKCost(uint256 usdAmount) public view returns (uint256) {
        (, int256 price, , ,) = priceFeed.latestRoundData();
        // price is HSK/USD with 8 decimals
        // usdAmount is in USD with 8 decimals
        // return HSK with 18 decimals
        return (usdAmount * 10**18) / uint256(price);
    }
    
    function createJob(string memory modelId, uint256 maxUsdPrice) external {
        // Convert USD limit to HSK
        uint256 maxHskPrice = calculateHSKCost(maxUsdPrice);
        
        // Escrow HSK from user
        hskToken.transferFrom(msg.sender, address(this), maxHskPrice);
        
        // Create job...
    }
}
```

### Dynamic Price Adjustment

**Current flaw:** Prices are static in the contract

**Fix:** Oracle-based dynamic pricing

```solidity
// USD prices are FIXED (stable for customers)
// HSK amounts are VARIABLE (based on token price)

// Example prices in contract (USD, 8 decimals):
mapping(string => uint256) public modelUsdPrices;

function setModelPrice(string memory modelId, uint256 usdPrice) external onlyOwner {
    modelUsdPrices[modelId] = usdPrice;  // e.g., 150 = $0.00000150 per token
}

function getJobCost(string memory modelId, uint256 tokenCount) public view returns (uint256 hskAmount) {
    uint256 usdPrice = modelUsdPrices[modelId];
    uint256 totalUsd = (usdPrice * tokenCount) / 10**8;  // Total USD cost
    return calculateHSKCost(totalUsd);  // Convert to HSK
}
```

**Benefits:**
- Customer sees stable USD pricing
- Founder can adjust USD prices to compete
- HSK token can float without affecting UX

---

## 🔄 Network Architecture Fixes

### Current Issues in Code

**Issue 1: Utilization tracking is manual**
```solidity
// Current (BAD): Manual updates
function updateNetworkStats(uint256 _totalCapacity, uint256 _activeJobs) external onlyOwner

// Fix (GOOD): Automatic tracking
function acceptJob(bytes32 jobId) external {
    // ... existing code ...
    currentActiveJobs++;
    _updatePriceMultiplier();  // Auto-adjust
}

function completeJob(bytes32 jobId, ...) external {
    // ... existing code ...
    currentActiveJobs--;
    _updatePriceMultiplier();  // Auto-adjust
}

function _updatePriceMultiplier() internal {
    uint256 utilization = (currentActiveJobs * 10000) / totalNodeCapacity;
    
    if (utilization < 3000) {
        currentPriceMultiplier = 8000;  // 20% discount
    } else if (utilization > 8000) {
        currentPriceMultiplier = 15000; // 50% surge
    } else {
        currentPriceMultiplier = 10000; // Normal
    }
    
    emit PriceMultiplierUpdated(utilization, currentPriceMultiplier);
}
```

**Issue 2: No automatic capacity tracking**
```solidity
// Add to registerNode:
function registerNode(...) external {
    // ... existing code ...
    totalNodeCapacity += maxConcurrentJobs;
}

// Add to unregisterNode:
function unregisterNode() external {
    NodeInfo storage node = nodes[msg.sender];
    totalNodeCapacity -= node.maxConcurrentJobs;
    // ... existing code ...
}
```

**Issue 3: Model selection is rigid**
```solidity
// Add to Job struct:
struct Job {
    // ... existing fields ...
    string[] acceptableModels;  // User accepts any of these
    uint256 minQualityScore;    // Minimum quality tier
    bool flexibleModel;         // If true, router can choose
}

// New function:
function createFlexibleJob(
    string[] memory acceptableModels,
    uint256 maxUsdPrice,
    uint256 minQualityScore
) external {
    // Router can assign to any acceptable model
    // Based on: availability, price, node reputation
}
```

---

## 💰 Token Value Accrual (Correct Model)

### How HSK Captures Value

**Wrong model:**
- More usage → More HSK burned → Price goes up
- Problem: Price volatility hurts customers

**Correct model (Akash/Render style):**
- More usage → More fees to treasury → Treasury buys/burns HSK
- Stable USD pricing for customers
- HSK value = discounted future cashflows from treasury

**Value Accrual Mechanisms:**

1. **Treasury Accumulation**
   ```
   10% platform fee on every job
   ↓
   Goes to treasury (controlled by founder)
   ↓
   Treasury can: Buy back HSK, fund development, provide liquidity
   ```

2. **Deflationary Burn**
   ```
   1% burn on every transfer
   ↓
   Total supply decreases over time
   ↓
   Remaining HSK more valuable
   ```

3. **Staking Lockups**
   ```
   Nodes stake 10K HSK minimum
   ↓
   Circulating supply reduced
   ↓
   Price support
   ```

4. **Demand for HSK**
   ```
   Users need HSK to pay for inference
   ↓
   Natural buy pressure
   ↓
   Price appreciation as network grows
   ```

### Treasury Strategy

**Founder-controlled treasury should:**

**Phase 1 (Launch):**
- Use treasury to fund liquidity pools (HSK/ETH)
- Provide market making
- Fund initial marketing

**Phase 2 (Growth):**
- Buy back HSK from market
- Burn some (deflation)
- Stake some (yield for treasury)

**Phase 3 (Maturity):**
- Distribute treasury yield to stakers
- Fund ecosystem grants
- Decentralize treasury control (DAO)

---

## 🎯 Updated Architecture Recommendations

### Immediate Fixes

1. **Add Price Oracle**
   ```solidity
   // Add to JobRegistry
   AggregatorV3Interface public hskUsdFeed;
   
   function setPriceFeed(address feed) external onlyOwner {
       hskUsdFeed = AggregatorV3Interface(feed);
   }
   ```

2. **Convert to USD Pricing**
   ```solidity
   // Store model prices in USD
   mapping(string => uint256) public modelUsdPricePerToken; // 8 decimals
   
   // Calculate HSK cost dynamically
   function getHskCost(string memory model, uint256 tokens) public view returns (uint256) {
       uint256 usdCost = (modelUsdPricePerToken[model] * tokens) / 1e8;
       (,int256 price,,,) = hskUsdFeed.latestRoundData();
       return (usdCost * 1e18) / uint256(price);
   }
   ```

3. **Add Automatic Price Adjustment**
   - Remove manual `updateNetworkStats`
   - Add automatic tracking in acceptJob/completeJob
   - Emit events for off-chain monitoring

4. **Flexible Model Selection**
   - Allow users to specify requirements, not just model
   - Router matches based on availability/price/quality
   - Fallback options if preferred model unavailable

### Smart Routing Algorithm

```python
# Off-chain router (Python/Node.js)
def route_job(job_request):
    # 1. Filter available nodes
    eligible_nodes = [
        node for node in nodes
        if node.can_run(job_request.model)
        and node.price <= job_request.max_price
        and node.reputation > job_request.min_quality
    ]
    
    # 2. Score each node
    scored_nodes = []
    for node in eligible_nodes:
        score = (
            node.reputation * 0.4 +      # 40% weight on reputation
            (1/node.price) * 0.3 +       # 30% weight on price
            (1/node.latency) * 0.2 +     # 20% weight on speed
            node.uptime * 0.1            # 10% weight on uptime
        )
        scored_nodes.append((node, score))
    
    # 3. Select best
    scored_nodes.sort(key=lambda x: x[1], reverse=True)
    return scored_nodes[0][0]
```

---

## ✅ Summary of Fixes Needed

### Smart Contracts

1. ✅ **80% vesting** (already done)
2. ✅ **Demand-supply matching** (already done)
3. 🔄 **Add price oracle** (NEEDED)
4. 🔄 **USD-pegged pricing** (NEEDED)
5. 🔄 **Automatic utilization tracking** (NEEDED)
6. 🔄 **Flexible model routing** (NEEDED)

### Off-Chain Router

1. 🔄 **Dynamic model selection** (NEEDED)
2. 🔄 **Reputation-based scoring** (NEEDED)
3. 🔄 **Price optimization** (NEEDED)

### Token Economics

1. ✅ **Burn mechanism** (already done)
2. ✅ **Staking rewards** (already done)
3. ✅ **Treasury accumulation** (already done)
4. 🔄 **Buyback strategy** (NEEDED - post launch)

---

## 🚀 Recommended Priority

**Week 1:**
1. Implement price oracle (Chainlink)
2. Convert to USD-pegged pricing
3. Fix automatic utilization tracking

**Week 2:**
1. Build smart router (off-chain)
2. Implement flexible model selection
3. Add benchmark scoring for nodes

**Week 3:**
1. Testnet deployment
2. Economic stress testing
3. Parameter tuning

**This architecture makes Synapse:**
- ✅ Stable for customers (USD pricing)
- ✅ Profitable for nodes (dynamic pricing + standby rewards)
- ✅ Valuable for founder (treasury accumulation)
- ✅ Resilient (automatic supply-demand matching)

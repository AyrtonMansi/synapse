# Synapse Troubleshooting Guide

## Quick Diagnostics

### Check System Status

First, verify if there's a known outage:
- Status Page: https://status.synapse.io
- Twitter: @SynapseStatus
- Discord: #status-updates channel

### Node Health Check

```bash
# Run comprehensive diagnostics
synapse-node doctor

# Check specific components
synapse-node doctor --component=network
synapse-node doctor --component=tee
synapse-node doctor --component=storage
```

---

## Common Issues

### API Errors

#### 401 Unauthorized

**Symptoms:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key"
  }
}
```

**Solutions:**
1. Verify API key is correct: `echo $SYNAPSE_API_KEY`
2. Check key hasn't expired in dashboard
3. Ensure key has required permissions
4. Regenerate key if compromised

#### 429 Rate Limited

**Symptoms:** Requests fail with rate limit errors

**Solutions:**
1. Implement exponential backoff:
```python
import time
from synapse import SynapseClient

client = SynapseClient(api_key="your_key")

for attempt in range(5):
    try:
        result = client.inference(...)
        break
    except RateLimitError:
        wait_time = (2 ** attempt) + random.random()
        time.sleep(wait_time)
```

2. Upgrade to higher tier
3. Use batch requests for multiple tasks
4. Enable request caching

#### 402 Insufficient Funds

**Symptoms:** Task submission fails due to low balance

**Solutions:**
1. Check balance: `GET /account`
2. Deposit SYN tokens
3. Set up auto-deposit
4. Adjust task pricing parameters

### Task Failures

#### Task Timeout

**Symptoms:** Task status shows `failed` with timeout error

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Task too complex | Reduce input size or split into smaller tasks |
| Network congestion | Retry with higher `max_price` for priority |
| Node issues | Will auto-retry on different node |
| Deadline too short | Increase `timeout` parameter |

**Prevention:**
```python
# Set realistic timeout based on task complexity
timeout = estimate_task_duration(input_size, model_complexity) * 1.5

result = client.inference(
    model="meta-llama/Llama-2-70b",
    prompt=long_prompt,
    timeout=timeout  # in seconds
)
```

#### Compute Error

**Symptoms:** Task fails during execution

**Common Causes:**
1. **OOM (Out of Memory)**
   - Reduce batch size
   - Use smaller model
   - Request higher VRAM requirement

2. **Model Not Found**
   - Verify model ID: `GET /models`
   - Check model availability in region
   - Upload custom model if needed

3. **Invalid Input Format**
   - Check API documentation for correct schema
   - Validate JSON before sending
   - Use SDK for type safety

```python
# Input validation example
from pydantic import BaseModel, validator

class InferenceRequest(BaseModel):
    prompt: str
    max_tokens: int
    temperature: float
    
    @validator('temperature')
    def validate_temp(cls, v):
        if not 0 <= v <= 2:
            raise ValueError('Temperature must be between 0 and 2')
        return v
```

### Node Operator Issues

#### TEE Attestation Failures

**Symptoms:** Node registration fails at attestation step

**Intel SGX Troubleshooting:**

```bash
# Check SGX support
lscpu | grep sgx

# Verify SGX is enabled in BIOS
dmesg | grep -i sgx

# Check driver installation
ls /dev/sgx*

# Reinstall SGX drivers if needed
sudo apt update
sudo apt install -y libsgx-enclave-common

# Test attestation
synapse-node test-tee --provider=intel_sgx
```

**AMD SEV Troubleshooting:**

```bash
# Check SEV support
cat /proc/cpuinfo | grep -i sev

# Verify firmware
sudo dmesg | grep -i "AMD Memory Encryption"

# Update firmware if needed
sudo apt install amd-sev-firmware
```

**AWS Nitro Enclaves:**

```bash
# Check Nitro Enclaves capability
aws ec2 describe-instances \
  --instance-ids i-1234567890abcdef0 \
  --query 'Reservations[0].Instances[0].EnclaveOptions'

# Enable if needed
aws ec2 modify-instance-attribute \
  --instance-id i-1234567890abcdef0 \
  --enclave-options Enabled=true
```

#### High Slashing Rate

**Symptoms:** Frequent penalties reducing stake

**Investigation:**
```bash
# View slashing history
synapse-node slashing-history

# Check recent task failures
synapse-node tasks --status=failed --limit=50

# Review logs for errors
synapse-node logs --since=24h | grep -i "fail\|error\|timeout"
```

**Common Causes:**

1. **Network Instability**
   ```bash
   # Monitor network latency
   ping -c 100 api.synapse.io
   
   # Check packet loss
   mtr --report api.synapse.io
   ```

2. **Insufficient Resources**
   ```bash
   # Monitor during task execution
   htop
   nvidia-smi dmon
   iostat -x 1
   ```

3. **Software Issues**
   - Update to latest node version: `synapse-node update`
   - Restart node service: `sudo systemctl restart synapse-node`
   - Clear cache: `synapse-node cache-clear`

#### Low Task Assignment

**Symptoms:** Node online but receiving few tasks

**Diagnostic Steps:**

```bash
# Check node score
synapse-node status --detailed

# View network competition
synapse-node network-stats --region=us-east
```

**Improvement Strategies:**

1. **Lower Pricing**
   ```bash
   synapse-node config set pricing.discount=5%
   ```

2. **Improve Hardware**
   - Upgrade GPU for better benchmark scores
   - Increase RAM for larger tasks
   - Upgrade network connection

3. **Optimize Location**
   - Choose region with high demand
   - Use CDN for faster model downloads

4. **Increase Uptime**
   - Set up monitoring alerts
   - Use UPS for power stability
   - Configure auto-restart

### SDK Issues

#### Python SDK

**Installation Problems:**

```bash
# If pip install fails
pip install --upgrade pip
pip install synapse-sdk --no-cache-dir

# For conda environments
conda install -c synapse synapse-sdk
```

**Connection Issues:**

```python
import synapse
from synapse.exceptions import ConnectionError

# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Try with retry
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def submit_with_retry():
    client = synapse.SynapseClient(api_key="your_key")
    return client.inference(...)
```

#### JavaScript/TypeScript SDK

**Module Resolution:**

```typescript
// If import fails, check tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}

// Alternative import
import SynapseClient = require('@synapse/sdk');
```

**Async/Await Issues:**

```typescript
// Always handle errors
async function runTask() {
  try {
    const client = new SynapseClient({ apiKey: 'your_key' });
    const result = await client.inference({...});
    return result;
  } catch (error) {
    if (error.code === 'RATE_LIMITED') {
      await delay(5000);
      return runTask(); // Retry
    }
    throw error;
  }
}
```

### Wallet & Payment Issues

#### Transaction Stuck Pending

**Symptoms:** Deposit/withdrawal not confirming

**Solutions:**
1. Check gas prices on network
2. Speed up transaction with higher gas
3. Wait for network congestion to clear
4. Contact support with tx hash

#### Wrong Network

**Symptoms:** Transactions fail immediately

**Check:**
```javascript
// Verify connected network
const network = await provider.getNetwork();
console.log(network.chainId); // Should match Synapse L2

// Switch if needed
await window.ethereum.request({
  method: 'wallet_switchEthereumChain',
  params: [{ chainId: '0x...' }], // Synapse L2 chain ID
});
```

---

## Performance Optimization

### For API Users

#### Reduce Latency

```python
# 1. Use WebSocket for real-time updates
# 2. Enable response compression
client = SynapseClient(
    api_key="your_key",
    compression=True
)

# 3. Batch small requests
results = client.batch_inference([
    {"prompt": "Task 1"},
    {"prompt": "Task 2"},
    {"prompt": "Task 3"}
])

# 4. Use regional endpoints
client = SynapseClient(
    api_key="your_key",
    region="us-west"  # Closest to your users
)
```

#### Reduce Costs

```python
# 1. Cache frequent requests
from functools import lru_cache

@lru_cache(maxsize=1000)
def cached_inference(prompt_hash):
    return client.inference(prompt=prompt_hash)

# 2. Use cheaper models when possible
# 3. Set price limits
client.inference(
    prompt="...",
    max_price="5.00"  # SYN tokens
)
```

### For Node Operators

#### Maximize Earnings

```bash
# 1. Monitor profitable models
synapse-node trends --timeframe=7d

# 2. Pre-cache popular models
synapse-node cache-preload --model=meta-llama/Llama-2-70b

# 3. Optimize GPU settings
nvidia-smi -pm 1  # Enable persistent mode
nvidia-smi -pl 300  # Set power limit

# 4. Monitor and adjust pricing
synapse-node config set pricing.auto_adjust=true
```

---

## Getting Help

### Support Channels

1. **Documentation:** https://docs.synapse.io
2. **Discord:** https://discord.gg/synapse
3. **Email:** support@synapse.io
4. **Status:** https://status.synapse.io

### Reporting Bugs

Include in your report:
- API key (last 4 chars only)
- Request ID from error response
- Timestamp (with timezone)
- Code snippet to reproduce
- Expected vs actual behavior

### Feature Requests

Submit via:
- GitHub Discussions
- Discord #feature-requests
- Email: feedback@synapse.io

---

*Last Updated: February 2026*

# Synapse Frequently Asked Questions (FAQ)

## General Questions

### What is Synapse?

Synapse is a decentralized compute marketplace that connects users who need AI inference and computing power with providers who have idle GPU and CPU resources. Built on blockchain technology, it offers secure, verifiable, and cost-effective compute services.

### How does Synapse differ from traditional cloud providers?

| Aspect | Traditional Cloud | Synapse |
|--------|------------------|---------|
| Pricing | Fixed/hourly rates | Market-driven, often 50-70% cheaper |
| Privacy | Vendor-controlled | Cryptographic guarantees (TEE) |
| Censorship | Subject to corporate policies | Decentralized, permissionless |
| Availability | Single provider | Global distributed network |
| Verification | Trust-based | Cryptographic proof of execution |

### What can I use Synapse for?

- **AI Inference:** LLM chatbots, image generation, text-to-speech
- **Model Training:** Fine-tuning, distributed training
- **Data Processing:** Batch processing, analytics
- **Scientific Computing:** Simulations, rendering
- **Custom Workloads:** Any containerized compute task

### Is Synapse production-ready?

Yes. Synapse mainnet launched in Q4 2025 and currently processes over 1 million tasks daily with 99.9% uptime. Major enterprises and AI startups are already using Synapse for production workloads.

---

## Getting Started

### How do I get started as a user?

1. **Create Account:** Sign up at https://synapse.io
2. **Get API Key:** Generate from dashboard
3. **Install SDK:** `pip install synapse-sdk`
4. **Submit Task:** Use code examples in docs

```python
from synapse import SynapseClient

client = SynapseClient(api_key="your_key")
result = client.inference(
    model="meta-llama/Llama-2-70b",
    prompt="Hello, Synapse!"
)
```

### How do I become a node operator?

1. **Hardware:** Meet minimum requirements (GPU/CPU specs)
2. **Stake:** Deposit SYN tokens as collateral
3. **Install:** Run `curl -sSL https://install.synapse.io | bash`
4. **Register:** Follow setup wizard
5. **Earn:** Start receiving tasks and rewards

See [Node Setup Guide](/docs/guides/node-setup.md) for details.

### How much does it cost?

**For Users:**
- LLM inference: ~$0.002 per 1K tokens (70B model)
- Image generation: ~$0.01 per image
- Training: ~$2-5 per GPU hour
- 50-70% cheaper than AWS/GCP

**For Node Operators:**
- No fees to join
- Keep 95% of earnings (5% protocol fee)
- Earn SYN token rewards
- Potential ROI: 15-25% monthly on hardware investment

---

## Technical Questions

### What is TEE and why does it matter?

TEE (Trusted Execution Environment) is hardware-based security that:
- Encrypts data during processing
- Verifies code hasn't been tampered with
- Prevents even the node operator from seeing your data
- Provides cryptographic proof of correct execution

Synapse supports Intel SGX, AMD SEV, and AWS Nitro Enclaves.

### How is my data protected?

```
Your Data → Encrypted Upload → TEE Processing → Encrypted Result → You
                ↑                                        ↓
           TLS 1.3                              Only you can decrypt
```

1. **In Transit:** TLS 1.3 encryption
2. **At Rest:** AES-256 encryption
3. **In Use:** TEE memory encryption
4. **Verification:** zk-proofs for computation integrity

### What models are available?

**Popular Models:**
- Meta: Llama 2 (7B, 13B, 70B), Code Llama
- Mistral: 7B, Mixtral 8x7B
- Stability AI: SDXL, Stable Diffusion
- OpenAI-compatible: GPT-4, GPT-3.5 (via API bridge)
- Custom: Upload your own models

**View all:** `GET https://api.synapse.io/v1/models`

### Can I use my own models?

Yes. Upload custom models via:
- API: `POST /models`
- Dashboard: Upload interface
- IPFS: Pin and reference by hash

Supports formats: PyTorch, TensorFlow, ONNX, Safetensors

### What programming languages are supported?

**Official SDKs:**
- Python
- JavaScript/TypeScript
- Go
- Rust

**Community SDKs:**
- Java, C#, Ruby, PHP

**REST API:** Any language that can make HTTP requests

---

## Node Operation

### What hardware do I need?

**Minimum for GPU Node:**
- GPU: NVIDIA RTX 2080+ (8GB+ VRAM)
- CPU: 8 cores
- RAM: 32 GB
- Storage: 500 GB SSD
- Network: 100 Mbps

**Recommended for High Earnings:**
- GPU: RTX 4090 or A100
- CPU: 16+ cores
- RAM: 64+ GB
- Storage: 2 TB NVMe
- Network: 1 Gbps

### How much can I earn?

**Example Earnings (RTX 4090):**

| Metric | Value |
|--------|-------|
| Daily Tasks | 50-100 |
| Daily Revenue | $30-60 |
| Monthly Revenue | $900-1800 |
| Electricity Cost | ~$150/mo |
| Net Profit | $750-1650/mo |

**Factors affecting earnings:**
- Hardware performance (benchmark score)
- Uptime percentage
- Pricing strategy
- Regional demand
- Model availability

### What are the risks?

**Slashing Risks:**
- Downtime: 0.1% of stake per hour
- Failed tasks: 1-25% depending on severity
- Malicious behavior: 100% of stake

**Mitigation:**
- Start with minimum stake
- Monitor node health
- Maintain reliable infrastructure
- Follow best practices

### How does staking work?

- **Minimum Stake:** 1,000-50,000 SYN (depends on tier)
- **Staking Period:** Minimum 7 days
- **Unstaking:** 7-day cooldown period
- **Rewards:** Distributed every 6 hours
- **APY:** 8-15% base + task earnings

### Can I run multiple nodes?

Yes. Many operators run:
- Multiple GPU nodes per location
- Nodes in different regions
- Both GPU and CPU nodes

Each node requires separate registration and stake.

---

## Token & Economics

### What is the SYN token?

SYN is the native utility token of Synapse:
- **Payments:** Pay for compute services
- **Staking:** Required to operate nodes
- **Governance:** Vote on protocol changes
- **Rewards:** Earned by node operators

### Where can I buy SYN?

SYN is available on:
- Uniswap (DEX)
- Coinbase
- Binance
- Kraken

**Contract Address:** `0x...` (Ethereum L2)

### How are prices determined?

Synapse uses a dynamic market pricing model:

```
Price = Base Rate × Demand Factor × Hardware Premium × Speed Priority
```

- **Base Rate:** Cost of hardware + electricity + profit margin
- **Demand Factor:** Increases during high network load
- **Hardware Premium:** Faster hardware = higher rates
- **Speed Priority:** Pay more for faster execution

### Is there a free tier?

Yes. New users receive:
- $10 in free credits
- 100 API calls/day
- Access to smaller models
- Community support

Upgrade for higher limits.

---

## Security & Privacy

### Is my data private?

Yes. Synapse provides multiple privacy layers:

1. **TEE Encryption:** Data encrypted during processing
2. **Zero-Knowledge Proofs:** Verify computation without revealing data
3. **No Data Retention:** Results deleted after delivery
4. **Decentralized:** No single point of data collection

### Can the node operator see my data?

No. With TEE-enabled execution:
- Data encrypted in memory
- Operator cannot access TEE contents
- Cryptographic attestation proves integrity

Without TEE (optional, cheaper):
- Standard encryption in transit
- Trust-based execution
- Not recommended for sensitive data

### Has Synapse been audited?

Yes. Security audits by:
- Trail of Bits (Smart Contracts)
- OpenZeppelin (Token & Staking)
- CertiK (Node Software)

Reports available at https://synapse.io/security

### What happens if a node is compromised?

**Automatic Protections:**
- Failed attestation = immediate slashing
- Anomalous behavior detection
- Network isolation of suspicious nodes
- Insurance fund for affected users

---

## Troubleshooting

### My task failed. What do I do?

1. Check error message in task details
2. Verify input format is correct
3. Try with smaller input
4. Increase timeout parameter
5. Check status.synapse.io for outages

**Still failing?** Contact support with task ID.

### Why is my node not receiving tasks?

Common reasons:
- Stake too low (increase stake)
- Benchmark score low (upgrade hardware)
- Pricing too high (adjust competitively)
- Region oversupplied (try different region)
- Uptime issues (check connectivity)

Run `synapse-node doctor` for diagnosis.

### How do I update my node?

```bash
# Automatic updates (recommended)
synapse-node config set updates.auto=true

# Manual update
synapse-node update
sudo systemctl restart synapse-node

# Check version
synapse-node --version
```

---

## Governance & Community

### How is Synapse governed?

Synapse uses progressive decentralization:

**Current:**
- Core team manages protocol upgrades
- Community feedback via Discord/Forum
- Token holders vote on parameter changes

**Future (2026+):**
- Full DAO governance
- On-chain proposal system
- Community-driven development

### How can I contribute?

- **Code:** GitHub contributions welcome
- **Documentation:** Improve docs
- **Community:** Help others on Discord
- **Testing:** Join beta programs
- **Content:** Write tutorials, make videos

### Where can I connect with the community?

- **Discord:** https://discord.gg/synapse (50k+ members)
- **Twitter:** @SynapseProtocol
- **Forum:** https://forum.synapse.io
- **GitHub:** https://github.com/synapse-protocol
- **Telegram:** @SynapseAnnouncements

---

## Roadmap & Future

### What's coming next?

**Q1 2026:**
- Multi-chain support (Solana, Cosmos)
- Mobile SDK
- Enhanced TEE support

**Q2 2026:**
- Federated learning
- Model marketplace
- Enterprise features

**2026+:**
- Quantum-resistant cryptography
- Fully decentralized governance
- Global edge network

### How can I stay updated?

- Newsletter: Subscribe on website
- Blog: https://synapse.io/blog
- Twitter: @SynapseProtocol
- GitHub: Watch releases

---

*Can't find your answer? Ask on [Discord](https://discord.gg/synapse) or email support@synapse.io*

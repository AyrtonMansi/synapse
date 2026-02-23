# Synapse Bridge + Model Marketplace

Cross-chain bridge infrastructure (Ethereum ↔ Arbitrum) and Model Marketplace.

## Overview

This package contains:
1. **Cross-Chain Bridge** - LayerZero-powered bridge for HSK tokens between Ethereum and Arbitrum
2. **Model Marketplace** - NFT-based marketplace for AI models with verification and royalties

## Smart Contracts

### Bridge
| Contract | Purpose |
|----------|---------|
| `UnifiedHSK.sol` | ERC20Votes token for governance, mintable/burnable by bridge |
| `SynapseBridge.sol` | LayerZero bridge for Ethereum ↔ Arbitrum transfers |

### Model Marketplace
| Contract | Purpose |
|----------|---------|
| `ModelNFT.sol` | ERC721 with royalties for AI models |
| `ModelVerification.sol` | Quality verification system |
| `ModelRegistry.sol` | Version control and search |

## Quick Start

### Prerequisites
```bash
node --version  # >= 18
npm --version   # >= 8
```

### Installation
```bash
cd synapse-advanced
npm install
```

### Environment
```bash
cp .env.example .env
# Edit .env with your private key and RPC URLs
```

### Compile
```bash
npx hardhat compile
```

### Test
```bash
npx hardhat test
```

### Deploy
```bash
# Local
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# Testnet
npx hardhat run scripts/deploy.js --network sepolia

# Mainnet
npx hardhat run scripts/deploy.js --network mainnet
```

## Bridge Usage

### Bridge Tokens (Ethereum → Arbitrum)
```javascript
const tx = await bridge.bridge(
    42161, // Arbitrum chain ID
    recipientAddress,
    ethers.utils.parseEther("100"),
    "0x",
    { value: nativeFee }
);
```

### Estimate Fees
```javascript
const [nativeFee, tokenFee] = await bridge.estimateBridgeFee(
    42161,
    ethers.utils.parseEther("100")
);
```

## Model Marketplace Usage

### Mint Model NFT
```javascript
const tx = await modelNFT.mintModel(
    "My Model",
    "Description",
    "1.0.0",
    ["nlp", "llm"],
    modelHash,
    configHash,
    fileSize,
    "llm",
    "pytorch",
    price,
    "MIT",
    docsURI,
    [creatorAddress],
    [100],
    500 // 5% royalty
);
```

### Request Verification
```javascript
const tx = await modelVerification.requestVerification(modelId, {
    value: verificationFee
});
```

### Search Models
```javascript
const models = await modelRegistry.searchByTag("nlp");
```

## Architecture

```
Ethereum                    LayerZero                    Arbitrum
   │                            │                              │
   │  1. Lock HSK               │                              │
   │───────────────────────────▶│                              │
   │                            │  2. Relay Message            │
   │                            │─────────────────────────────▶│
   │                            │                              │  3. Mint HSK
   │                            │                              │
```

## Configuration

### Bridge Fees
- Ethereum → Arbitrum: 0.3%
- Arbitrum → Ethereum: 0.2%

### Limits
- Min transfer: 0.001 HSK
- Max transfer: 1,000,000 HSK

## Security

- OpenZeppelin libraries
- Role-based access control
- ReentrancyGuard
- Pausable

## License

MIT

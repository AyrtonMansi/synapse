# Synapse Bridge + Model Marketplace

## Overview

Simplified cross-chain infrastructure with:
1. **Bridge** - Ethereum ↔ Arbitrum HSK token bridge via LayerZero
2. **Model Marketplace** - NFT marketplace for AI models

## Contracts

### Bridge (2 contracts)
| Contract | Lines | Purpose |
|----------|-------|---------|
| UnifiedHSK.sol | 250 | ERC20Votes with bridge mint/burn |
| SynapseBridge.sol | 350 | LayerZero bridge |

### Model Marketplace (3 contracts)
| Contract | Lines | Purpose |
|----------|-------|---------|
| ModelNFT.sol | 500 | Model NFT with royalties |
| ModelVerification.sol | 450 | Verification system |
| ModelRegistry.sol | 200 | Versioning & search |

**Total: ~1,750 lines Solidity**

## Quick Start

```bash
npm install
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.js --network localhost
```

## Features

### Bridge
- Ethereum ↔ Arbitrum transfers
- 0.2-0.3% fees
- LayerZero messaging
- Pausable emergency stop

### Model Marketplace
- Model NFTs
- Creator royalties
- Verification system
- Version control

## Security
- OpenZeppelin libraries
- Role-based access
- ReentrancyGuard

## License
MIT

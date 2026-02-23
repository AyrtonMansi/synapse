# Project Summary

## Scope
Cross-chain bridge (Ethereum ↔ Arbitrum) + Model Marketplace only.

## Files

```
synapse-advanced/
├── bridge/
│   ├── SynapseBridge.sol      # LayerZero bridge
│   └── UnifiedHSK.sol         # Bridge token
├── model-marketplace/
│   ├── ModelNFT.sol           # Model NFT
│   ├── ModelVerification.sol  # Verification
│   └── ModelRegistry.sol      # Registry
├── test/
│   ├── Bridge.test.ts
│   └── ModelMarketplace.test.ts
├── scripts/
│   └── deploy.js
├── docs/
│   ├── ARCHITECTURE.md
│   └── INTEGRATION.md
└── README.md
```

## Deployment

```bash
make compile
make test
make deploy-local
```

## Addresses (Post-Deploy)
TBD - Fill in after deployment

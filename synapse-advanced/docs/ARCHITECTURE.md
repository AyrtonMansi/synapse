# Architecture: Bridge + Model Marketplace

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ETHEREUM MAINNET                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ UnifiedHSK   │  │ ModelNFT     │  │ ModelRegistry│      │
│  │ (ERC20Votes) │  │ (ERC721)     │  │              │      │
│  └──────┬───────┘  └──────────────┘  └──────────────┘      │
│         │                                                    │
│  ┌──────▼───────┐                                           │
│  │SynapseBridge │◀──────────────────────────────────────┐   │
│  │              │                                       │   │
│  └──────┬───────┘                                       │   │
│         │                                               │   │
└─────────│───────────────────────────────────────────────│───┘
          │                                               │
          │          LayerZero Messaging                  │
          │                                               │
┌─────────│───────────────────────────────────────────────│───┐
│         │                                               │   │
│  ┌──────▼───────┐                                       │   │
│  │SynapseBridge │───────────────────────────────────────┘   │
│  │  (Arbitrum) │                                           │
│  └──────┬───────┘                                           │
│         │                                                    │
│  ┌──────▼───────┐                                           │
│  │ UnifiedHSK   │                                           │
│  │ (bridged)    │                                           │
│  └──────────────┘                                           │
│                                                              │
│                    ARBITRUM ONE                              │
└─────────────────────────────────────────────────────────────┘
```

## Bridge Architecture

### Flow: Ethereum → Arbitrum

1. User calls `bridge()` on Ethereum contract
2. Tokens locked in bridge contract
3. LayerZero message sent to Arbitrum
4. Arbitrum contract mints/ releases tokens
5. Recipient receives HSK on Arbitrum

### Flow: Arbitrum → Ethereum

1. User calls `bridge()` on Arbitrum contract
2. Tokens burned/locked on Arbitrum
3. LayerZero message sent to Ethereum
4. Ethereum contract releases tokens
5. Recipient receives HSK on Ethereum

## Model Marketplace Architecture

```
Creator
   │
   ▼
ModelNFT.mint()
   │
   ├── Stores metadata on-chain
   ├── Links to model files (IPFS)
   └── Sets royalty configuration
   │
   ▼
ModelVerification.requestVerification()
   │
   ├── Automated tests run
   ├── Security scan
   └── Quality scoring
   │
   ▼
ModelRegistry.indexModel()
   │
   └── Searchable by tags, type, creator
```

## Data Structures

### BridgeTransaction
```solidity
struct BridgeTransaction {
    bytes32 txHash;
    address sender;
    address recipient;
    uint256 amount;
    uint256 sourceChain;
    uint256 targetChain;
    uint256 timestamp;
    bool completed;
}
```

### ModelMetadata
```solidity
struct ModelMetadata {
    string name;
    string description;
    string version;
    string[] tags;
    bytes32 modelHash;
    uint256 basePrice;
    bool isVerified;
    address creator;
}
```

## Security Model

### Roles
- `DEFAULT_ADMIN_ROLE` - Contract ownership
- `BRIDGE_ADMIN` - Bridge configuration
- `MINTER_ROLE` / `BURNER_ROLE` - Token bridging
- `VERIFIER_ROLE` - Model verification

### Protections
- ReentrancyGuard on all financial operations
- Pausable for emergency stops
- Input validation on all public functions
- Blacklist for compliance

## Upgrade Path

Contracts are designed to be upgradeable via proxy pattern:

1. Deploy proxy
2. Point to implementation
3. Upgrade implementation when needed
4. Migrate state if required

## Integration Points

| External | Purpose |
|----------|---------|
| LayerZero | Cross-chain messaging |
| IPFS | Model file storage |
| The Graph | Data indexing |

## Gas Optimization

- Batch operations where possible
- Calldata optimization for L2
- Storage packing
- View functions for off-chain reads

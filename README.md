# Synapse Network - Complete Platform

A fully decentralized AI compute network. No central servers. No KYC. No admin keys.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Web App    │  │   Node CLI   │  │   SDK (Python/JS)    │  │
│  │  (IPFS)      │  │   (Docker)   │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼────────────────┼────────────────────┼────────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       NETWORK LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  P2P Mesh    │  │   Gossip     │  │   The Graph          │  │
│  │  (libp2p)    │  │   Protocol   │  │   Indexer            │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼────────────────┼────────────────────┼────────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       BLOCKCHAIN LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   HSK Token  │  │  JobRegistry │  │   Treasury DAO       │  │
│  │   (ERC20)    │  │   (Escrow)   │  │   (Governance)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Repositories

- `synapse-contracts/` - Solidity smart contracts
- `synapse-backend/` - P2P mesh coordinator + indexer
- `synapse-frontend/` - React dashboard (IPFS-hosted)
- `synapse-node/` - Docker node software
- `synapse-landing/` - Marketing website

## Key Features

✅ **Wallet-only auth** - No email/password database
✅ **Client-side API keys** - Self-custody
✅ **P2P mesh routing** - No central API gateway
✅ **ZK proof verification** - Trustless compute validation
✅ **Streaming payments** - Per-second HSK payments
✅ **DAO governance** - Community-controlled
✅ **IPFS hosting** - Censorship-resistant frontend

## Quick Start

```bash
# 1. Clone
 git clone https://github.com/synapse-network/synapse.git
cd synapse

# 2. Install dependencies
npm install

# 3. Run local dev
npm run dev

# 4. Deploy contracts
npm run deploy:sepolia

# 5. Start node
npm run node:start
```

## Documentation

- [Whitepaper](./docs/WHITEPAPER.md)
- [API Reference](./docs/API.md)
- [Node Setup](./docs/NODE.md)
- [Architecture](./docs/ARCHITECTURE.md)

## License

MIT - See [LICENSE](./LICENSE)

# Synapse Protocol Frontend

A decentralized AI compute marketplace frontend built with React, TypeScript, and Tailwind CSS.

## Features

- **User Dashboard**: Wallet connection, SIWE authentication, API key management, usage statistics
- **Node Operator Dashboard**: Node registration, staking, earnings tracking, job history
- **Governance UI**: DAO proposals, voting interface, treasury viewing
- **Documentation**: API reference, SDK guides, node setup instructions

## Tech Stack

- React 18 + TypeScript
- Tailwind CSS
- RainbowKit (wallet connection)
- wagmi/viem (blockchain interactions)
- SIWE (Sign-In with Ethereum)
- IPFS hosting ready

## Getting Started

```bash
npm install
npm run dev
```

## Build for IPFS

```bash
npm run ipfs:build
```

## Project Structure

```
synapse-frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/         # Page components
│   ├── hooks/         # Custom React hooks
│   ├── utils/         # Utility functions
│   ├── types/         # TypeScript types
│   └── contexts/      # React contexts
├── public/            # Static assets
└── docs/             # Documentation
```

## Wallet Support

- MetaMask
- Phantom
- WalletConnect
- Coinbase Wallet
- Rainbow Wallet
- Trust Wallet

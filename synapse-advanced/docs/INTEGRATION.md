# Integration Guide: Bridge + Model Marketplace

## Bridge Integration

### JavaScript/TypeScript SDK

```javascript
import { ethers } from 'ethers';
import SynapseBridgeABI from './abis/SynapseBridge.json';
import UnifiedHSKABI from './abis/UnifiedHSK.json';

const BRIDGE_ADDRESS = '0x...';
const HSK_ADDRESS = '0x...';

class BridgeSDK {
    constructor(provider, signer) {
        this.bridge = new ethers.Contract(BRIDGE_ADDRESS, SynapseBridgeABI, signer);
        this.hsk = new ethers.Contract(HSK_ADDRESS, UnifiedHSKABI, signer);
    }

    async bridgeToArbitrum(amount) {
        // Approve tokens
        const approveTx = await this.hsk.approve(BRIDGE_ADDRESS, amount);
        await approveTx.wait();

        // Estimate fees
        const [nativeFee, tokenFee] = await this.bridge.estimateBridgeFee(42161, amount);

        // Execute bridge
        const tx = await this.bridge.bridge(
            42161, // Arbitrum
            await this.bridge.signer.getAddress(),
            amount,
            '0x',
            { value: nativeFee }
        );

        return await tx.wait();
    }

    async bridgeToEthereum(amount) {
        const [nativeFee, tokenFee] = await this.bridge.estimateBridgeFee(1, amount);

        const tx = await this.bridge.bridge(
            1, // Ethereum
            await this.bridge.signer.getAddress(),
            amount,
            '0x',
            { value: nativeFee }
        );

        return await tx.wait();
    }

    async getPendingAmount(address) {
        return await this.bridge.getPendingAmount(address);
    }
}
```

### React Hook

```typescript
import { useState, useCallback } from 'react';
import { useWeb3React } from '@web3-react/core';
import { BridgeSDK } from './bridge-sdk';

export function useBridge() {
    const { library, account } = useWeb3React();
    const [bridging, setBridging] = useState(false);

    const bridge = useCallback(async (amount, targetChain) => {
        if (!library || !account) return;

        setBridging(true);
        try {
            const sdk = new BridgeSDK(library, library.getSigner());
            const tx = targetChain === 42161 
                ? await sdk.bridgeToArbitrum(amount)
                : await sdk.bridgeToEthereum(amount);
            return tx;
        } finally {
            setBridging(false);
        }
    }, [library, account]);

    return { bridge, bridging };
}
```

## Model Marketplace Integration

### JavaScript/TypeScript SDK

```javascript
import ModelNFTABI from './abis/ModelNFT.json';
import ModelVerificationABI from './abis/ModelVerification.json';
import ModelRegistryABI from './abis/ModelRegistry.json';

const MODEL_NFT_ADDRESS = '0x...';
const VERIFICATION_ADDRESS = '0x...';
const REGISTRY_ADDRESS = '0x...';

class ModelSDK {
    constructor(signer) {
        this.modelNFT = new ethers.Contract(MODEL_NFT_ADDRESS, ModelNFTABI, signer);
        this.verification = new ethers.Contract(VERIFICATION_ADDRESS, ModelVerificationABI, signer);
        this.registry = new ethers.Contract(REGISTRY_ADDRESS, ModelRegistryABI, signer);
    }

    async mintModel(metadata) {
        const tx = await this.modelNFT.mintModel(
            metadata.name,
            metadata.description,
            metadata.version,
            metadata.tags,
            metadata.modelHash,
            metadata.configHash,
            metadata.fileSize,
            metadata.modelType,
            metadata.framework,
            metadata.price,
            metadata.license,
            metadata.docsURI,
            [metadata.creator],
            [100],
            metadata.royaltyBasisPoints
        );
        const receipt = await tx.wait();
        
        const event = receipt.events.find(e => e.event === 'ModelMinted');
        return event.args.tokenId;
    }

    async requestVerification(modelId) {
        const fee = await this.verification.verificationFee();
        const tx = await this.verification.requestVerification(modelId, { value: fee });
        return await tx.wait();
    }

    async searchByTag(tag) {
        return await this.registry.searchByTag(tag);
    }

    async rateModel(modelId, rating) {
        const tx = await this.modelNFT.rateModel(modelId, rating);
        return await tx.wait();
    }

    async createBundle(name, description, modelIds, price) {
        const tx = await this.registry.createBundle(name, description, modelIds, price);
        return await tx.wait();
    }
}
```

### Python SDK

```python
from web3 import Web3
import json

class SynapseClient:
    def __init__(self, provider_url, private_key):
        self.w3 = Web3(Web3.HTTPProvider(provider_url))
        self.account = self.w3.eth.account.from_key(private_key)
        
    def load_contract(self, address, abi_path):
        with open(abi_path) as f:
            abi = json.load(f)
        return self.w3.eth.contract(address=address, abi=abi)

    def bridge_tokens(self, bridge_address, hsk_address, amount, target_chain):
        bridge = self.load_contract(bridge_address, 'abis/SynapseBridge.json')
        hsk = self.load_contract(hsk_address, 'abis/UnifiedHSK.json')
        
        # Approve
        approve_tx = hsk.functions.approve(
            bridge_address, 
            amount
        ).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        
        signed_approve = self.w3.eth.account.sign_transaction(approve_tx, self.account.key)
        self.w3.eth.send_raw_transaction(signed_approve.rawTransaction)
        
        # Bridge
        fees = bridge.functions.estimateBridgeFee(target_chain, amount).call()
        
        bridge_tx = bridge.functions.bridge(
            target_chain,
            self.account.address,
            amount,
            b''
        ).build_transaction({
            'from': self.account.address,
            'value': fees[0],
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        
        signed_bridge = self.w3.eth.account.sign_transaction(bridge_tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_bridge.rawTransaction)
        
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)
```

## Event Listening

### Bridge Events

```javascript
const provider = new ethers.providers.WebSocketProvider('wss://...');
const bridge = new ethers.Contract(BRIDGE_ADDRESS, SynapseBridgeABI, provider);

bridge.on('BridgeInitiated', (txHash, sender, recipient, amount, source, target) => {
    console.log('Bridge started:', {
        txHash,
        from: source === 1 ? 'Ethereum' : 'Arbitrum',
        to: target === 1 ? 'Ethereum' : 'Arbitrum',
        amount: ethers.utils.formatEther(amount)
    });
});

bridge.on('BridgeCompleted', (txHash, recipient, amount, source, target) => {
    console.log('Bridge completed:', {
        txHash,
        recipient,
        amount: ethers.utils.formatEther(amount)
    });
});
```

### Model Marketplace Events

```javascript
const modelNFT = new ethers.Contract(MODEL_NFT_ADDRESS, ModelNFTABI, provider);

modelNFT.on('ModelMinted', (tokenId, creator, modelHash, name) => {
    console.log('New model:', { tokenId: tokenId.toString(), creator, name });
});

modelNFT.on('ModelVerified', (tokenId, verifier) => {
    console.log('Model verified:', { tokenId: tokenId.toString(), verifier });
});
```

## Error Handling

```javascript
class SynapseError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

async function handleTransaction(txPromise) {
    try {
        return await txPromise;
    } catch (error) {
        if (error.code === 'INSUFFICIENT_FUNDS') {
            throw new SynapseError('INSUFFICIENT_FUNDS', 'Not enough ETH for gas');
        }
        if (error.message.includes('Amount below minimum')) {
            throw new SynapseError('MIN_AMOUNT', 'Amount below 0.001 HSK');
        }
        if (error.message.includes('Amount exceeds maximum')) {
            throw new SynapseError('MAX_AMOUNT', 'Amount above 1M HSK');
        }
        throw error;
    }
}
```

## Testing

```javascript
// Bridge test
describe('Bridge', () => {
    it('should bridge to Arbitrum', async () => {
        const amount = ethers.utils.parseEther('100');
        await hsk.approve(bridge.address, amount);
        
        const tx = await bridge.bridge(42161, user.address, amount, '0x');
        const receipt = await tx.wait();
        
        expect(receipt.events).to.have.length.greaterThan(0);
    });
});

// Model test
describe('Model Marketplace', () => {
    it('should mint model', async () => {
        const tx = await modelNFT.mintModel(
            'Test Model',
            'Description',
            '1.0',
            ['nlp'],
            modelHash,
            configHash,
            1000,
            'llm',
            'pytorch',
            price,
            'MIT',
            '',
            [creator],
            [100],
            500
        );
        
        const receipt = await tx.wait();
        expect(receipt.status).to.equal(1);
    });
});
```

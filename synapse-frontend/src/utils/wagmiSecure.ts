import { http, createConfig, fallback } from 'wagmi';
import { mainnet, sepolia, arbitrum, base, polygon } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// SECURITY: Load contract addresses from environment or secure config
// These should be set in .env file and validated at build time
const CONTRACT_ADDRESSES: Record<number, { token: string; registry: string; staking: string }> = {
  [mainnet.id]: {
    token: import.meta.env.VITE_MAINNET_TOKEN_ADDRESS || '',
    registry: import.meta.env.VITE_MAINNET_REGISTRY_ADDRESS || '',
    staking: import.meta.env.VITE_MAINNET_STAKING_ADDRESS || '',
  },
  [sepolia.id]: {
    token: import.meta.env.VITE_SEPOLIA_TOKEN_ADDRESS || '',
    registry: import.meta.env.VITE_SEPOLIA_REGISTRY_ADDRESS || '',
    staking: import.meta.env.VITE_SEPOLIA_STAKING_ADDRESS || '',
  },
  [arbitrum.id]: {
    token: import.meta.env.VITE_ARBITRUM_TOKEN_ADDRESS || '',
    registry: import.meta.env.VITE_ARBITRUM_REGISTRY_ADDRESS || '',
    staking: import.meta.env.VITE_ARBITRUM_STAKING_ADDRESS || '',
  },
  [base.id]: {
    token: import.meta.env.VITE_BASE_TOKEN_ADDRESS || '',
    registry: import.meta.env.VITE_BASE_REGISTRY_ADDRESS || '',
    staking: import.meta.env.VITE_BASE_STAKING_ADDRESS || '',
  },
  [polygon.id]: {
    token: import.meta.env.VITE_POLYGON_TOKEN_ADDRESS || '',
    registry: import.meta.env.VITE_POLYGON_REGISTRY_ADDRESS || '',
    staking: import.meta.env.VITE_POLYGON_STAKING_ADDRESS || '',
  },
};

// SECURITY: Validate contract addresses
export function validateContractAddresses(): boolean {
  const currentChainId = Number(import.meta.env.VITE_CHAIN_ID || 1);
  const addresses = CONTRACT_ADDRESSES[currentChainId];
  
  if (!addresses) {
    console.error(`No contract addresses configured for chain ${currentChainId}`);
    return false;
  }
  
  const requiredContracts = ['token', 'registry', 'staking'] as const;
  for (const contract of requiredContracts) {
    const address = addresses[contract];
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      console.error(`Missing or invalid ${contract} contract address for chain ${currentChainId}`);
      return false;
    }
    
    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      console.error(`Invalid ${contract} contract address format: ${address}`);
      return false;
    }
  }
  
  return true;
}

// Multiple RPC endpoints for decentralization
const RPC_ENDPOINTS: Record<number, string[]> = {
  [mainnet.id]: [
    import.meta.env.VITE_MAINNET_RPC || 'https://eth-mainnet.public.blastapi.io',
    'https://rpc.ankr.com/eth',
    'https://ethereum.publicnode.com',
  ],
  [sepolia.id]: [
    import.meta.env.VITE_SEPOLIA_RPC || 'https://rpc.sepolia.org',
    'https://sepolia.gateway.tenderly.co',
  ],
  [arbitrum.id]: [
    import.meta.env.VITE_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
    'https://arbitrum-one.public.blastapi.io',
  ],
  [base.id]: [
    import.meta.env.VITE_BASE_RPC || 'https://mainnet.base.org',
    'https://base.publicnode.com',
  ],
  [polygon.id]: [
    import.meta.env.VITE_POLYGON_RPC || 'https://polygon-rpc.com',
    'https://polygon.publicnode.com',
  ],
};

// Create fallback transport for each chain
function createFallbackTransport(chainId: number) {
  const endpoints = RPC_ENDPOINTS[chainId] || [];
  
  if (endpoints.length === 0) {
    return http();
  }
  
  return fallback(
    endpoints.map(url => http(url)),
    { 
      rank: true, 
      retryCount: 3,
      retryDelay: 1000
    }
  );
}

// SECURITY: Get WalletConnect project ID from environment
const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID || '';

// Connectors - prioritize injected (MetaMask, etc.)
const connectors = [
  injected({
    target: 'metaMask',
    shimDisconnect: true,
  }),
  ...(WC_PROJECT_ID ? [walletConnect({
    projectId: WC_PROJECT_ID,
    metadata: {
      name: 'Synapse Network',
      description: 'Decentralized AI Compute Network',
      url: 'https://synapse.network',
      icons: ['https://synapse.network/icon.png'],
    },
    showQrModal: true,
  })] : []),
  injected(),
];

// SECURITY: Get allowed chains from environment
const ALLOWED_CHAIN_IDS = import.meta.env.VITE_ALLOWED_CHAINS?.split(',').map(Number) || [sepolia.id];
const defaultChains = [mainnet, sepolia, arbitrum, base, polygon].filter(
  chain => ALLOWED_CHAIN_IDS.includes(chain.id)
);

if (defaultChains.length === 0) {
  console.error('No valid chains configured');
}

export const config = createConfig({
  chains: (defaultChains.length > 0 ? defaultChains : [sepolia]) as [typeof sepolia, ...typeof sepolia[]],
  connectors,
  transports: {
    [mainnet.id]: createFallbackTransport(mainnet.id),
    [sepolia.id]: createFallbackTransport(sepolia.id),
    [arbitrum.id]: createFallbackTransport(arbitrum.id),
    [base.id]: createFallbackTransport(base.id),
    [polygon.id]: createFallbackTransport(polygon.id),
  },
});

export const supportedChains = defaultChains;

// IPFS gateway fallbacks with security headers
export const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];

/**
 * Fetch from IPFS with timeout and error handling
 * SECURITY: Timeout to prevent hanging, CSP compliance
 */
export async function fetchFromIPFS(cid: string): Promise<Response> {
  // SECURITY: Validate CID format
  if (!cid || !/^[a-zA-Z0-9]{46,}$/.test(cid)) {
    throw new Error('Invalid IPFS CID format');
  }
  
  const errors: string[] = [];
  
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${gateway}${cid}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/plain, */*',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      }
    } catch (error) {
      errors.push(`${gateway}: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }
  
  throw new Error(`Failed to fetch from IPFS: ${errors.join(', ')}`);
}

/**
 * Get contract addresses for a chain
 * SECURITY: Validates addresses are configured
 */
export function getContractAddresses(chainId: number): {
  token: string;
  registry: string;
  staking: string;
} {
  const addresses = CONTRACT_ADDRESSES[chainId];
  
  if (!addresses || !addresses.token || addresses.token === '0x0000000000000000000000000000000000000000') {
    console.warn(`No valid contract addresses for chain ${chainId}, using defaults`);
    return CONTRACT_ADDRESSES[sepolia.id] || {
      token: '',
      registry: '',
      staking: '',
    };
  }
  
  return addresses;
}

/**
 * SECURITY: Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * SECURITY: Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * SECURITY: Check if connected to correct network
 */
export function isCorrectNetwork(chainId: number, expectedChainId: number): boolean {
  return chainId === expectedChainId;
}

export default config;

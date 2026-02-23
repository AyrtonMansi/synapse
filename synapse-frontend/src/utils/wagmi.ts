import { http, createConfig, fallback } from 'wagmi';
import { mainnet, sepolia, arbitrum, base, polygon } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// Multiple RPC endpoints for decentralization
const RPC_ENDPOINTS: Record<number, string[]> = {
  [mainnet.id]: [
    'https://eth-mainnet.public.blastapi.io',
    'https://rpc.ankr.com/eth',
    'https://ethereum.publicnode.com',
  ],
  [sepolia.id]: [
    'https://rpc.sepolia.org',
    'https://sepolia.gateway.tenderly.co',
  ],
  [arbitrum.id]: [
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum-one.public.blastapi.io',
  ],
  [base.id]: [
    'https://mainnet.base.org',
    'https://base.publicnode.com',
  ],
  [polygon.id]: [
    'https://polygon-rpc.com',
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
    { rank: true, retryCount: 3 }
  );
}

// Connectors - prioritize injected (MetaMask, etc.)
const connectors = [
  injected({
    target: 'metaMask',
    shimDisconnect: true,
  }),
  injected({
    target: 'coinbaseWallet',
  }),
  injected(),
];

export const config = createConfig({
  chains: [mainnet, sepolia, arbitrum, base, polygon],
  connectors,
  transports: {
    [mainnet.id]: createFallbackTransport(mainnet.id),
    [sepolia.id]: createFallbackTransport(sepolia.id),
    [arbitrum.id]: createFallbackTransport(arbitrum.id),
    [base.id]: createFallbackTransport(base.id),
    [polygon.id]: createFallbackTransport(polygon.id),
  },
});

export const supportedChains = [mainnet, sepolia, arbitrum, base, polygon] as const;

// IPFS gateway fallbacks
export const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];

export async function fetchFromIPFS(cid: string): Promise<Response> {
  const errors: string[] = [];
  
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const response = await fetch(`${gateway}${cid}`, {
        signal: AbortSignal.timeout(10000),
      });
      
      if (response.ok) {
        return response;
      }
    } catch (error) {
      errors.push(`${gateway}: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }
  
  throw new Error(`Failed to fetch from IPFS: ${errors.join(', ')}`);
}

export async function getContractAddresses(chainId: number): Promise<{
  token: string;
  registry: string;
  staking: string;
}> {
  const addresses: Record<number, { token: string; registry: string; staking: string }> = {
    [mainnet.id]: {
      token: '0x0000000000000000000000000000000000000000',
      registry: '0x0000000000000000000000000000000000000000',
      staking: '0x0000000000000000000000000000000000000000',
    },
    [sepolia.id]: {
      token: '0x0000000000000000000000000000000000000000',
      registry: '0x0000000000000000000000000000000000000000',
      staking: '0x0000000000000000000000000000000000000000',
    },
  };
  
  return addresses[chainId] || addresses[sepolia.id];
}

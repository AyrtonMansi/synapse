/**
 * Contract Configuration Module
 * Replaces hardcoded addresses with environment-based configuration
 * Validates addresses at build time and runtime
 */

import { Address, isAddress } from 'viem';

// Network IDs
export type SupportedChainId = 1 | 11155111 | 42161 | 421614 | 8453 | 84532 | 137 | 80001;

interface ContractAddresses {
  synapseToken: Address;
  synapseStaking: Address;
  synapseRegistry: Address;
  jobRegistry: Address;
  disputeResolver: Address;
  treasuryDAO: Address;
  priceOracle: Address;
}

// Contract addresses by network
const CONTRACT_ADDRESSES: Record<SupportedChainId, ContractAddresses> = {
  // Mainnet (1) - TODO: Fill after deployment
  1: {
    synapseToken: import.meta.env.VITE_MAINNET_TOKEN_ADDRESS as Address || '0x0',
    synapseStaking: import.meta.env.VITE_MAINNET_STAKING_ADDRESS as Address || '0x0',
    synapseRegistry: import.meta.env.VITE_MAINNET_REGISTRY_ADDRESS as Address || '0x0',
    jobRegistry: import.meta.env.VITE_MAINNET_JOB_REGISTRY_ADDRESS as Address || '0x0',
    disputeResolver: import.meta.env.VITE_MAINNET_DISPUTE_RESOLVER_ADDRESS as Address || '0x0',
    treasuryDAO: import.meta.env.VITE_MAINNET_TREASURY_DAO_ADDRESS as Address || '0x0',
    priceOracle: import.meta.env.VITE_MAINNET_PRICE_ORACLE_ADDRESS as Address || '0x0',
  },
  // Sepolia (11155111)
  11155111: {
    synapseToken: import.meta.env.VITE_SEPOLIA_TOKEN_ADDRESS as Address || '0x0',
    synapseStaking: import.meta.env.VITE_SEPOLIA_STAKING_ADDRESS as Address || '0x0',
    synapseRegistry: import.meta.env.VITE_SEPOLIA_REGISTRY_ADDRESS as Address || '0x0',
    jobRegistry: import.meta.env.VITE_SEPOLIA_JOB_REGISTRY_ADDRESS as Address || '0x0',
    disputeResolver: import.meta.env.VITE_SEPOLIA_DISPUTE_RESOLVER_ADDRESS as Address || '0x0',
    treasuryDAO: import.meta.env.VITE_SEPOLIA_TREASURY_DAO_ADDRESS as Address || '0x0',
    priceOracle: import.meta.env.VITE_SEPOLIA_PRICE_ORACLE_ADDRESS as Address || '0x0',
  },
  // Arbitrum (42161)
  42161: {
    synapseToken: import.meta.env.VITE_ARBITRUM_TOKEN_ADDRESS as Address || '0x0',
    synapseStaking: import.meta.env.VITE_ARBITRUM_STAKING_ADDRESS as Address || '0x0',
    synapseRegistry: import.meta.env.VITE_ARBITRUM_REGISTRY_ADDRESS as Address || '0x0',
    jobRegistry: import.meta.env.VITE_ARBITRUM_JOB_REGISTRY_ADDRESS as Address || '0x0',
    disputeResolver: import.meta.env.VITE_ARBITRUM_DISPUTE_RESOLVER_ADDRESS as Address || '0x0',
    treasuryDAO: import.meta.env.VITE_ARBITRUM_TREASURY_DAO_ADDRESS as Address || '0x0',
    priceOracle: import.meta.env.VITE_ARBITRUM_PRICE_ORACLE_ADDRESS as Address || '0x0',
  },
  // Arbitrum Sepolia (421614)
  421614: {
    synapseToken: import.meta.env.VITE_ARBITRUM_SEPOLIA_TOKEN_ADDRESS as Address || '0x0',
    synapseStaking: import.meta.env.VITE_ARBITRUM_SEPOLIA_STAKING_ADDRESS as Address || '0x0',
    synapseRegistry: import.meta.env.VITE_ARBITRUM_SEPOLIA_REGISTRY_ADDRESS as Address || '0x0',
    jobRegistry: import.meta.env.VITE_ARBITRUM_SEPOLIA_JOB_REGISTRY_ADDRESS as Address || '0x0',
    disputeResolver: import.meta.env.VITE_ARBITRUM_SEPOLIA_DISPUTE_RESOLVER_ADDRESS as Address || '0x0',
    treasuryDAO: import.meta.env.VITE_ARBITRUM_SEPOLIA_TREASURY_DAO_ADDRESS as Address || '0x0',
    priceOracle: import.meta.env.VITE_ARBITRUM_SEPOLIA_PRICE_ORACLE_ADDRESS as Address || '0x0',
  },
  // Base (8453)
  8453: {
    synapseToken: import.meta.env.VITE_BASE_TOKEN_ADDRESS as Address || '0x0',
    synapseStaking: import.meta.env.VITE_BASE_STAKING_ADDRESS as Address || '0x0',
    synapseRegistry: import.meta.env.VITE_BASE_REGISTRY_ADDRESS as Address || '0x0',
    jobRegistry: import.meta.env.VITE_BASE_JOB_REGISTRY_ADDRESS as Address || '0x0',
    disputeResolver: import.meta.env.VITE_BASE_DISPUTE_RESOLVER_ADDRESS as Address || '0x0',
    treasuryDAO: import.meta.env.VITE_BASE_TREASURY_DAO_ADDRESS as Address || '0x0',
    priceOracle: import.meta.env.VITE_BASE_PRICE_ORACLE_ADDRESS as Address || '0x0',
  },
  // Base Sepolia (84532)
  84532: {
    synapseToken: import.meta.env.VITE_BASE_SEPOLIA_TOKEN_ADDRESS as Address || '0x0',
    synapseStaking: import.meta.env.VITE_BASE_SEPOLIA_STAKING_ADDRESS as Address || '0x0',
    synapseRegistry: import.meta.env.VITE_BASE_SEPOLIA_REGISTRY_ADDRESS as Address || '0x0',
    jobRegistry: import.meta.env.VITE_BASE_SEPOLIA_JOB_REGISTRY_ADDRESS as Address || '0x0',
    disputeResolver: import.meta.env.VITE_BASE_SEPOLIA_DISPUTE_RESOLVER_ADDRESS as Address || '0x0',
    treasuryDAO: import.meta.env.VITE_BASE_SEPOLIA_TREASURY_DAO_ADDRESS as Address || '0x0',
    priceOracle: import.meta.env.VITE_BASE_SEPOLIA_PRICE_ORACLE_ADDRESS as Address || '0x0',
  },
  // Polygon (137)
  137: {
    synapseToken: import.meta.env.VITE_POLYGON_TOKEN_ADDRESS as Address || '0x0',
    synapseStaking: import.meta.env.VITE_POLYGON_STAKING_ADDRESS as Address || '0x0',
    synapseRegistry: import.meta.env.VITE_POLYGON_REGISTRY_ADDRESS as Address || '0x0',
    jobRegistry: import.meta.env.VITE_POLYGON_JOB_REGISTRY_ADDRESS as Address || '0x0',
    disputeResolver: import.meta.env.VITE_POLYGON_DISPUTE_RESOLVER_ADDRESS as Address || '0x0',
    treasuryDAO: import.meta.env.VITE_POLYGON_TREASURY_DAO_ADDRESS as Address || '0x0',
    priceOracle: import.meta.env.VITE_POLYGON_PRICE_ORACLE_ADDRESS as Address || '0x0',
  },
  // Mumbai (80001)
  80001: {
    synapseToken: import.meta.env.VITE_MUMBAI_TOKEN_ADDRESS as Address || '0x0',
    synapseStaking: import.meta.env.VITE_MUMBAI_STAKING_ADDRESS as Address || '0x0',
    synapseRegistry: import.meta.env.VITE_MUMBAI_REGISTRY_ADDRESS as Address || '0x0',
    jobRegistry: import.meta.env.VITE_MUMBAI_JOB_REGISTRY_ADDRESS as Address || '0x0',
    disputeResolver: import.meta.env.VITE_MUMBAI_DISPUTE_RESOLVER_ADDRESS as Address || '0x0',
    treasuryDAO: import.meta.env.VITE_MUMBAI_TREASURY_DAO_ADDRESS as Address || '0x0',
    priceOracle: import.meta.env.VITE_MUMBAI_PRICE_ORACLE_ADDRESS as Address || '0x0',
  },
};

/**
 * Validate that all addresses for a chain are valid
 */
export function validateContractAddresses(chainId: SupportedChainId): boolean {
  const addresses = CONTRACT_ADDRESSES[chainId];
  
  if (!addresses) {
    console.error(`No contract addresses configured for chain ${chainId}`);
    return false;
  }
  
  const invalidAddresses: string[] = [];
  
  for (const [name, address] of Object.entries(addresses)) {
    if (!isAddress(address) || address === '0x0' || address === '0x0000000000000000000000000000000000000000') {
      invalidAddresses.push(name);
    }
  }
  
  if (invalidAddresses.length > 0) {
    console.error(`Invalid contract addresses for chain ${chainId}:`, invalidAddresses);
    return false;
  }
  
  return true;
}

/**
 * Get contract addresses for a specific chain
 */
export function getContractAddresses(chainId: number): ContractAddresses {
  const addresses = CONTRACT_ADDRESSES[chainId as SupportedChainId];
  
  if (!addresses) {
    throw new Error(`No contract addresses configured for chain ${chainId}`);
  }
  
  // Double-check in production
  if (import.meta.env.PROD && !validateContractAddresses(chainId as SupportedChainId)) {
    throw new Error(`Contract address validation failed for chain ${chainId}`);
  }
  
  return addresses;
}

/**
 * Check if contracts are deployed on a chain
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in CONTRACT_ADDRESSES && validateContractAddresses(chainId as SupportedChainId);
}

/**
 * Get list of supported chains
 */
export function getSupportedChainIds(): SupportedChainId[] {
  return Object.keys(CONTRACT_ADDRESSES).map(Number) as SupportedChainId[];
}

/**
 * On-chain contract registry lookup (for future use)
 * Allows dynamic address resolution from a central registry contract
 */
export async function resolveContractFromRegistry(
  registryAddress: Address,
  contractName: string,
  publicClient: any
): Promise<Address | null> {
  try {
    // Call registry contract to get address
    const address = await publicClient.readContract({
      address: registryAddress,
      abi: [
        {
          inputs: [{ name: 'name', type: 'string' }],
          name: 'getContractAddress',
          outputs: [{ name: '', type: 'address' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'getContractAddress',
      args: [contractName],
    });
    
    return address as Address;
  } catch (error) {
    console.error(`Failed to resolve ${contractName} from registry:`, error);
    return null;
  }
}

// Export default addresses for current chain
export default CONTRACT_ADDRESSES;

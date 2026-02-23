/**
 * Contract addresses for Synapse Network
 * These are populated after deployment and imported from environment
 */

// Environment-based address configuration
const getContractAddressesInternal = () => {
  // In production, these should be set as environment variables
  // For development, use the hardcoded testnet addresses
  
  const addresses = {
    // Sepolia Testnet
    11155111: {
      token: import.meta.env.VITE_TOKEN_CONTRACT_SEPOLIA || '0x0000000000000000000000000000000000000000',
      registry: import.meta.env.VITE_REGISTRY_CONTRACT_SEPOLIA || '0x0000000000000000000000000000000000000000',
      staking: import.meta.env.VITE_STAKING_CONTRACT_SEPOLIA || '0x0000000000000000000000000000000000000000',
      disputeResolver: import.meta.env.VITE_DISPUTE_CONTRACT_SEPOLIA || '0x0000000000000000000000000000000000000000',
      priceOracle: import.meta.env.VITE_ORACLE_CONTRACT_SEPOLIA || '0x0000000000000000000000000000000000000000',
      treasury: import.meta.env.VITE_TREASURY_CONTRACT_SEPOLIA || '0x0000000000000000000000000000000000000000',
    },
    // HashKey Chain Mainnet
    133: {
      token: import.meta.env.VITE_TOKEN_CONTRACT_HSK || '',
      registry: import.meta.env.VITE_REGISTRY_CONTRACT_HSK || '',
      staking: import.meta.env.VITE_STAKING_CONTRACT_HSK || '',
      disputeResolver: import.meta.env.VITE_DISPUTE_CONTRACT_HSK || '',
      priceOracle: import.meta.env.VITE_ORACLE_CONTRACT_HSK || '',
      treasury: import.meta.env.VITE_TREASURY_CONTRACT_HSK || '',
    },
    // HashKey Chain Testnet
    13381: {
      token: import.meta.env.VITE_TOKEN_CONTRACT_HSK_TESTNET || '',
      registry: import.meta.env.VITE_REGISTRY_CONTRACT_HSK_TESTNET || '',
      staking: import.meta.env.VITE_STAKING_CONTRACT_HSK_TESTNET || '',
      disputeResolver: import.meta.env.VITE_DISPUTE_CONTRACT_HSK_TESTNET || '',
      priceOracle: import.meta.env.VITE_ORACLE_CONTRACT_HSK_TESTNET || '',
      treasury: import.meta.env.VITE_TREASURY_CONTRACT_HSK_TESTNET || '',
    },
  };

  return addresses;
};

// Cache for resolved addresses
let addressCache: Record<number, ContractAddresses> | null = null;

export interface ContractAddresses {
  token: string;
  registry: string;
  staking: string;
  disputeResolver: string;
  priceOracle: string;
  treasury: string;
}

/**
 * Get contract addresses for a specific chain
 * Returns addresses or throws if not configured
 */
export function getContractAddresses(chainId: number): ContractAddresses {
  if (!addressCache) {
    addressCache = getContractAddressesInternal();
  }

  const addresses = addressCache[chainId];
  
  if (!addresses) {
    throw new Error(`No contract addresses configured for chain ID ${chainId}`);
  }

  // Validate addresses are not placeholders
  const placeholderAddresses = [
    '0x0000000000000000000000000000000000000000',
    '',
    undefined,
    null,
  ];

  const invalidContracts = Object.entries(addresses)
    .filter(([_, addr]) => placeholderAddresses.includes(addr))
    .map(([name]) => name);

  if (invalidContracts.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(
      `Contract addresses not properly configured for chain ${chainId}: ${invalidContracts.join(', ')}`
    );
  }

  return addresses;
}

/**
 * Check if contracts are deployed on a chain
 */
export function areContractsDeployed(chainId: number): boolean {
  try {
    const addresses = getContractAddresses(chainId);
    return Object.values(addresses).every(
      addr => addr && addr !== '0x0000000000000000000000000000000000000000'
    );
  } catch {
    return false;
  }
}

/**
 * Get supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return [11155111, 133, 13381]; // Sepolia, HashKey Mainnet, HashKey Testnet
}

/**
 * Validate contract address format
 */
export function isValidContractAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Load addresses from deployment artifacts
 * Call this after contract deployment to update addresses
 */
export async function loadDeploymentAddresses(network: string): Promise<ContractAddresses> {
  try {
    // In production, load from deployment artifacts or API
    const response = await fetch(`/deployments/${network}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load deployment addresses for ${network}`);
    }
    
    const deployment = await response.json();
    
    return {
      token: deployment.SynapseToken?.address || deployment.token,
      registry: deployment.JobRegistry?.address || deployment.registry,
      staking: deployment.SynapseStaking?.address || deployment.staking,
      disputeResolver: deployment.DisputeResolver?.address || deployment.disputeResolver,
      priceOracle: deployment.PriceOracle?.address || deployment.priceOracle,
      treasury: deployment.TreasuryDAO?.address || deployment.treasury,
    };
  } catch (error) {
    console.error('Failed to load deployment addresses:', error);
    throw error;
  }
}

// Re-export ABIs from abis/index.ts
export { SynapseTokenABI, SynapseStakingABI, SynapseRegistryABI } from '../abis/index';

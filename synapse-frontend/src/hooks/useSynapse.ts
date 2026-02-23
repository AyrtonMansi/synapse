/**
 * @fileoverview Synapse Protocol React Hook
 * 
 * Provides reactive access to Synapse smart contracts with automatic
 * data fetching, caching, and optimistic updates.
 * 
 * @module synapse-frontend/hooks/useSynapse
 * @version 1.0.0
 * 
 * @example
 * ```tsx
 * import { useSynapse } from '@/hooks/useSynapse';
 * 
 * function StakingComponent() {
 *   const { 
 *     address, 
 *     isConnected, 
 *     synBalance, 
 *     stake,
 *     isStaking 
 *   } = useSynapse();
 *   
 *   const handleStake = async () => {
 *     try {
 *       await stake('100');
 *       showSuccess('Staked successfully!');
 *     } catch (error) {
 *       showError(error.message);
 *     }
 *   };
 *   
 *   return (
 *     <div>
 *       <p>Balance: {synBalance} SYN</p>
 *       <button onClick={handleStake} disabled={isStaking}>
 *         {isStaking ? 'Staking...' : 'Stake'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useCallback, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits, type Address } from 'viem';
import { SynapseTokenABI, SynapseStakingABI, SynapseRegistryABI } from '../abis';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Contract addresses - loaded from environment */
const CONTRACT_ADDRESSES = {
  SYNAPSE_TOKEN: (import.meta.env.VITE_SYNAPSE_TOKEN_ADDRESS || '0x1234567890123456789012345678901234567890') as Address,
  SYNAPSE_STAKING: (import.meta.env.VITE_SYNAPSE_STAKING_ADDRESS || '0x2345678901234567890123456789012345678901') as Address,
  SYNAPSE_REGISTRY: (import.meta.env.VITE_SYNAPSE_REGISTRY_ADDRESS || '0x3456789012345678901234567890123456789012') as Address,
} as const;

/** Token decimals for formatting */
const TOKEN_DECIMALS = 18;

// ============================================================================
// TYPES
// ============================================================================

/**
 * User data from Synapse contracts
 */
export interface SynapseUser {
  /** Wallet address */
  readonly address: Address;
  /** SYN token balance */
  readonly synBalance: bigint;
  /** Currently staked amount */
  readonly stakedBalance: bigint;
  /** Rewards available to claim */
  readonly pendingRewards: bigint;
  /** Usage credits for compute */
  readonly usageCredits: bigint;
}

/**
 * Node status enumeration
 */
export enum NodeStatus {
  /** Node is offline */
  OFFLINE = 0,
  /** Node is online and available */
  ONLINE = 1,
  /** Node is busy processing jobs */
  BUSY = 2,
  /** Node is under maintenance */
  MAINTENANCE = 3,
  /** Node is suspended */
  SUSPENDED = 4,
}

/**
 * Node information from registry
 */
export interface NodeInfo {
  /** Unique node identifier */
  readonly id: string;
  /** Owner wallet address */
  readonly owner: Address;
  /** GPU model name */
  readonly gpuModel: string;
  /** VRAM in GB */
  readonly vram: number;
  /** Compute power in TFLOPS */
  readonly tflops: number;
  /** Geographic region */
  readonly region: string;
  /** Current status */
  readonly status: NodeStatus;
  /** Amount staked for node */
  readonly stakedAmount: bigint;
  /** Total earnings accrued */
  readonly totalEarnings: bigint;
  /** Jobs completed count */
  readonly jobsCompleted: number;
  /** Price per hour in wei */
  readonly pricePerHour: bigint;
  /** Uptime percentage (0-100) */
  readonly uptime: number;
}

/**
 * Parameters for registering a new node
 */
export interface RegisterNodeParams {
  /** GPU model identifier */
  gpuModel: string;
  /** VRAM capacity in GB */
  vram: number;
  /** Compute power in TFLOPS */
  tflops: number;
  /** Geographic region code */
  region: string;
  /** Price per hour in SYN tokens */
  pricePerHour: string;
  /** Amount to stake for node */
  stakeAmount: string;
  [key: string]: unknown;
}

/**
 * Transaction status tracking
 */
export interface TransactionStatus {
  /** Transaction pending */
  isPending: boolean;
  /** Transaction confirmed */
  isSuccess: boolean;
  /** Transaction failed */
  isError: boolean;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Custom error for Synapse operations
 */
export class SynapseHookError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SynapseHookError';
  }
}

/**
 * Wallet connection errors
 */
const WalletError = {
  NOT_CONNECTED: new SynapseHookError(
    'Wallet not connected. Please connect your wallet first.',
    'WALLET_NOT_CONNECTED'
  ),
  INVALID_AMOUNT: new SynapseHookError(
    'Invalid amount specified',
    'INVALID_AMOUNT'
  ),
  TRANSACTION_FAILED: new SynapseHookError(
    'Transaction failed',
    'TRANSACTION_FAILED'
  ),
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format wei amount to human-readable string
 * @param value - Amount in wei
 * @param decimals - Token decimals
 * @returns Formatted string
 */
function formatTokenAmount(value: bigint | undefined, decimals = TOKEN_DECIMALS): string {
  if (!value || value < 0n) return '0';
  try {
    return formatUnits(value, decimals);
  } catch {
    return '0';
  }
}

/**
 * Parse human-readable amount to wei
 * @param amount - Amount string
 * @param decimals - Token decimals
 * @returns BigInt in wei
 * @throws {SynapseHookError} If amount is invalid
 */
function parseTokenAmount(amount: string, decimals = TOKEN_DECIMALS): bigint {
  if (!amount || amount.trim() === '') {
    throw WalletError.INVALID_AMOUNT;
  }
  try {
    return parseUnits(amount.trim(), decimals);
  } catch (error) {
    throw new SynapseHookError(
      `Invalid amount: ${amount}`,
      'PARSE_ERROR',
      { originalError: error }
    );
  }
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Synapse protocol hook for React applications
 * 
 * Provides reactive access to:
 * - Token balances (SYN)
 * - Staking information
 * - Node registry data
 * - Transaction submission
 * 
 * @returns Hook state and actions
 * 
 * @example
 * ```tsx
 * function App() {
 *   const { isConnected, synBalance, stake } = useSynapse();
 *   
 *   return (
 *     <div>
 *       {isConnected && <p>Balance: {synBalance} SYN</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSynapse() {
  const { address, isConnected } = useAccount();

  // ============================================================================
  // READ CONTRACT DATA
  // ============================================================================

  /** Token balance query */
  const balanceQuery = useReadContract({
    address: CONTRACT_ADDRESSES.SYNAPSE_TOKEN,
    abi: SynapseTokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { 
      enabled: !!address,
      staleTime: 30_000, // 30 seconds
    },
  });

  /** Staked balance query */
  const stakedQuery = useReadContract({
    address: CONTRACT_ADDRESSES.SYNAPSE_STAKING,
    abi: SynapseStakingABI,
    functionName: 'getStakedBalance',
    args: address ? [address] : undefined,
    query: { 
      enabled: !!address,
      staleTime: 30_000,
    },
  });

  /** Pending rewards query */
  const rewardsQuery = useReadContract({
    address: CONTRACT_ADDRESSES.SYNAPSE_STAKING,
    abi: SynapseStakingABI,
    functionName: 'pendingRewards',
    args: address ? [address] : undefined,
    query: { 
      enabled: !!address,
      staleTime: 10_000, // 10 seconds for rewards
    },
  });

  /** User nodes query */
  const nodesQuery = useReadContract({
    address: CONTRACT_ADDRESSES.SYNAPSE_REGISTRY,
    abi: SynapseRegistryABI,
    functionName: 'getNodesByOwner',
    args: address ? [address] : undefined,
    query: { 
      enabled: !!address,
      staleTime: 60_000, // 1 minute
    },
  });

  /** Total nodes count query */
  const totalNodesQuery = useReadContract({
    address: CONTRACT_ADDRESSES.SYNAPSE_REGISTRY,
    abi: SynapseRegistryABI,
    functionName: 'totalNodes',
    query: { staleTime: 300_000 }, // 5 minutes
  });

  // ============================================================================
  // WRITE CONTRACT FUNCTIONS
  // ============================================================================

  const { 
    writeContract: stakeWrite, 
    data: stakeHash,
    error: stakeError,
    isPending: isStakePending,
  } = useWriteContract();

  const { 
    writeContract: unstakeWrite, 
    data: unstakeHash,
    error: unstakeError,
  } = useWriteContract();

  const { 
    writeContract: claimWrite, 
    data: claimHash,
    error: claimError,
  } = useWriteContract();

  const { 
    writeContract: registerNodeWrite, 
    data: registerHash,
    error: registerError,
  } = useWriteContract();

  const { 
    writeContract: updateNodeWrite, 
    data: updateHash,
  } = useWriteContract();

  const { 
    writeContract: withdrawWrite, 
    data: withdrawHash,
  } = useWriteContract();

  // ============================================================================
  // TRANSACTION RECEIPTS
  // ============================================================================

  const stakeReceipt = useWaitForTransactionReceipt({ hash: stakeHash });
  const unstakeReceipt = useWaitForTransactionReceipt({ hash: unstakeHash });
  const claimReceipt = useWaitForTransactionReceipt({ hash: claimHash });
  const registerReceipt = useWaitForTransactionReceipt({ hash: registerHash });

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  const synBalance = formatTokenAmount(balanceQuery.data as bigint);
  const stakedBalance = formatTokenAmount(stakedQuery.data as bigint);
  const pendingRewards = formatTokenAmount(rewardsQuery.data as bigint);
  const userNodes = useMemo(() => {
    const nodes = nodesQuery.data as unknown[] | undefined;
    if (!Array.isArray(nodes)) return undefined;
    
    return nodes.map((node): NodeInfo => {
      const n = node as Record<string, unknown>;
      return {
        id: String(n.id || ''),
        owner: String(n.owner || '') as Address,
        gpuModel: String(n.gpuModel || ''),
        vram: Number(n.vram || 0),
        tflops: Number(n.tflops || 0),
        region: String(n.region || ''),
        status: Number(n.status || 0) as NodeStatus,
        stakedAmount: BigInt(n.stakedAmount as bigint || 0),
        totalEarnings: BigInt(n.totalEarnings as bigint || 0),
        jobsCompleted: Number(n.jobsCompleted || 0),
        pricePerHour: BigInt(n.pricePerHour as bigint || 0),
        uptime: Number(n.uptime || 0),
      };
    });
  }, [nodesQuery.data]);

  const totalNodes = totalNodesQuery.data as bigint | undefined;

  /** Combined loading state */
  const isLoading = 
    balanceQuery.isLoading || 
    stakedQuery.isLoading || 
    rewardsQuery.isLoading ||
    nodesQuery.isLoading;

  /** Combined transaction pending state */
  const isStaking = isStakePending || stakeReceipt.isLoading;
  const isUnstaking = unstakeReceipt.isLoading;
  const isClaiming = claimReceipt.isLoading;
  const isRegistering = registerReceipt.isLoading;

  /** Combined error state */
  const error = stakeError || unstakeError || claimError || registerError;

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Refresh all contract data
   */
  const refresh = useCallback(async () => {
    await Promise.all([
      balanceQuery.refetch(),
      stakedQuery.refetch(),
      rewardsQuery.refetch(),
      nodesQuery.refetch(),
      totalNodesQuery.refetch(),
    ]);
  }, [balanceQuery, stakedQuery, rewardsQuery, nodesQuery, totalNodesQuery]);

  /**
   * Stake SYN tokens
   * @param amount - Amount to stake (human readable)
   * @throws {SynapseHookError} If wallet not connected or invalid amount
   */
  const stake = useCallback(async (amount: string) => {
    if (!isConnected || !address) {
      throw WalletError.NOT_CONNECTED;
    }

    const value = parseTokenAmount(amount);

    // First approve tokens
    await stakeWrite({
      address: CONTRACT_ADDRESSES.SYNAPSE_TOKEN,
      abi: SynapseTokenABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.SYNAPSE_STAKING, value],
    });

    // Then stake
    stakeWrite({
      address: CONTRACT_ADDRESSES.SYNAPSE_STAKING,
      abi: SynapseStakingABI,
      functionName: 'stake',
      args: [value],
    });
  }, [isConnected, address, stakeWrite]);

  /**
   * Unstake SYN tokens
   * @param amount - Amount to unstake (human readable)
   * @throws {SynapseHookError} If wallet not connected
   */
  const unstake = useCallback(async (amount: string) => {
    if (!isConnected) {
      throw WalletError.NOT_CONNECTED;
    }

    const value = parseTokenAmount(amount);

    unstakeWrite({
      address: CONTRACT_ADDRESSES.SYNAPSE_STAKING,
      abi: SynapseStakingABI,
      functionName: 'unstake',
      args: [value],
    });
  }, [isConnected, unstakeWrite]);

  /**
   * Claim pending staking rewards
   * @throws {SynapseHookError} If wallet not connected
   */
  const claim = useCallback(async () => {
    if (!isConnected) {
      throw WalletError.NOT_CONNECTED;
    }

    claimWrite({
      address: CONTRACT_ADDRESSES.SYNAPSE_STAKING,
      abi: SynapseStakingABI,
      functionName: 'claimRewards',
    });
  }, [isConnected, claimWrite]);

  /**
   * Register a new compute node
   * @param params - Node registration parameters
   * @throws {SynapseHookError} If wallet not connected or invalid params
   */
  const registerNewNode = useCallback(async (params: RegisterNodeParams) => {
    if (!isConnected) {
      throw WalletError.NOT_CONNECTED;
    }

    if (!params.gpuModel || params.vram <= 0 || params.tflops <= 0) {
      throw new SynapseHookError(
        'Invalid node parameters',
        'INVALID_PARAMS',
        params
      );
    }

    const priceWei = parseTokenAmount(params.pricePerHour);
    const stakeWei = parseTokenAmount(params.stakeAmount);

    registerNodeWrite({
      address: CONTRACT_ADDRESSES.SYNAPSE_REGISTRY,
      abi: SynapseRegistryABI,
      functionName: 'registerNode',
      args: [
        params.gpuModel,
        BigInt(params.vram),
        BigInt(params.tflops),
        params.region,
        priceWei,
        stakeWei,
      ],
    });
  }, [isConnected, registerNodeWrite]);

  /**
   * Update node status
   * @param nodeId - Node identifier
   * @param status - New status
   * @throws {SynapseHookError} If wallet not connected
   */
  const updateNodeStatus = useCallback(async (nodeId: string, status: NodeStatus) => {
    if (!isConnected) {
      throw WalletError.NOT_CONNECTED;
    }

    updateNodeWrite({
      address: CONTRACT_ADDRESSES.SYNAPSE_REGISTRY,
      abi: SynapseRegistryABI,
      functionName: 'updateNodeStatus',
      args: [nodeId, status],
    });
  }, [isConnected, updateNodeWrite]);

  /**
   * Withdraw node earnings
   * @param nodeId - Node identifier
   * @throws {SynapseHookError} If wallet not connected
   */
  const withdrawNodeEarnings = useCallback(async (nodeId: string) => {
    if (!isConnected) {
      throw WalletError.NOT_CONNECTED;
    }

    withdrawWrite({
      address: CONTRACT_ADDRESSES.SYNAPSE_REGISTRY,
      abi: SynapseRegistryABI,
      functionName: 'withdrawEarnings',
      args: [nodeId],
    });
  }, [isConnected, withdrawWrite]);

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    // Connection state
    address,
    isConnected,
    
    // Balances
    synBalance,
    stakedBalance,
    pendingRewards,
    
    // Nodes
    userNodes,
    totalNodes,
    
    // Actions
    stake,
    unstake,
    claim,
    registerNewNode,
    updateNodeStatus,
    withdrawNodeEarnings,
    refresh,
    
    // Loading states
    isLoading,
    isStaking,
    isUnstaking,
    isClaiming,
    isRegistering,
    
    // Success states
    stakeSuccess: stakeReceipt.isSuccess,
    unstakeSuccess: unstakeReceipt.isSuccess,
    claimSuccess: claimReceipt.isSuccess,
    registerSuccess: registerReceipt.isSuccess,
    
    // Error state
    error,
  };
}

export default useSynapse;

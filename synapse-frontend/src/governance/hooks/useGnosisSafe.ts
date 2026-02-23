import { useCallback, useState } from 'react';
import { useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import type { GnosisSafeInfo, SafeTransaction, Signature } from '../types';

const SAFE_MODULE_ABI = [
  {
    inputs: [{ name: 'safe', type: 'address' }],
    name: 'getSafeInfo',
    outputs: [
      { name: 'safeAddress', type: 'address' },
      { name: 'requiredConfirmations', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'delegateCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'safe', type: 'address' }],
    name: 'getSafeDelegates',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'getTransaction',
    outputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'safe', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'requestedAt', type: 'uint256' },
      { name: 'executedAt', type: 'uint256' },
      { name: 'executed', type: 'bool' },
      { name: 'canceled', type: 'bool' },
      { name: 'requester', type: 'address' },
      { name: 'description', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'getSignatureCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'isExecutable',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'safe', type: 'address' }],
    name: 'getSafeTransactions',
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getRegisteredSafes',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'transactionCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'defaultThreshold',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'safe', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'description', type: 'string' },
    ],
    name: 'requestTransaction',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'signTransaction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'executeTransaction',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'cancelTransaction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'safe', type: 'address' },
      { name: 'threshold', type: 'uint256' },
      { name: 'delegates', type: 'address[]' },
    ],
    name: 'registerSafe',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'safe', type: 'address' },
      { name: 'newThreshold', type: 'uint256' },
    ],
    name: 'updateThreshold',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'safe', type: 'address' },
      { name: 'delegate', type: 'address' },
    ],
    name: 'addDelegate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'safe', type: 'address' },
      { name: 'delegate', type: 'address' },
    ],
    name: 'removeDelegate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const GNOSIS_SAFE_ABI = [
  {
    inputs: [],
    name: 'getThreshold',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getOwners',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'isOwner',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nonce',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function useGnosisSafeModule(moduleAddress?: `0x${string}`) {
  const publicClient = usePublicClient();
  const { writeContract, isPending, error } = useWriteContract();

  // Read registered safes
  const { data: registeredSafes, refetch: refetchSafes } = useReadContract({
    address: moduleAddress,
    abi: SAFE_MODULE_ABI,
    functionName: 'getRegisteredSafes',
    query: { enabled: !!moduleAddress },
  });

  const { data: transactionCount } = useReadContract({
    address: moduleAddress,
    abi: SAFE_MODULE_ABI,
    functionName: 'transactionCount',
    query: { enabled: !!moduleAddress },
  });

  const { data: defaultThreshold } = useReadContract({
    address: moduleAddress,
    abi: SAFE_MODULE_ABI,
    functionName: 'defaultThreshold',
    query: { enabled: !!moduleAddress },
  });

  // Fetch safe info
  const fetchSafeInfo = useCallback(async (safeAddress: string): Promise<GnosisSafeInfo | null> => {
    if (!moduleAddress || !publicClient) return null;

    try {
      const [moduleInfo, owners, threshold, nonce] = await Promise.all([
        publicClient.readContract({
          address: moduleAddress,
          abi: SAFE_MODULE_ABI,
          functionName: 'getSafeInfo',
          args: [safeAddress as `0x${string}`],
        }),
        publicClient.readContract({
          address: safeAddress as `0x${string}`,
          abi: GNOSIS_SAFE_ABI,
          functionName: 'getOwners',
        }),
        publicClient.readContract({
          address: safeAddress as `0x${string}`,
          abi: GNOSIS_SAFE_ABI,
          functionName: 'getThreshold',
        }),
        publicClient.readContract({
          address: safeAddress as `0x${string}`,
          abi: GNOSIS_SAFE_ABI,
          functionName: 'nonce',
        }),
      ]);

      const delegates = await publicClient.readContract({
        address: moduleAddress,
        abi: SAFE_MODULE_ABI,
        functionName: 'getSafeDelegates',
        args: [safeAddress as `0x${string}`],
      });

      return {
        address: safeAddress,
        requiredConfirmations: Number(moduleInfo[1]),
        isActive: moduleInfo[2],
        delegateCount: Number(moduleInfo[3]),
        delegates: (delegates || []) as string[],
        owners: (owners || []) as string[],
        threshold: Number(threshold),
      };
    } catch (err) {
      console.error('Error fetching safe info:', err);
      return null;
    }
  }, [moduleAddress, publicClient]);

  // Fetch transaction
  const fetchTransaction = useCallback(async (txId: string): Promise<SafeTransaction | null> => {
    if (!moduleAddress || !publicClient) return null;

    try {
      const [txData, sigCount, isExec] = await Promise.all([
        publicClient.readContract({
          address: moduleAddress,
          abi: SAFE_MODULE_ABI,
          functionName: 'getTransaction',
          args: [txId as `0x${string}`],
        }),
        publicClient.readContract({
          address: moduleAddress,
          abi: SAFE_MODULE_ABI,
          functionName: 'getSignatureCount',
          args: [txId as `0x${string}`],
        }),
        publicClient.readContract({
          address: moduleAddress,
          abi: SAFE_MODULE_ABI,
          functionName: 'isExecutable',
          args: [txId as `0x${string}`],
        }),
      ]);

      return {
        id: txData[0],
        safe: txData[1],
        to: txData[2],
        value: formatUnits(txData[3], 18),
        data: txData[4],
        operation: Number(txData[5]),
        requestedAt: Number(txData[6]),
        executedAt: Number(txData[7]),
        executed: txData[8],
        canceled: txData[9],
        requester: txData[10],
        description: txData[11],
        signatures: [], // Would need separate call
        signatureCount: Number(sigCount),
        isExecutable: isExec,
      };
    } catch (err) {
      console.error('Error fetching transaction:', err);
      return null;
    }
  }, [moduleAddress, publicClient]);

  // Fetch safe transactions
  const fetchSafeTransactions = useCallback(async (safeAddress: string): Promise<string[]> => {
    if (!moduleAddress || !publicClient) return [];

    try {
      const txIds = await publicClient.readContract({
        address: moduleAddress,
        abi: SAFE_MODULE_ABI,
        functionName: 'getSafeTransactions',
        args: [safeAddress as `0x${string}`],
      });

      return (txIds || []) as string[];
    } catch (err) {
      console.error('Error fetching safe transactions:', err);
      return [];
    }
  }, [moduleAddress, publicClient]);

  // Register safe
  const registerSafe = useCallback(async (
    safeAddress: string,
    threshold: number,
    delegates: string[]
  ) => {
    if (!moduleAddress) throw new Error('Module address not set');

    writeContract({
      address: moduleAddress,
      abi: SAFE_MODULE_ABI,
      functionName: 'registerSafe',
      args: [
        safeAddress as `0x${string}`,
        BigInt(threshold),
        delegates as `0x${string}`[],
      ],
    });
  }, [moduleAddress, writeContract]);

  // Request transaction
  const requestTransaction = useCallback(async (
    safeAddress: string,
    to: string,
    value: string,
    data: string,
    operation: number,
    description: string
  ) => {
    if (!moduleAddress) throw new Error('Module address not set');

    writeContract({
      address: moduleAddress,
      abi: SAFE_MODULE_ABI,
      functionName: 'requestTransaction',
      args: [
        safeAddress as `0x${string}`,
        to as `0x${string}`,
        BigInt(Math.floor(parseFloat(value) * 1e18)),
        data as `0x${string}`,
        operation,
        description,
      ],
    });
  }, [moduleAddress, writeContract]);

  // Sign transaction
  const signTransaction = useCallback(async (txId: string, signature: string) => {
    if (!moduleAddress) throw new Error('Module address not set');

    writeContract({
      address: moduleAddress,
      abi: SAFE_MODULE_ABI,
      functionName: 'signTransaction',
      args: [txId as `0x${string}`, signature as `0x${string}`],
    });
  }, [moduleAddress, writeContract]);

  // Execute transaction
  const executeTransaction = useCallback(async (txId: string) => {
    if (!moduleAddress) throw new Error('Module address not set');

    writeContract({
      address: moduleAddress,
      abi: SAFE_MODULE_ABI,
      functionName: 'executeTransaction',
      args: [txId as `0x${string}`],
    });
  }, [moduleAddress, writeContract]);

  // Cancel transaction
  const cancelTransaction = useCallback(async (txId: string) => {
    if (!moduleAddress) throw new Error('Module address not set');

    writeContract({
      address: moduleAddress,
      abi: SAFE_MODULE_ABI,
      functionName: 'cancelTransaction',
      args: [txId as `0x${string}`],
    });
  }, [moduleAddress, writeContract]);

  // Update threshold
  const updateThreshold = useCallback(async (safeAddress: string, newThreshold: number) => {
    if (!moduleAddress) throw new Error('Module address not set');

    writeContract({
      address: moduleAddress,
      abi: SAFE_MODULE_ABI,
      functionName: 'updateThreshold',
      args: [safeAddress as `0x${string}`, BigInt(newThreshold)],
    });
  }, [moduleAddress, writeContract]);

  // Add delegate
  const addDelegate = useCallback(async (safeAddress: string, delegate: string) => {
    if (!moduleAddress) throw new Error('Module address not set');

    writeContract({
      address: moduleAddress,
      abi: SAFE_MODULE_ABI,
      functionName: 'addDelegate',
      args: [safeAddress as `0x${string}`, delegate as `0x${string}`],
    });
  }, [moduleAddress, writeContract]);

  // Remove delegate
  const removeDelegate = useCallback(async (safeAddress: string, delegate: string) => {
    if (!moduleAddress) throw new Error('Module address not set');

    writeContract({
      address: moduleAddress,
      abi: SAFE_MODULE_ABI,
      functionName: 'removeDelegate',
      args: [safeAddress as `0x${string}`, delegate as `0x${string}`],
    });
  }, [moduleAddress, writeContract]);

  return {
    // Data
    registeredSafes: registeredSafes || [],
    transactionCount: transactionCount ? Number(transactionCount) : 0,
    defaultThreshold: defaultThreshold ? Number(defaultThreshold) : 1,
    
    // Fetch functions
    fetchSafeInfo,
    fetchTransaction,
    fetchSafeTransactions,
    refetchSafes,
    
    // Actions
    registerSafe,
    requestTransaction,
    signTransaction,
    executeTransaction,
    cancelTransaction,
    updateThreshold,
    addDelegate,
    removeDelegate,
    
    // Status
    isPending,
    error,
  };
}
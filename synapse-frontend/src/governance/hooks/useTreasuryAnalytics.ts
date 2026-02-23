import { useCallback, useEffect, useState } from 'react';
import { useReadContract, useWriteContract, usePublicClient, useBalance } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import type { 
  TreasuryAsset, 
  TreasurySnapshot, 
  SpendingProposal, 
  RevenueShare, 
  TokenBurn,
  TreasuryStats 
} from '../types';

const TREASURY_ANALYTICS_ABI = [
  {
    inputs: [],
    name: 'getTreasuryValue',
    outputs: [
      { name: 'totalValueUSD', type: 'uint256' },
      { name: 'ethValueUSD', type: 'uint256' },
      { name: 'tokenValuesUSD', type: 'uint256' },
      { name: 'assetList', type: 'tuple[]', components: [
        { name: 'token', type: 'address' },
        { name: 'symbol', type: 'string' },
        { name: 'balance', type: 'uint256' },
        { name: 'price', type: 'uint256' },
        { name: 'valueUSD', type: 'uint256' },
        { name: 'decimals', type: 'uint8' },
        { name: 'isETH', type: 'bool' },
        { name: 'isActive', type: 'bool' },
      ]},
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSpent',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalBurned',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalRevenue',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'burnRate',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'stakingShare',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'treasuryShare',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'snapshots',
    outputs: [
      { name: 'timestamp', type: 'uint256' },
      { name: 'totalValueUSD', type: 'uint256' },
      { name: 'ethBalance', type: 'uint256' },
      { name: 'tokenCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'snapshotCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'spendingProposals',
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'amountUSD', type: 'uint256' },
      { name: 'description', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'proposedAt', type: 'uint256' },
      { name: 'executedAt', type: 'uint256' },
      { name: 'executed', type: 'bool' },
      { name: 'approved', type: 'bool' },
      { name: 'approvedBy', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'spendingProposalCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'tokenBurns',
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'priceAtBurn', type: 'uint256' },
      { name: 'valueUSD', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'reason', type: 'string' },
      { name: 'txHash', type: 'bytes32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'tokenBurnCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'revenueShares',
    outputs: [
      { name: 'periodStart', type: 'uint256' },
      { name: 'periodEnd', type: 'uint256' },
      { name: 'totalRevenue', type: 'uint256' },
      { name: 'distributedAmount', type: 'uint256' },
      { name: 'burnAmount', type: 'uint256' },
      { name: 'stakingRewards', type: 'uint256' },
      { name: 'treasuryAllocation', type: 'uint256' },
      { name: 'holderCount', type: 'uint256' },
      { name: 'distributed', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'revenue', type: 'uint256' }],
    name: 'calculateRevenueShare',
    outputs: [
      { name: 'burnAmount', type: 'uint256' },
      { name: 'stakingAmount', type: 'uint256' },
      { name: 'treasuryAmount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'category', type: 'string' }],
    name: 'getSpendingByCategory',
    outputs: [{ name: 'totalUSD', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'takeSnapshot',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export function useTreasuryAnalytics(analyticsAddress?: `0x${string}`, treasuryAddress?: `0x${string}`) {
  const publicClient = usePublicClient();
  const { writeContract, isPending, error } = useWriteContract();

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address: treasuryAddress,
    query: { enabled: !!treasuryAddress },
  });

  // Read treasury stats
  const { data: treasuryValue, refetch: refetchTreasuryValue } = useReadContract({
    address: analyticsAddress,
    abi: TREASURY_ANALYTICS_ABI,
    functionName: 'getTreasuryValue',
    query: { enabled: !!analyticsAddress },
  });

  const { data: totalSpent } = useReadContract({
    address: analyticsAddress,
    abi: TREASURY_ANALYTICS_ABI,
    functionName: 'totalSpent',
    query: { enabled: !!analyticsAddress },
  });

  const { data: totalBurned } = useReadContract({
    address: analyticsAddress,
    abi: TREASURY_ANALYTICS_ABI,
    functionName: 'totalBurned',
    query: { enabled: !!analyticsAddress },
  });

  const { data: totalRevenue } = useReadContract({
    address: analyticsAddress,
    abi: TREASURY_ANALYTICS_ABI,
    functionName: 'totalRevenue',
    query: { enabled: !!analyticsAddress },
  });

  const { data: burnRate } = useReadContract({
    address: analyticsAddress,
    abi: TREASURY_ANALYTICS_ABI,
    functionName: 'burnRate',
    query: { enabled: !!analyticsAddress },
  });

  const { data: stakingShare } = useReadContract({
    address: analyticsAddress,
    abi: TREASURY_ANALYTICS_ABI,
    functionName: 'stakingShare',
    query: { enabled: !!analyticsAddress },
  });

  const { data: treasuryShare } = useReadContract({
    address: analyticsAddress,
    abi: TREASURY_ANALYTICS_ABI,
    functionName: 'treasuryShare',
    query: { enabled: !!analyticsAddress },
  });

  const { data: snapshotCount } = useReadContract({
    address: analyticsAddress,
    abi: TREASURY_ANALYTICS_ABI,
    functionName: 'snapshotCount',
    query: { enabled: !!analyticsAddress },
  });

  const { data: spendingProposalCount } = useReadContract({
    address: analyticsAddress,
    abi: TREASURY_ANALYTICS_ABI,
    functionName: 'spendingProposalCount',
    query: { enabled: !!analyticsAddress },
  });

  const { data: tokenBurnCount } = useReadContract({
    address: analyticsAddress,
    abi: TREASURY_ANALYTICS_ABI,
    functionName: 'tokenBurnCount',
    query: { enabled: !!analyticsAddress },
  });

  // Process assets from treasury value
  const assets: TreasuryAsset[] = treasuryValue?.[3]?.map((asset: any) => ({
    token: asset.token,
    symbol: asset.symbol,
    balance: formatUnits(asset.balance, asset.decimals),
    price: formatUnits(asset.price, 18),
    valueUSD: formatUnits(asset.valueUSD, 18),
    decimals: asset.decimals,
    isETH: asset.isETH,
    isActive: asset.isActive,
  })) || [];

  // Calculate percentages
  const totalValue = treasuryValue?.[0] ? Number(formatUnits(treasuryValue[0], 18)) : 0;
  const assetsWithPercentages = assets.map(asset => ({
    ...asset,
    percentage: totalValue > 0 ? (Number(asset.valueUSD) / totalValue) * 100 : 0,
  }));

  // Take snapshot
  const takeSnapshot = useCallback(async () => {
    if (!analyticsAddress) throw new Error('Analytics address not set');
    
    writeContract({
      address: analyticsAddress,
      abi: TREASURY_ANALYTICS_ABI,
      functionName: 'takeSnapshot',
    });
  }, [analyticsAddress, writeContract]);

  // Fetch spending proposal
  const fetchSpendingProposal = useCallback(async (id: number): Promise<SpendingProposal | null> => {
    if (!analyticsAddress || !publicClient) return null;

    try {
      const data = await publicClient.readContract({
        address: analyticsAddress,
        abi: TREASURY_ANALYTICS_ABI,
        functionName: 'spendingProposals',
        args: [BigInt(id)],
      });

      return {
        id: Number(data[0]),
        token: data[1],
        recipient: data[2],
        amount: formatUnits(data[3], 18),
        amountUSD: formatUnits(data[4], 18),
        description: data[5],
        category: data[6],
        proposedAt: Number(data[7]),
        executedAt: Number(data[8]),
        executed: data[9],
        canceled: false,
        approved: data[10],
        approvedBy: data[11].toString(),
      };
    } catch (err) {
      console.error('Error fetching spending proposal:', err);
      return null;
    }
  }, [analyticsAddress, publicClient]);

  // Fetch token burn
  const fetchTokenBurn = useCallback(async (id: number): Promise<TokenBurn | null> => {
    if (!analyticsAddress || !publicClient) return null;

    try {
      const data = await publicClient.readContract({
        address: analyticsAddress,
        abi: TREASURY_ANALYTICS_ABI,
        functionName: 'tokenBurns',
        args: [BigInt(id)],
      });

      return {
        id: Number(data[0]),
        amount: formatUnits(data[1], 18),
        priceAtBurn: formatUnits(data[2], 18),
        valueUSD: formatUnits(data[3], 18),
        timestamp: Number(data[4]),
        reason: data[5],
        txHash: data[6],
      };
    } catch (err) {
      console.error('Error fetching token burn:', err);
      return null;
    }
  }, [analyticsAddress, publicClient]);

  // Calculate revenue share
  const calculateRevenueShare = useCallback(async (revenue: string) => {
    if (!analyticsAddress || !publicClient) return null;

    try {
      const result = await publicClient.readContract({
        address: analyticsAddress,
        abi: TREASURY_ANALYTICS_ABI,
        functionName: 'calculateRevenueShare',
        args: [parseUnits(revenue, 18)],
      });

      return {
        burnAmount: formatUnits(result[0], 18),
        stakingAmount: formatUnits(result[1], 18),
        treasuryAmount: formatUnits(result[2], 18),
      };
    } catch (err) {
      console.error('Error calculating revenue share:', err);
      return null;
    }
  }, [analyticsAddress, publicClient]);

  return {
    // Treasury data
    totalValueUSD: treasuryValue?.[0] ? formatUnits(treasuryValue[0], 18) : '0',
    ethValueUSD: treasuryValue?.[1] ? formatUnits(treasuryValue[1], 18) : '0',
    tokenValuesUSD: treasuryValue?.[2] ? formatUnits(treasuryValue[2], 18) : '0',
    assets: assetsWithPercentages,
    ethBalance: ethBalance?.formatted || '0',
    
    // Stats
    totalSpent: totalSpent ? formatUnits(totalSpent, 18) : '0',
    totalBurned: totalBurned ? formatUnits(totalBurned, 18) : '0',
    totalRevenue: totalRevenue ? formatUnits(totalRevenue, 18) : '0',
    burnRate: burnRate ? Number(burnRate) / 100 : 0, // Convert from basis points
    stakingShare: stakingShare ? Number(stakingShare) / 100 : 0,
    treasuryShare: treasuryShare ? Number(treasuryShare) / 100 : 0,
    snapshotCount: snapshotCount ? Number(snapshotCount) : 0,
    spendingProposalCount: spendingProposalCount ? Number(spendingProposalCount) : 0,
    tokenBurnCount: tokenBurnCount ? Number(tokenBurnCount) : 0,
    
    // Actions
    takeSnapshot,
    fetchSpendingProposal,
    fetchTokenBurn,
    calculateRevenueShare,
    refetchTreasuryValue,
    
    // Status
    isPending,
    error,
  };
}
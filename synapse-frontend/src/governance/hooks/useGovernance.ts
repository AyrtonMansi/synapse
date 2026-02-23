import { useCallback, useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import type { 
  Proposal, 
  VoteReceipt, 
  DelegationInfo, 
  ProposalTemplate,
  CreateProposalParams,
  VoteParams,
  DelegateParams,
  ProposalState 
} from '../types';

const GOVERNOR_ABI = [
  {
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    name: 'state',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'proposalCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    name: 'getProposal',
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'proposer', type: 'address' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'forVotes', type: 'uint256' },
      { name: 'againstVotes', type: 'uint256' },
      { name: 'abstainVotes', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'eta', type: 'uint256' },
      { name: 'executed', type: 'bool' },
      { name: 'canceled', type: 'bool' },
      { name: 'useQuadraticVoting', type: 'bool' },
      { name: 'proposalType', type: 'uint8' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'voter', type: 'address' },
    ],
    name: 'getReceipt',
    outputs: [
      { name: 'hasVoted', type: 'bool' },
      { name: 'support', type: 'uint8' },
      { name: 'votes', type: 'uint256' },
      { name: 'quadraticVotes', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'getVotes',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'delegates',
    outputs: [
      { name: 'delegate', type: 'address' },
      { name: 'delegatedAmount', type: 'uint256' },
      { name: 'delegatedAt', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'proposalTemplates',
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'proposalType', type: 'uint8' },
      { name: 'useQuadraticVoting', type: 'bool' },
      { name: 'votingPeriod', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'templateCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'quorum',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'proposalThreshold',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'votingPeriod',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'quadraticVotingEnabled',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'calldatas', type: 'bytes[]' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'proposalType', type: 'uint8' },
      { name: 'useQuadraticVoting', type: 'bool' },
    ],
    name: 'propose',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'uint8' },
      { name: 'reason', type: 'string' },
    ],
    name: 'castVote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'delegatee', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'delegate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'revokeDelegation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    name: 'queue',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    name: 'execute',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    name: 'cancel',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const PROPOSAL_STATES = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed'] as const;

export function useGovernanceContract(governorAddress?: `0x${string}`) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, isPending, error } = useWriteContract();

  // Read proposal count
  const { data: proposalCount } = useReadContract({
    address: governorAddress,
    abi: GOVERNOR_ABI,
    functionName: 'proposalCount',
    query: { enabled: !!governorAddress },
  });

  // Read governance parameters
  const { data: quorum } = useReadContract({
    address: governorAddress,
    abi: GOVERNOR_ABI,
    functionName: 'quorum',
    query: { enabled: !!governorAddress },
  });

  const { data: proposalThreshold } = useReadContract({
    address: governorAddress,
    abi: GOVERNOR_ABI,
    functionName: 'proposalThreshold',
    query: { enabled: !!governorAddress },
  });

  const { data: votingPeriod } = useReadContract({
    address: governorAddress,
    abi: GOVERNOR_ABI,
    functionName: 'votingPeriod',
    query: { enabled: !!governorAddress },
  });

  const { data: quadraticVotingEnabled } = useReadContract({
    address: governorAddress,
    abi: GOVERNOR_ABI,
    functionName: 'quadraticVotingEnabled',
    query: { enabled: !!governorAddress },
  });

  // Read user voting power
  const { data: votingPower } = useReadContract({
    address: governorAddress,
    abi: GOVERNOR_ABI,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    query: { enabled: !!governorAddress && !!address },
  });

  // Read user delegation info
  const { data: delegationInfo, refetch: refetchDelegation } = useReadContract({
    address: governorAddress,
    abi: GOVERNOR_ABI,
    functionName: 'delegates',
    args: address ? [address] : undefined,
    query: { enabled: !!governorAddress && !!address },
  });

  // Create proposal
  const createProposal = useCallback(async (params: CreateProposalParams) => {
    if (!governorAddress) throw new Error('Governor address not set');
    
    writeContract({
      address: governorAddress,
      abi: GOVERNOR_ABI,
      functionName: 'propose',
      args: [
        params.targets as `0x${string}`[],
        params.values.map(v => parseUnits(v, 18)),
        params.calldatas as `0x${string}`[],
        params.title,
        params.description,
        params.proposalType,
        params.useQuadraticVoting,
      ],
    });
  }, [governorAddress, writeContract]);

  // Cast vote
  const castVote = useCallback(async (params: VoteParams) => {
    if (!governorAddress) throw new Error('Governor address not set');
    
    writeContract({
      address: governorAddress,
      abi: GOVERNOR_ABI,
      functionName: 'castVote',
      args: [BigInt(params.proposalId), params.support, params.reason || ''],
    });
  }, [governorAddress, writeContract]);

  // Delegate votes
  const delegate = useCallback(async (params: DelegateParams) => {
    if (!governorAddress) throw new Error('Governor address not set');
    
    writeContract({
      address: governorAddress,
      abi: GOVERNOR_ABI,
      functionName: 'delegate',
      args: [params.delegatee as `0x${string}`, parseUnits(params.amount, 18)],
    });
  }, [governorAddress, writeContract]);

  // Revoke delegation
  const revokeDelegation = useCallback(async () => {
    if (!governorAddress) throw new Error('Governor address not set');
    
    writeContract({
      address: governorAddress,
      abi: GOVERNOR_ABI,
      functionName: 'revokeDelegation',
    });
  }, [governorAddress, writeContract]);

  // Queue proposal
  const queueProposal = useCallback(async (proposalId: number) => {
    if (!governorAddress) throw new Error('Governor address not set');
    
    writeContract({
      address: governorAddress,
      abi: GOVERNOR_ABI,
      functionName: 'queue',
      args: [BigInt(proposalId)],
    });
  }, [governorAddress, writeContract]);

  // Execute proposal
  const executeProposal = useCallback(async (proposalId: number) => {
    if (!governorAddress) throw new Error('Governor address not set');
    
    writeContract({
      address: governorAddress,
      abi: GOVERNOR_ABI,
      functionName: 'execute',
      args: [BigInt(proposalId)],
      value: 0n,
    });
  }, [governorAddress, writeContract]);

  // Cancel proposal
  const cancelProposal = useCallback(async (proposalId: number) => {
    if (!governorAddress) throw new Error('Governor address not set');
    
    writeContract({
      address: governorAddress,
      abi: GOVERNOR_ABI,
      functionName: 'cancel',
      args: [BigInt(proposalId)],
    });
  }, [governorAddress, writeContract]);

  // Fetch single proposal
  const fetchProposal = useCallback(async (proposalId: number): Promise<Proposal | null> => {
    if (!governorAddress || !publicClient) return null;

    try {
      const [proposalData, state] = await Promise.all([
        publicClient.readContract({
          address: governorAddress,
          abi: GOVERNOR_ABI,
          functionName: 'getProposal',
          args: [BigInt(proposalId)],
        }),
        publicClient.readContract({
          address: governorAddress,
          abi: GOVERNOR_ABI,
          functionName: 'state',
          args: [BigInt(proposalId)],
        }),
      ]);

      return {
        id: Number(proposalData[0]),
        proposer: proposalData[1],
        title: proposalData[2],
        description: proposalData[3],
        targets: [],
        values: [],
        calldatas: [],
        forVotes: formatUnits(proposalData[4], 18),
        againstVotes: formatUnits(proposalData[5], 18),
        abstainVotes: formatUnits(proposalData[6], 18),
        startTime: Number(proposalData[7]),
        endTime: Number(proposalData[8]),
        eta: Number(proposalData[9]),
        executed: proposalData[10],
        queued: Number(proposalData[9]) > 0 && !proposalData[10] && !proposalData[11],
        canceled: proposalData[11],
        useQuadraticVoting: proposalData[12],
        proposalType: proposalData[13],
        state: PROPOSAL_STATES[state] as ProposalState,
      };
    } catch (err) {
      console.error('Error fetching proposal:', err);
      return null;
    }
  }, [governorAddress, publicClient]);

  // Fetch vote receipt
  const fetchReceipt = useCallback(async (proposalId: number, voter: string): Promise<VoteReceipt | null> => {
    if (!governorAddress || !publicClient) return null;

    try {
      const receipt = await publicClient.readContract({
        address: governorAddress,
        abi: GOVERNOR_ABI,
        functionName: 'getReceipt',
        args: [BigInt(proposalId), voter as `0x${string}`],
      });

      return {
        hasVoted: receipt[0],
        support: receipt[1],
        votes: formatUnits(receipt[2], 18),
        quadraticVotes: formatUnits(receipt[3], 18),
      };
    } catch (err) {
      return null;
    }
  }, [governorAddress, publicClient]);

  return {
    // Data
    proposalCount: proposalCount ? Number(proposalCount) : 0,
    quorum: quorum ? formatUnits(quorum, 18) : '0',
    proposalThreshold: proposalThreshold ? formatUnits(proposalThreshold, 18) : '0',
    votingPeriod: votingPeriod ? Number(votingPeriod) : 0,
    quadraticVotingEnabled: quadraticVotingEnabled ?? false,
    votingPower: votingPower ? formatUnits(votingPower, 18) : '0',
    delegationInfo: delegationInfo ? {
      delegator: address || '',
      delegate: delegationInfo[0],
      delegatedAmount: formatUnits(delegationInfo[1], 18),
      delegatedAt: Number(delegationInfo[2]),
      isActive: delegationInfo[3],
    } : null,
    
    // Actions
    createProposal,
    castVote,
    delegate,
    revokeDelegation,
    queueProposal,
    executeProposal,
    cancelProposal,
    fetchProposal,
    fetchReceipt,
    refetchDelegation,
    
    // Status
    isPending,
    error,
  };
}
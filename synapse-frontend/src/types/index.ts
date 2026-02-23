// Wallet Types
export type WalletType = 'metamask' | 'phantom' | 'walletconnect' | 'coinbase';

export interface User {
  address: string;
  ensName?: string;
  avatar?: string;
  apiKeys: ApiKey[];
  usageStats: UsageStats;
  tokenBalance: TokenBalance;
  createdAt: number;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  permissions: string[];
  createdAt: number;
  lastUsed?: number;
  expiresAt?: number;
  isActive: boolean;
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  computeTime: number; // in seconds
  costEstimate: string; // in SYN tokens
  requestsByDay: { date: string; count: number }[];
  tokensByModel: { model: string; tokens: number }[];
}

export interface BillingHistory {
  id: string;
  date: number;
  amount: string;
  status: 'paid' | 'pending' | 'failed';
  description: string;
}

export interface TokenBalance {
  syn: string;
  staked: string;
  rewards: string;
  usdValue: string;
}

export interface StakingStats {
  totalStaked: string;
  totalRewards: string;
  apr: string;
  stakers: number;
}

// Node Types
export interface NodeOperator {
  address: string;
  nodes: ComputeNode[];
  totalEarnings: string;
  pendingRewards: string;
  stakedAmount: string;
  reputation: number;
}

export interface ComputeNode {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'maintenance' | 'syncing';
  gpuModel: string;
  vram: number; // in GB
  tflops: number;
  region: string;
  uptime: number; // percentage
  jobsCompleted: number;
  earnings: string;
  stakedAmount: string;
  registeredAt: number;
  lastSeen: number;
  capabilities: string[];
  pricePerHour: string;
}

export interface JobHistory {
  id: string;
  nodeId: string;
  status: 'completed' | 'failed' | 'running' | 'queued';
  model: string;
  promptTokens: number;
  completionTokens: number;
  duration: number;
  earnings: string;
  createdAt: number;
  completedAt?: number;
  clientAddress: string;
}

// Governance Types
export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  status: 'active' | 'passed' | 'rejected' | 'queued' | 'executed';
  votesFor: string;
  votesAgainst: string;
  votesAbstain: string;
  quorum: string;
  startTime: number;
  endTime: number;
  executedAt?: number;
  eta?: number;
  actions: ProposalAction[];
  myVote?: Vote;
}

export interface ProposalAction {
  target: string;
  value: string;
  signature: string;
  calldata: string;
}

export interface Vote {
  proposalId: string;
  support: 'for' | 'against' | 'abstain';
  weight: string;
  reason: string;
}

export interface Treasury {
  totalValue: string;
  tokens: TreasuryToken[];
  nfts: TreasuryNFT[];
  transactions: TreasuryTransaction[];
}

export interface TreasuryToken {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  priceUsd: string;
  valueUsd: string;
  logoUrl?: string;
}

export interface TreasuryNFT {
  address: string;
  tokenId: string;
  name: string;
  imageUrl: string;
  collection: string;
  estimatedValue?: string;
}

export interface TreasuryTransaction {
  id: string;
  type: 'in' | 'out';
  token: string;
  amount: string;
  from: string;
  to: string;
  timestamp: number;
  txHash: string;
  description?: string;
}

// Auth Types
export interface SIWEMessage {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}

// Notification Types
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    href: string;
  };
}

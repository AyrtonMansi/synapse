export interface Proposal {
  id: number;
  proposer: string;
  title: string;
  description: string;
  targets: string[];
  values: string[];
  calldatas: string[];
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  quadraticForVotes?: string;
  quadraticAgainstVotes?: string;
  startTime: number;
  endTime: number;
  eta?: number;
  executed: boolean;
  queued: boolean;
  canceled: boolean;
  useQuadraticVoting: boolean;
  proposalType: ProposalType;
  state: ProposalState;
}

export enum ProposalState {
  Pending = 'Pending',
  Active = 'Active',
  Canceled = 'Canceled',
  Defeated = 'Defeated',
  Succeeded = 'Succeeded',
  Queued = 'Queued',
  Expired = 'Expired',
  Executed = 'Executed',
}

export enum ProposalType {
  General = 0,
  Treasury = 1,
  Parameter = 2,
  Upgrade = 3,
}

export interface VoteReceipt {
  hasVoted: boolean;
  support: number;
  votes: string;
  quadraticVotes?: string;
}

export interface DelegationInfo {
  delegator: string;
  delegate: string;
  delegatedAmount: string;
  delegatedAt: number;
  isActive: boolean;
}

export interface ProposalTemplate {
  id: number;
  name: string;
  description: string;
  proposalType: ProposalType;
  defaultTargets: string[];
  defaultCalldatas: string[];
  useQuadraticVoting: boolean;
  votingPeriod: number;
}

export interface TreasuryAsset {
  token: string;
  symbol: string;
  balance: string;
  price: string;
  valueUSD: string;
  decimals: number;
  isETH: boolean;
  isActive: boolean;
  percentage?: number;
}

export interface TreasurySnapshot {
  id: number;
  timestamp: number;
  totalValueUSD: string;
  ethBalance: string;
  tokenCount: number;
  assets: TreasuryAsset[];
}

export interface SpendingProposal {
  id: number;
  token: string;
  recipient: string;
  amount: string;
  amountUSD: string;
  description: string;
  category: string;
  proposedAt: number;
  executedAt: number;
  executed: boolean;
  canceled: boolean;
  approved: boolean;
  approvedBy: string;
}

export interface RevenueShare {
  id: number;
  periodStart: number;
  periodEnd: number;
  totalRevenue: string;
  distributedAmount: string;
  burnAmount: string;
  stakingRewards: string;
  treasuryAllocation: string;
  holderCount: number;
  distributed: boolean;
}

export interface TokenBurn {
  id: number;
  amount: string;
  priceAtBurn: string;
  valueUSD: string;
  timestamp: number;
  reason: string;
  txHash: string;
}

export interface GnosisSafeInfo {
  address: string;
  requiredConfirmations: number;
  isActive: boolean;
  delegateCount: number;
  delegates: string[];
  owners?: string[];
  threshold?: number;
  balance?: string;
}

export interface SafeTransaction {
  id: string;
  safe: string;
  to: string;
  value: string;
  data: string;
  operation: number;
  requestedAt: number;
  executedAt: number;
  executed: boolean;
  canceled: boolean;
  requester: string;
  description: string;
  signatures: Signature[];
  signatureCount: number;
  isExecutable: boolean;
}

export interface Signature {
  signer: string;
  signature: string;
  signedAt: number;
}

export interface TimelockOperation {
  id: string;
  target: string;
  value: string;
  data: string;
  eta: number;
  executed: boolean;
  canceled: boolean;
  createdAt: number;
  delay: number;
  proposer: string;
  description: string;
  state: TimelockState;
  timeUntilExecution: number;
  progressPercent: number;
}

export enum TimelockState {
  Pending = 'Pending',
  Ready = 'Ready',
  Executed = 'Executed',
  Canceled = 'Canceled',
  Expired = 'Expired',
}

export interface CreateProposalParams {
  targets: string[];
  values: string[];
  calldatas: string[];
  title: string;
  description: string;
  proposalType: ProposalType;
  useQuadraticVoting: boolean;
}

export interface VoteParams {
  proposalId: number;
  support: number; // 0 = against, 1 = for, 2 = abstain
  reason?: string;
}

export interface DelegateParams {
  delegatee: string;
  amount: string;
}

export interface GovernanceStats {
  totalProposals: number;
  activeProposals: number;
  totalVotesCast: string;
  quorum: string;
  proposalThreshold: string;
  votingPeriod: number;
  timelockDelay: number;
  quadraticVotingEnabled: boolean;
}

export interface TreasuryStats {
  totalValueUSD: string;
  ethValueUSD: string;
  tokenValuesUSD: string;
  totalSpent: string;
  totalBurned: string;
  totalRevenue: string;
  assetCount: number;
  burnRate: number;
  stakingShare: number;
  treasuryShare: number;
}
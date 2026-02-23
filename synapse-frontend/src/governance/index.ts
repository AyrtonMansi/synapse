// Governance Module for Synapse DAO
// This module provides comprehensive DAO governance features

// Types
export * from './types';

// Hooks
export * from './hooks';

// Components
export * from './components';

// Constants
export const GOVERNANCE_CONTRACTS = {
  // These addresses should be updated after deployment
  governor: import.meta.env.VITE_GOVERNOR_ADDRESS as `0x${string}` | undefined,
  treasury: import.meta.env.VITE_TREASURY_ADDRESS as `0x${string}` | undefined,
  analytics: import.meta.env.VITE_ANALYTICS_ADDRESS as `0x${string}` | undefined,
  timelock: import.meta.env.VITE_TIMELOCK_ADDRESS as `0x${string}` | undefined,
  safeModule: import.meta.env.VITE_SAFE_MODULE_ADDRESS as `0x${string}` | undefined,
};

// Proposal type labels
export const PROPOSAL_TYPE_LABELS: Record<number, string> = {
  0: 'General',
  1: 'Treasury',
  2: 'Parameter',
  3: 'Upgrade',
};

// Proposal state labels
export const PROPOSAL_STATE_LABELS: Record<string, string> = {
  Pending: 'Pending',
  Active: 'Active',
  Canceled: 'Canceled',
  Defeated: 'Defeated',
  Succeeded: 'Succeeded',
  Queued: 'Queued',
  Expired: 'Expired',
  Executed: 'Executed',
};

// Voting period in seconds (3 days)
export const DEFAULT_VOTING_PERIOD = 3 * 24 * 60 * 60;

// Timelock delay in seconds (2 days)
export const DEFAULT_TIMELOCK_DELAY = 2 * 24 * 60 * 60;

// Minimum quorum (1000 tokens)
export const MIN_QUORUM = '1000';

// Proposal threshold (100 tokens)
export const PROPOSAL_THRESHOLD = '100';
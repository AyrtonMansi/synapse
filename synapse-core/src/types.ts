import { z } from 'zod';

/**
 * Core type definitions for Synapse Network
 * 
 * AUDIT: All external inputs must pass through these schemas before processing.
 * This prevents runtime type errors and malicious input injection.
 */

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * HSK Token amount validation
 * - Must be positive
 * - Max 18 decimal places (ERC-20 standard)
 * - String representation to avoid floating point errors
 */
export const TokenAmountSchema = z.string().regex(
  /^\d+(\.\d{1,18})?$/,
  'Invalid token amount format'
).refine(
  (val) => parseFloat(val) >= 0,
  'Token amount must be non-negative'
);

/**
 * Ethereum address validation
 * - Must be 0x prefix + 40 hex characters
 * - Case-insensitive (will normalize to checksum)
 */
export const AddressSchema = z.string().regex(
  /^0x[a-fA-F0-9]{40}$/,
  'Invalid Ethereum address format'
).transform((addr) => addr.toLowerCase());

/**
 * Node ID validation
 * - UUID v4 format for global uniqueness
 * - Prevents collision attacks
 */
export const NodeIdSchema = z.string().uuid('Invalid node ID format');

/**
 * Model identifier validation
 * - Alphanumeric + hyphens/underscores
 * - Max 64 chars to prevent DB bloat
 */
export const ModelIdSchema = z.string()
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid model ID format')
  .min(1)
  .max(64);

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Node capabilities and status
 * 
 * AUDIT: Node registration must verify GPU specs to prevent fake capacity claims.
 * ZK proofs should verify actual compute power, not just self-reported specs.
 */
export interface NodeInfo {
  readonly id: string;
  readonly address: string;  // Wallet address for payments
  readonly endpoint: string;  // IP:port for mesh connection
  readonly capabilities: NodeCapabilities;
  readonly status: NodeStatus;
  readonly reputation: ReputationScore;
  readonly registeredAt: Date;
  readonly lastSeen: Date;
}

export interface NodeCapabilities {
  readonly gpuModel: string;
  readonly vramGB: number;
  readonly supportedModels: string[];
  readonly maxConcurrentJobs: number;
  readonly region: string;
}

export type NodeStatus = 
  | 'online'      // Active and accepting jobs
  | 'busy'        // At capacity
  | 'offline'     // Disconnected
  | 'suspended';  // Penalized for bad behavior

/**
 * Reputation system prevents Sybil attacks and ensures quality
 * 
 * AUDIT: Reputation must decay over time to prevent "sleeping giants" from
 * dominating the network. Recent performance matters more than historical.
 */
export interface ReputationScore {
  readonly totalJobs: number;
  readonly successfulJobs: number;
  readonly failedJobs: number;
  readonly averageLatencyMs: number;
  readonly score: number;  // 0-1000, weighted moving average
  readonly lastUpdated: Date;
}

// ============================================================================
// JOB TYPES
// ============================================================================

/**
 * Inference job structure
 * 
 * AUDIT: All jobs must include ZK-proof requirements to prevent:
 * 1. Nodes claiming payment without doing work
 * 2. Users disputing valid results
 * 3. Man-in-the-middle result tampering
 */
export interface InferenceJob {
  readonly id: string;
  readonly modelId: string;
  readonly prompt: string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly userAddress: string;
  readonly maxPrice: string;  // Maximum HSK willing to pay
  readonly priority: JobPriority;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly status: JobStatus;
  readonly result?: JobResult;
}

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export type JobStatus = 
  | 'pending'     // Awaiting node assignment
  | 'assigned'    // Node selected, not started
  | 'running'     // Node processing
  | 'completed'   // Success, result available
  | 'failed'      // Node error or timeout
  | 'disputed';   // User challenging result

export interface JobResult {
  readonly output: string;
  readonly tokensUsed: number;
  readonly computeTimeMs: number;
  readonly nodeId: string;
  readonly completedAt: Date;
  readonly proof: ZKProof;  // Cryptographic proof of valid execution
}

/**
 * Zero-knowledge proof structure
 * 
 * AUDIT: Proof verification is the security critical path. Any vulnerability
 * here allows nodes to steal funds without doing work.
 */
export interface ZKProof {
  readonly proof: string;      // Serialized ZK proof
  readonly publicInputs: string[];  // Job hash, output hash, etc.
  readonly verifierContract: string;  // On-chain verifier address
}

// ============================================================================
// PAYMENT TYPES
// ============================================================================

/**
 * Payment structure for job settlement
 * 
 * AUDIT: All payment calculations must be deterministic and verifiable on-chain.
 * Floating point math is forbidden - use only integer arithmetic with 18 decimals.
 */
export interface Payment {
  readonly jobId: string;
  readonly payer: string;
  readonly payee: string;
  readonly amount: string;     // HSK amount (wei-like, 18 decimals)
  readonly platformFee: string; // 10% to Synapse treasury
  readonly timestamp: Date;
  readonly txHash?: string;    // On-chain settlement hash
}

/**
 * Escrow state for pending jobs
 * 
 * AUDIT: Escrow release conditions must be precisely defined:
 * - Success: Release to node after proof verification
 * - Failure: Return to user after timeout
 * - Dispute: Lock until arbitration completes
 */
export interface EscrowState {
  readonly jobId: string;
  readonly amount: string;
  readonly status: 'locked' | 'released' | 'refunded';
  readonly lockExpiry: Date;  // Auto-refund if no completion
}

// ============================================================================
// API TYPES
// ============================================================================

/**
 * Standard API response wrapper
 * 
 * AUDIT: All API responses must use this structure for consistency.
 * Never return raw data without error handling envelope.
 */
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ApiError;
  readonly requestId: string;  // For tracing and debugging
  readonly timestamp: Date;
}

export interface ApiError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export type ErrorCode = 
  // Validation errors (400)
  | 'INVALID_REQUEST'
  | 'INVALID_ADDRESS'
  | 'INVALID_AMOUNT'
  | 'INSUFFICIENT_FUNDS'
  | 'MODEL_NOT_SUPPORTED'
  
  // Not found (404)
  | 'JOB_NOT_FOUND'
  | 'NODE_NOT_FOUND'
  
  // State errors (409)
  | 'JOB_ALREADY_ASSIGNED'
  | 'NODE_BUSY'
  | 'PROOF_VERIFICATION_FAILED'
  
  // System errors (500)
  | 'INTERNAL_ERROR'
  | 'BLOCKCHAIN_ERROR'
  | 'ZK_VERIFICATION_ERROR';

// ============================================================================
// SMART CONTRACT INTERFACES
// ============================================================================

/**
 * On-chain job registry
 * 
 * AUDIT: This is the source of truth for payments. Any off-chain state
 * must eventually reconcile to these events.
 */
export interface JobRegistryEvent {
  readonly event: 'JobCreated' | 'JobAssigned' | 'JobCompleted' | 'JobDisputed' | 'PaymentReleased';
  readonly jobId: string;
  readonly blockNumber: number;
  readonly transactionHash: string;
  readonly timestamp: Date;
  readonly data: Record<string, unknown>;
}

/**
 * Token contract interface
 * 
 * AUDIT: HSK token follows ERC-20 with extensions:
 * - permit() for gasless approvals
 * - burn() for deflationary mechanics
 */
export interface TokenContract {
  readonly address: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly totalSupply: string;
}

// ============================================================================
// RUNTIME TYPES
// ============================================================================

/**
 * Configuration for Synapse SDK
 * 
 * AUDIT: All config values have defaults and validation ranges.
 * Invalid config must fail fast at initialization, not runtime.
 */
export interface SynapseConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly chainId: number;
  readonly contractAddresses: {
    readonly jobRegistry: string;
    readonly token: string;
    readonly verifier: string;
  };
}

/**
 * Performance metrics for monitoring
 * 
 * AUDIT: Metrics must not expose sensitive data (prompts, user addresses).
 * Aggregate only, with privacy-preserving sampling.
 */
export interface NetworkMetrics {
  readonly totalNodes: number;
  readonly onlineNodes: number;
  readonly totalJobs24h: number;
  readonly averageLatencyMs: number;
  readonly totalVolume24h: string;  // HSK volume
  readonly activeUsers24h: number;
}

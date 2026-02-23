/**
 * API Gateway Type Definitions
 * 
 * @module synapse-backend/api-gateway/types
 * @description Shared TypeScript types for API Gateway
 */

import type { Request, Response, NextFunction } from 'express';

// ============================================================================
// USER TYPES
// ============================================================================

/**
 * Authenticated user data
 */
export interface AuthenticatedUser {
  /** User wallet address */
  address: string;
  /** API key identifier */
  apiKeyId: string;
  /** Authentication timestamp */
  authenticatedAt: Date;
  /** Rate limit tier */
  tier: 'free' | 'basic' | 'pro' | 'enterprise';
  /** Request quota remaining */
  quotaRemaining: number;
}

/**
 * Extended Express request with user
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  requestId: string;
  startTime: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta: ResponseMeta;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  /** Unique request ID for tracing */
  requestId: string;
  /** Response timestamp */
  timestamp: string;
  /** Request duration in milliseconds */
  durationMs: number;
  /** API version */
  version: string;
  /** Pagination info if applicable */
  pagination?: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// JOB TYPES
// ============================================================================

/**
 * Job priority levels
 */
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Job status
 */
export type JobStatus = 
  | 'pending'
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'disputed';

/**
 * Job creation request
 */
export interface CreateJobRequest {
  modelId: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  priority?: JobPriority;
  maxPrice?: string;
  callbackUrl?: string;
}

/**
 * Job response
 */
export interface JobResponse {
  id: string;
  modelId: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  priority: JobPriority;
  status: JobStatus;
  userAddress: string;
  maxPrice: string;
  createdAt: string;
  expiresAt: string;
  assignedNode?: string;
  result?: JobResult;
}

/**
 * Job result
 */
export interface JobResult {
  output: string;
  tokensUsed: number;
  computeTimeMs: number;
  nodeId: string;
  completedAt: string;
  proof: {
    proof: string;
    publicInputs: string[];
    verified: boolean;
  };
}

// ============================================================================
// NODE TYPES
// ============================================================================

/**
 * Node status
 */
export type NodeStatus = 'online' | 'busy' | 'offline' | 'suspended' | 'maintenance';

/**
 * Node information
 */
export interface NodeInfo {
  id: string;
  address: string;
  endpoint: string;
  status: NodeStatus;
  capabilities: NodeCapabilities;
  reputation: NodeReputation;
  registeredAt: string;
  lastSeen: string;
  currentLoad: number;
  earnings: string;
}

/**
 * Node hardware capabilities
 */
export interface NodeCapabilities {
  gpuModel: string;
  vramGB: number;
  supportedModels: string[];
  maxConcurrentJobs: number;
  region: string;
}

/**
 * Node reputation metrics
 */
export interface NodeReputation {
  score: number;
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  averageLatencyMs: number;
  lastUpdated: string;
}

/**
 * Node registration request
 */
export interface RegisterNodeRequest {
  endpoint: string;
  gpuModel: string;
  vramGB: number;
  supportedModels: string[];
  maxConcurrentJobs: number;
  region: string;
  stakeAmount: string;
}

// ============================================================================
// MIDDLEWARE TYPES
// ============================================================================

/**
 * Express middleware function type
 */
export type MiddlewareFunction = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Error handler middleware type
 */
export type ErrorHandler = (
  err: Error,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void;

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

/**
 * API gateway configuration
 */
export interface GatewayConfig {
  port: number;
  logLevel: string;
  allowedOrigins: string[];
  rateLimits: {
    default: RateLimitConfig;
    authenticated: RateLimitConfig;
  };
  security: {
    helmet: boolean;
    cors: boolean;
    hsts: boolean;
  };
}

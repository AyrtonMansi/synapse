/**
 * Quick Reference Guide for Synapse Developers
 * 
 * Essential patterns and utilities for working with the Synapse codebase
 */

// ============================================================================
// ERROR HANDLING
// ============================================================================

import { 
  SynapseError, 
  ErrorCode, 
  isSynapseError,
  ValidationError 
} from '@synapse/core';

// ✅ DO: Use standardized errors
async function fetchUser(id: string) {
  try {
    const user = await api.getUser(id);
    return user;
  } catch (error) {
    if (isSynapseError(error)) {
      // Type-safe error handling
      switch (error.code) {
        case ErrorCode.USER_NOT_FOUND:
          return null;
        case ErrorCode.RATE_LIMITED:
          await delay(error.details?.retryAfter || 60);
          return fetchUser(id);
        default:
          throw error;
      }
    }
    throw new SynapseError(
      'Unknown error fetching user',
      ErrorCode.INTERNAL_ERROR,
      { originalError: error }
    );
  }
}

// ❌ DON'T: Use generic errors
async function badFetchUser(id: string) {
  const user = await api.getUser(id); // No error handling!
  return user;
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

import { withRetry, ExponentialBackoff, CircuitBreaker } from '@synapse/core';

// ✅ DO: Use retry wrapper for external calls
const fetchWithRetry = async (url: string) => {
  return withRetry(
    () => fetch(url),
    new ExponentialBackoff({ maxRetries: 3 }),
    { 
      onRetry: (error, attempt) => {
        console.log(`Retry ${attempt}: ${error.message}`);
      }
    }
  );
};

// ✅ DO: Use circuit breaker for critical services
const apiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30000,
});

async function callCriticalService() {
  return apiCircuitBreaker.execute(async () => {
    return await fetch('/api/critical');
  });
}

// ============================================================================
// CACHING
// ============================================================================

import { MemoryCache, memoize, CacheKeyBuilder } from '@synapse/core';

// ✅ DO: Cache expensive operations
const userCache = new MemoryCache<User>({ ttl: 60000 });

async function getUser(id: string) {
  const cached = userCache.get(id);
  if (cached) return cached;
  
  const user = await fetchUser(id);
  userCache.set(id, user);
  return user;
}

// ✅ DO: Use memoize for pure functions
const fetchUserMemoized = memoize(
  async (id: string) => await fetchUser(id),
  (id) => `user:${id}`,
  { ttl: 60000 }
);

// ✅ DO: Use CacheKeyBuilder for complex keys
const key = CacheKeyBuilder
  .for('user')
  .id(userId)
  .segment('profile')
  .build(); // "user:id:123:profile"

// ============================================================================
// VALIDATION
// ============================================================================

import { 
  validateAddress, 
  validateTokenAmount,
  isValidAddress 
} from '@synapse/core';

// ✅ DO: Validate inputs early
function transferTokens(to: string, amount: string) {
  const address = validateAddress(to); // Throws on invalid
  const validAmount = validateTokenAmount(amount, 18);
  
  return executeTransfer(address, validAmount);
}

// ✅ DO: Use type guards for checks
if (isValidAddress(input)) {
  // TypeScript knows input is valid address here
  await fetchBalance(input);
}

// ============================================================================
// REACT PATTERNS
// ============================================================================

// ✅ DO: Use useCallback for event handlers
import { useCallback, useMemo } from 'react';

function UserProfile({ userId, onUpdate }: Props) {
  // Memoized callback - stable reference
  const handleUpdate = useCallback(() => {
    onUpdate(userId);
  }, [userId, onUpdate]);
  
  // Memoized expensive computation
  const displayName = useMemo(() => {
    return formatUserName(user.firstName, user.lastName);
  }, [user.firstName, user.lastName]);
  
  return <button onClick={handleUpdate}>{displayName}</button>;
}

// ✅ DO: Wrap components with error boundary
import { withErrorBoundary } from '@/components/ErrorBoundary';

const SafeDashboard = withErrorBoundary(Dashboard, {
  onError: (error) => reportToSentry(error),
});

// ============================================================================
// API CLIENT PATTERNS
// ============================================================================

// ✅ DO: Standardize API responses
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta: { requestId: string; timestamp: string };
}

// ✅ DO: Add request ID for tracing
async function apiRequest<T>(url: string): Promise<T> {
  const requestId = crypto.randomUUID();
  
  const response = await fetch(url, {
    headers: { 'X-Request-ID': requestId },
  });
  
  if (!response.ok) {
    throw new SynapseError(
      `API request failed: ${response.status}`,
      ErrorCode.BLOCKCHAIN_ERROR,
      { requestId, status: response.status }
    );
  }
  
  return response.json();
}

// ============================================================================
// TYPESCRIPT PATTERNS
// ============================================================================

// ✅ DO: Use branded types for IDs
type UserId = string & { __brand: 'UserId' };
type NodeId = string & { __brand: 'NodeId' };

function getUser(id: UserId) { /* ... */ }
function getNode(id: NodeId) { /* ... */ }

const userId = '123' as UserId;
const nodeId = '456' as NodeId;

getUser(userId); // ✅ OK
getUser(nodeId); // ❌ Type error!

// ✅ DO: Use Result type for explicit errors
import type { Result } from '@synapse/core';

async function mightFail(): Promise<Result<Data, Error>> {
  try {
    const data = await fetchData();
    return { ok: true, value: data };
  } catch (error) {
    return { ok: false, error };
  }
}

// Usage
const result = await mightFail();
if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error);
}

// ============================================================================
// LOGGING
// ============================================================================

import { createLogger, LogLevel } from '@synapse/core';

// ✅ DO: Use structured logging
const logger = createLogger({
  name: 'UserService',
  level: LogLevel.INFO,
  json: process.env.NODE_ENV === 'production',
});

// Good: Structured context
logger.info('User created', { 
  userId: user.id, 
  tier: user.tier,
  timestamp: new Date().toISOString(),
});

// Bad: String interpolation
console.log(`User created: ${user.id}`); // ❌ Not searchable

// ============================================================================
// TESTING PATTERNS
// ============================================================================

// ✅ DO: Test error scenarios
import { describe, it, expect } from 'vitest';

describe('fetchUser', () => {
  it('should return null for non-existent user', async () => {
    const user = await fetchUser('non-existent');
    expect(user).toBeNull();
  });
  
  it('should retry on rate limit', async () => {
    // Mock rate limit then success
    const user = await fetchUser('123');
    expect(user).toBeDefined();
  });
  
  it('should throw on network error', async () => {
    await expect(fetchUser('123')).rejects.toThrow(SynapseError);
  });
});

// ============================================================================
// PERFORMANCE CHECKLIST
// ============================================================================

/**
 * Before committing code, verify:
 * 
 * □ No console.log in production code (use logger)
 * □ Event handlers use useCallback
 * □ Expensive computations use useMemo
 * □ Lists have proper keys
 * □ Images are optimized/lazy loaded
 * □ API calls have error handling
 * □ Expensive operations are cached
 * □ No memory leaks (cleanup useEffect)
 * □ Bundle size is reasonable
 */

// ============================================================================
// SECURITY CHECKLIST
// ============================================================================

/**
 * Security best practices:
 * 
 * □ Validate all user inputs
 * □ Sanitize error messages (no internal details)
 * □ Use HTTPS for all API calls
 * □ Store secrets in environment variables
 * □ Rate limit sensitive endpoints
 * □ Add CSRF protection for mutations
 * □ Escape HTML in user content
 * □ Use Content Security Policy
 * □ Validate webhook signatures
 */

// ============================================================================
// COMMON MISTAKES TO AVOID
// ============================================================================

// ❌ DON'T: Use any
function badFunction(data: any) { // ❌
  return data.value;
}

// ✅ DO: Use unknown and type guard
function goodFunction(data: unknown) { // ✅
  if (typeof data === 'object' && data !== null) {
    return (data as Record<string, unknown>).value;
  }
}

// ❌ DON'T: Ignore promise rejections
fetchData(); // ❌ Unhandled promise

// ✅ DO: Always handle errors
fetchData().catch(error => {
  logger.error('Failed to fetch data', error);
});

// ❌ DON'T: Hardcode magic numbers
if (status === 4) { // ❌ What is 4?
  // ...
}

// ✅ DO: Use enums/constants
enum NodeStatus {
  OFFLINE = 0,
  ONLINE = 1,
  // ...
}

if (status === NodeStatus.ONLINE) { // ✅ Clear intent
  // ...
}

// ============================================================================
// GETTING HELP
// ============================================================================

/**
 * Resources:
 * - Architecture: docs/adr/README.md
 * - Changelog: CHANGELOG.md
 * - Error Codes: @synapse/core/src/errors.ts
 * - API Types: synapse-backend/api-gateway/src/types.ts
 * 
 * Support:
 * - Include request ID in bug reports
 * - Check logs for error context
 * - Use TypeScript strict mode
 */

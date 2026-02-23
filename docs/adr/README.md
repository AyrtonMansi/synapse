# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Synapse Protocol.

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences.

## Format

Each ADR follows this structure:
1. **Title** - Short noun phrase
2. **Status** - Proposed, Accepted, Deprecated, Superseded
3. **Context** - Forces at play and the issue motivating the decision
4. **Decision** - Response to forces
5. **Consequences** - Results after decision is applied

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| 001 | TypeScript as Primary Language | Accepted | 2024-02-23 |
| 002 | Zod for Runtime Validation | Accepted | 2024-02-23 |
| 003 | Modular Error Handling | Accepted | 2024-02-23 |
| 004 | Circuit Breaker Pattern | Accepted | 2024-02-23 |
| 005 | In-Memory Caching Strategy | Accepted | 2024-02-23 |
| 006 | Structured Logging | Accepted | 2024-02-23 |

---

# ADR 001: TypeScript as Primary Language

## Status
Accepted

## Context
The Synapse Protocol codebase was initially mixed JavaScript and TypeScript, leading to:
- Runtime type errors in production
- Poor developer experience with intellisense
- Difficulty refactoring due to lack of type safety
- Inconsistent code quality across packages

## Decision
All new code must be TypeScript with strict mode enabled. Existing JavaScript files should be migrated when modified.

## Consequences

### Positive
- Compile-time type checking catches errors before production
- Better IDE support with autocompletion and inline documentation
- Easier refactoring with confidence
- Self-documenting code through types

### Negative
- Build step required for all packages
- Learning curve for developers new to TypeScript
- Some third-party libraries lack types (require @types packages)

---

# ADR 002: Zod for Runtime Validation

## Status
Accepted

## Context
TypeScript only provides compile-time type safety. External data (API requests, contract calls, user input) needs runtime validation to ensure type safety at runtime.

Alternatives considered:
- io-ts: Good functional approach but steeper learning curve
- Joi: Popular but larger bundle size
- Yup: Good for forms but less suited for general validation
- class-validator: Requires decorator metadata

## Decision
Use Zod for all runtime validation needs.

## Consequences

### Positive
- TypeScript-first design with type inference
- Excellent error messages out of the box
- Composable schemas for complex validation
- Lightweight bundle size
- Can derive TypeScript types from schemas (single source of truth)

### Negative
- Additional dependency
- Learning curve for complex schema composition
- Runtime overhead (acceptable for our use case)

---

# ADR 003: Modular Error Handling

## Status
Accepted

## Context
Error handling was inconsistent across the codebase:
- Different error formats in API responses
- No standard error codes
- Inconsistent HTTP status codes
- Poor error messages for users

## Decision
Implement a centralized error handling module with:
1. Standardized error codes (40+ types)
2. Hierarchical error classes
3. HTTP status code mapping
4. Type guards for error handling
5. User-friendly error messages

## Consequences

### Positive
- Consistent error responses across all APIs
- Type-safe error handling in TypeScript
- Better debugging with structured error context
- Users receive actionable error messages
- Easy to add new error types

### Negative
- Additional code complexity
- Developers must learn error hierarchy
- All errors must be converted to standard format

---

# ADR 004: Circuit Breaker Pattern

## Status
Accepted

## Context
External dependencies (blockchain RPC, database, third-party APIs) can fail or become slow, causing cascade failures in our services.

## Decision
Implement Circuit Breaker pattern for all external service calls.

Configuration:
- Failure threshold: 5 errors
- Reset timeout: 30 seconds
- Success threshold to close: 3 successful calls

## Consequences

### Positive
- Prevents cascade failures
- Fast failure when service is unhealthy
- Automatic recovery detection
- Better user experience (fail fast vs timeout)

### Negative
- Additional complexity in service calls
- Potential false positives (temporary blips trigger circuit)
- Requires monitoring to detect open circuits

---

# ADR 005: In-Memory Caching Strategy

## Status
Accepted

## Context
Many API responses are expensive to compute but change infrequently (node lists, network metrics). Repeated requests waste resources.

## Decision
Implement in-memory caching with:
- TTL-based expiration (default 5 minutes)
- LRU eviction when size limit reached
- Cache statistics for monitoring
- Per-key TTL override capability

For production, Redis will be used as distributed cache.

## Consequences

### Positive
- Reduced database load
- Faster response times
- Configurable per-endpoint caching
- Statistics for cache hit rate monitoring

### Negative
- Memory usage increases
- Stale data risk (mitigated by TTL)
- Cache invalidation complexity
- Not suitable for multi-instance deployment without Redis

---

# ADR 006: Structured Logging

## Status
Accepted

## Context
Logging was inconsistent with mixed formats (console.log, winston, etc.). Debugging production issues was difficult without structured logs.

## Decision
Implement structured logging with:
1. JSON format in production
2. Human-readable format in development
3. Log levels (DEBUG, INFO, WARN, ERROR, FATAL)
4. Request correlation IDs
5. Child loggers for namespacing

## Consequences

### Positive
- Easy log aggregation in production
- Correlated logs for request tracing
- Better debugging experience
- Log level filtering for different environments

### Negative
- Must avoid logging sensitive data
- More verbose than console.log
- Requires discipline to maintain structure

---

# ADR 007: React Query for Data Fetching

## Status
Accepted

## Context
Data fetching in React was inconsistent with useEffect patterns, leading to:
- Race conditions
- Duplicate requests
- No caching
- Complex loading/error state management

## Decision
Use TanStack Query (React Query) for all server state management.

## Consequences

### Positive
- Automatic caching and deduplication
- Background refetching
- Optimistic updates
- Built-in loading/error states
- DevTools for debugging

### Negative
- Additional dependency
- Learning curve for developers
- Can over-fetch if not configured properly

---

# ADR 008: Monorepo Structure

## Status
Accepted

## Context
The Synapse Protocol consists of multiple related packages (frontend, backend, contracts, SDK, mobile).

Alternatives considered:
- Separate repositories: Better isolation but harder cross-package changes
- Monorepo with Yarn workspaces: Good but we use npm
- Monorepo with Nx/Turborepo: Powerful but adds complexity

## Decision
Maintain monorepo with independent packages using npm workspaces.

Package structure:
```
workspace/
├── synapse-core/        # Shared SDK
├── synapse-frontend/    # Web dashboard
├── synapse-backend/     # API services
├── synapse-contracts/   # Smart contracts
├── synapse-mobile/      # React Native app
├── synapse-sdk/         # Developer SDKs
└── synapse-testing/     # Test suites
```

## Consequences

### Positive
- Atomic cross-package changes
- Shared code in synapse-core
- Easier dependency management
- Single CI/CD pipeline

### Negative
- Larger repository size
- Longer CI times for all packages
- Must version packages independently
- Requires careful commit message discipline

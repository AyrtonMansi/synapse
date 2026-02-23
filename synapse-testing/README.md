# Synapse Testing & QA Suite

Comprehensive testing framework for the Synapse platform covering integration, security, performance, and CI/CD automation.

## 📁 Directory Structure

```
synapse-testing/
├── integration/           # Integration tests
│   ├── api-e2e.test.ts   # End-to-end API testing
│   ├── smart-contracts.test.ts  # Smart contract integration
│   ├── p2p-mesh.test.ts  # P2P mesh network testing
│   └── load-tests/       # Load testing scripts (k6)
├── security/             # Security tests
│   ├── penetration.test.ts    # Penetration testing
│   ├── fuzzing/          # Contract fuzzing
│   ├── access-control.test.ts # Access control validation
│   └── rate-limit-test.js     # Rate limiting tests
├── performance/          # Performance tests
│   ├── benchmarks.test.ts     # Benchmarking suite
│   ├── stress-test.js         # Stress testing (k6)
│   ├── concurrent-users.test.ts # User simulation
│   └── memory-leak-detector.js  # Memory leak detection
├── ci-cd/                # CI/CD workflows
│   └── .github/workflows/
│       ├── ci-cd.yml     # Main CI/CD pipeline
│       ├── pr-tests.yml  # PR automation
│       ├── deploy.yml    # Deployment automation
│       └── coverage.yml  # Coverage reporting
├── utils/                # Test utilities
│   ├── api-client.ts     # API client for tests
│   ├── test-env.ts       # Test environment manager
│   ├── benchmark.ts      # Benchmark runner
│   └── ...
├── fixtures/             # Test fixtures
├── reports/              # Test reports output
└── package.json          # Dependencies and scripts
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:security
npm run test:performance

# Run with coverage
npm run coverage

# Run fuzzing
npm run fuzz

# Run load tests (requires k6)
npm run test:load
```

## 🧪 Test Categories

### 1. Integration Tests

#### End-to-End API Testing
- Authentication flows (OAuth2, JWT)
- Message CRUD operations
- Channel management
- Real-time WebSocket events
- Error handling and rate limiting

```bash
npm run test:integration
```

#### Smart Contract Integration
- Contract deployment and interaction
- Token operations (ERC-20)
- Message registry
- Multi-sig operations
- Upgradeability patterns

#### P2P Mesh Testing
- Node discovery and bootstrap
- Message propagation
- Network partitioning resilience
- Protocol negotiation

#### Load Testing
Powered by k6:

```bash
# API load test
k6 run integration/load-tests/api-load.js

# WebSocket load test
k6 run integration/load-tests/websocket-load.js
```

### 2. Security Tests

#### Penetration Testing
- SQL injection prevention
- XSS protection
- Authentication bypass attempts
- Authorization validation
- CSRF protection
- File upload security

```bash
npm run test:security
```

#### Contract Fuzzing

```bash
# Fuzz a specific contract
node security/fuzzing/contract-fuzzer.js \
  0xContractAddress \
  ./abi/MessageRegistry.json \
  1000
```

#### Access Control Validation
- RBAC enforcement
- ABAC policies
- API key scoping
- Permission inheritance

#### Rate Limit Testing

```bash
k6 run security/rate-limit-test.js
```

### 3. Performance Tests

#### Benchmarking Suite
- API response times
- Database throughput
- Cryptographic operations
- Serialization formats
- P2P network latency

```bash
npm run test:performance
```

#### Stress Testing

```bash
k6 run performance/stress-test.js
```

#### Concurrent User Simulation
- Realistic user behavior patterns
- Large chat rooms (500+ users)
- Message ordering guarantees
- WebSocket connection limits

#### Memory Leak Detection

```bash
node performance/memory-leak-detector.js
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflows

#### Main Pipeline (`ci-cd.yml`)
1. Lint and format checks
2. Unit tests with coverage
3. Integration tests
4. Security tests + CodeQL
5. Performance benchmarks
6. Docker build and push
7. Staging deployment
8. Production deployment (main branch)

#### PR Automation (`pr-tests.yml`)
- Fast feedback on PRs
- Affected test detection
- Coverage reporting
- Optional integration tests (via label)

#### Deployment (`deploy.yml`)
- Automated Kubernetes deployment
- Migration runner
- Smoke tests
- Automatic rollback on failure

#### Coverage (`coverage.yml`)
- Coverage badge generation
- PR coverage comments
- Threshold enforcement

## 📊 Test Configuration

### Environment Variables

```bash
# API
BASE_URL=http://localhost:8080
API_KEY=test-key

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/synapse
REDIS_URL=redis://localhost:6379

# Blockchain
RPC_URL=http://localhost:8545

# Test
TEST_TOKEN=mock-jwt-token
```

### Vitest Configuration

Two separate configs for unit and integration tests:
- `vitest.unit.config.ts` - Fast, isolated tests
- `vitest.integration.config.ts` - Full system tests

## 📈 Coverage Thresholds

| Metric     | Threshold |
|------------|-----------|
| Lines      | 80%       |
| Functions  | 80%       |
| Branches   | 75%       |
| Statements | 80%       |

## 🔧 Utilities

### API Client (`utils/api-client.ts`)
TypeScript client for API interactions with:
- Automatic authentication
- Request retries
- Error handling
- WebSocket support

### Test Environment (`utils/test-env.ts`)
Manages test lifecycle:
- Service startup
- Database setup
- Mock providers
- Cleanup

### Benchmark Runner (`utils/benchmark.ts`)
Performance measurement with:
- Statistical analysis
- Percentile calculations
- Report generation

## 📋 Reports

Test reports are generated in `reports/`:
- `coverage/` - Coverage reports (HTML, JSON, LCOV)
- `benchmark-report.json` - Performance benchmarks
- `integration-results.json` - Test results
- `fuzzing-report.json` - Fuzzing findings
- `memory-leak-report.json` - Memory analysis
- `load-test.json` - k6 load test results

## 🤝 Contributing

1. Write tests for new features
2. Ensure all tests pass: `npm test`
3. Maintain coverage thresholds
4. Follow existing patterns

## 📄 License

MIT - See LICENSE file for details

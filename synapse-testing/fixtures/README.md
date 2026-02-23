# Test Fixtures

This directory contains test data and fixtures used by the test suite.

## Structure

```
fixtures/
├── data/           # JSON data files
│   ├── users.json
│   ├── channels.json
│   └── messages.json
├── contracts/      # Smart contract artifacts
│   ├── MessageRegistry.json
│   └── SynapseToken.json
├── keys/           # Test cryptographic keys
│   ├── jwt-private.pem
│   └── jwt-public.pem
└── schemas/        # Validation schemas
    ├── message.json
    └── user.json
```

## Usage

```typescript
import users from '../fixtures/data/users.json';

// Use in tests
const testUser = users[0];
```

## Generating Fixtures

```bash
# Generate test data
npm run fixtures:generate

# Reset fixtures
npm run fixtures:reset
```

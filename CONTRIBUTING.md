# Contributing to Synapse

## Development Workflow

### Branching

```bash
# Create feature branch
git checkout -b feat/your-feature-name

# Make commits
git commit -m "feat: description"

# Push and open PR
git push origin feat/your-feature-name
```

### Commit Format

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `test:` tests
- `refactor:` code refactoring
- `perf:` performance
- `security:` security fixes
- `ops:` infrastructure/CI/CD

### Pre-commit Checklist

- [ ] Tests pass (`npm test`)
- [ ] Smoke tests pass (`./scripts/smoke-test.sh`)
- [ ] TypeScript compiles (`npm run build`)
- [ ] No secrets in code
- [ ] Updated docs if needed

## Service Development

### Gateway API

```bash
cd services/gateway-api
npm install
npm run dev  # Watch mode
npm test
```

### Router

```bash
cd services/router
npm install
npm run dev
npm test
```

### Node Agent

```bash
cd services/node-agent
npm install
npm run dev
```

### Web UI

```bash
cd services/web-ui
npm install
npm run dev  # Vite dev server
```

## Testing

### Unit Tests

```bash
# All services
npm test

# Specific service
cd services/gateway-api && npm test
```

### Integration Tests

```bash
./scripts/integration-test.sh
```

### Smoke Tests

```bash
# Start services first
docker compose up -d

# Run tests
./scripts/smoke-test.sh
./scripts/smoke-test-gpu.sh
```

## Database Migrations

Using Prisma:

```bash
cd services/gateway-api
npx prisma migrate dev --name your_migration
npx prisma migrate deploy
```

## Security

- Never commit secrets
- Use environment variables
- Run `npm audit` before commits
- Report security issues privately

## Code Review

All PRs require:
1. Passing CI
2. Code review approval
3. Security scan pass

## Questions?

Open an issue or join the Discord.

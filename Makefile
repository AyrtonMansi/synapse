.PHONY: all test install dev build clean contract-test smoke-test load-test

# Default target
all: test

# Development setup
install:
	cd services/gateway-api && npm install
	cd services/router && npm install
	cd services/node-agent && npm install
	cd services/web-ui && npm install
	cd services/settlement && npm install

cd hsk-contracts && forge install

# Run all tests
test: unit-test contract-test integration-test

# Unit tests
unit-test:
	cd services/gateway-api && npm test
	cd services/router && npm test
	cd services/settlement && npm test

# Contract tests
contract-test:
	cd hsk-contracts && forge test -v

# Integration test (requires docker)
integration-test: smoke-test

# Smoke test - full end-to-end
smoke-test:
	./scripts/smoke-test.sh

# Load tests
load-test:
	k6 run tests/load/spike-test.js

# Start development environment
dev:
	docker-compose up -d

# Build all services
build:
	docker-compose build

# Clean build artifacts
clean:
	rm -rf services/*/node_modules
	rm -rf services/*/dist
	rm -rf hsk-contracts/cache
	rm -rf hsk-contracts/out

# Deploy contracts locally
deploy-contracts:
	cd hsk-contracts && forge script script/Deploy.s.sol --fork-url http://localhost:8545

# Lint everything
lint:
	cd services/gateway-api && npm run lint
	cd services/router && npm run lint
	cd hsk-contracts && forge fmt --check

# Type check
typecheck:
	cd services/gateway-api && npx tsc --noEmit
	cd services/router && npx tsc --noEmit
	cd services/settlement && npx tsc --noEmit

# Security audit
security:
	cd hsk-contracts && slither .

# Kubernetes validation
k8s-validate:
	kubectl apply --dry-run=client -f infra/k8s/

# Terraform validation
terraform-validate:
	terraform -chdir=infra/terraform validate

# Full CI pipeline
ci: lint typecheck contract-test k8s-validate terraform-validate

.PHONY: help build start stop logs status clean test install dev-install format lint

# Default target
help:
	@echo "Synapse Node - Available Commands:"
	@echo ""
	@echo "  make build       - Build Docker image"
	@echo "  make start       - Start node with Docker Compose"
	@echo "  make stop        - Stop node"
	@echo "  make logs        - View node logs"
	@echo "  make status      - Check node status"
	@echo "  make cli-install - Install CLI tool locally"
	@echo "  make test        - Run tests"
	@echo "  make format      - Format code with black"
	@echo "  make lint        - Lint code with ruff"
	@echo "  make clean       - Clean up build artifacts"
	@echo ""

# Build Docker image
build:
	docker-compose build

# Start services
start:
	docker-compose up -d

# Start with monitoring
start-monitoring:
	docker-compose --profile monitoring up -d

# Stop services
stop:
	docker-compose down

# View logs
logs:
	docker-compose logs -f synapse-node

# Check status
status:
	@curl -s http://localhost:8080/health | python3 -m json.tool || echo "Node not running"

# Clean up
clean:
	docker-compose down -v
	docker system prune -f
	rm -rf build/ dist/ *.egg-info .pytest_cache

# Install CLI locally
cli-install:
	pip install -e .

# Development install
dev-install:
	pip install -e ".[dev]"

# Run tests
test:
	pytest tests/ -v

# Format code
format:
	black src/ tests/

# Lint code
lint:
	ruff check src/ tests/
	mypy src/

# Setup for development
setup: dev-install
	pre-commit install

# Quick inference test
test-inference:
	@curl -X POST http://localhost:8080/inference \
		-H "Content-Type: application/json" \
		-d '{"prompt":"Hello, what is your name?","max_tokens":50}'

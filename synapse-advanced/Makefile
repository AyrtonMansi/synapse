.PHONY: all install compile test deploy clean help

# Default target
all: install compile test

# Install dependencies
install:
	npm install

# Compile contracts
compile:
	npx hardhat compile

# Run tests
test:
	npx hardhat test

# Run tests with coverage
coverage:
	npx hardhat coverage

# Start local Hardhat node
node:
	npx hardhat node

# Deploy to localhost
deploy-local:
	npx hardhat run scripts/deploy.js --network localhost

# Deploy to Sepolia testnet
deploy-sepolia:
	npx hardhat run scripts/deploy.js --network sepolia

# Deploy to mainnet
deploy-mainnet:
	npx hardhat run scripts/deploy.js --network mainnet

# Verify contracts on Etherscan
verify:
	npx hardhat verify --network ${NETWORK} ${CONTRACT} ${ARGS}

# Clean build artifacts
clean:
	npx hardhat clean
	rm -rf cache/ artifacts/

# Lint Solidity files
lint-sol:
	solhint 'contracts/**/*.sol'

# Format code
format:
	npx prettier --write .

# Run gas report
gas:
	REPORT_GAS=true npx hardhat test

# Help
help:
	@echo "Available targets:"
	@echo "  install       - Install npm dependencies"
	@echo "  compile       - Compile smart contracts"
	@echo "  test          - Run test suite"
	@echo "  coverage      - Run tests with coverage report"
	@echo "  node          - Start local Hardhat node"
	@echo "  deploy-local  - Deploy to local network"
	@echo "  deploy-sepolia- Deploy to Sepolia testnet"
	@echo "  deploy-mainnet- Deploy to Ethereum mainnet"
	@echo "  verify        - Verify contracts on Etherscan"
	@echo "  clean         - Clean build artifacts"
	@echo "  lint-sol      - Lint Solidity files"
	@echo "  format        - Format code with Prettier"
	@echo "  gas           - Run gas usage report"

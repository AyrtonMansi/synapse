# Contributing to Synapse SDK

Thank you for your interest in contributing to the Synapse SDK! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/synapse-sdk.git`
3. Create a new branch: `git checkout -b feature/your-feature-name`

## Development Setup

### JavaScript/TypeScript

```bash
cd javascript-sdk
npm install
npm run dev
```

### Python

```bash
cd python-sdk
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -e ".[dev]"
```

### CLI

```bash
cd cli-tool
npm install
npm run dev
```

## Code Style

### TypeScript/JavaScript
- Follow the existing ESLint configuration
- Use Prettier for formatting
- Write tests for new features

### Python
- Follow PEP 8
- Use Black for formatting: `black src tests`
- Use isort for imports: `isort src tests`
- Add type hints to new functions

## Testing

Run the test suite before submitting:

```bash
# JavaScript
cd javascript-sdk && npm test

# Python
cd python-sdk && pytest
```

## Pull Request Process

1. Ensure your code follows the style guidelines
2. Add tests for new functionality
3. Update documentation as needed
4. Ensure all tests pass
5. Submit a pull request with a clear description

## Commit Messages

Use conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test changes
- `refactor:` Code refactoring

## Questions?

Open an issue or join our Discord community.

Thank you for contributing!
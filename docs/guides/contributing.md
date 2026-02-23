# Contributing to Synapse

Thank you for your interest in contributing to Synapse! This guide will help you get started.

## Ways to Contribute

- **Code:** Fix bugs, add features
- **Documentation:** Improve docs, write tutorials
- **Testing:** Report bugs, write tests
- **Community:** Help others, spread the word
- **Design:** UI/UX improvements

## Development Setup

### Prerequisites

- Go 1.21+
- Node.js 18+
- Python 3.9+
- Docker
- Git

### Clone Repositories

```bash
# Main protocol
git clone https://github.com/synapse-protocol/synapse.git
cd synapse

# SDKs
git clone https://github.com/synapse-protocol/synapse-python.git
git clone https://github.com/synapse-protocol/synapse-js.git

# Documentation
git clone https://github.com/synapse-protocol/docs.git
```

### Build from Source

```bash
# Build core protocol
make build

# Run tests
make test

# Start local devnet
make devnet-up
```

## Code Guidelines

### Go

- Follow standard Go conventions
- Use `gofmt` for formatting
- Add tests for new functions
- Document exported functions

```go
// Good
// ProcessTask handles incoming computation tasks
func ProcessTask(ctx context.Context, task *Task) (*Result, error) {
    // Implementation
}
```

### Python

- Follow PEP 8
- Use type hints
- Document with docstrings

```python
from typing import Optional

def calculate_reward(
    task_duration: float,
    hardware_tier: int
) -> Optional[float]:
    """Calculate node reward for completed task.
    
    Args:
        task_duration: Time in seconds
        hardware_tier: Node hardware tier (1-5)
        
    Returns:
        Reward amount in SYN, or None if invalid
    """
    # Implementation
```

### JavaScript/TypeScript

- Use ESLint configuration
- Prefer TypeScript
- Add JSDoc comments

## Submitting Changes

1. **Fork** the repository
2. **Create branch:** `git checkout -b feature/my-feature`
3. **Make changes** with tests
4. **Commit:** `git commit -m "feat: add new feature"`
5. **Push:** `git push origin feature/my-feature`
6. **Open Pull Request**

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(scheduler): add priority queue for high-value tasks

Implements weighted fair queuing algorithm to prioritize
tasks based on price and reputation.

Closes #123
```

## Testing

### Unit Tests

```bash
# Go
go test ./...

# Python
pytest

# JavaScript
npm test
```

### Integration Tests

```bash
# Start local network
make testnet-up

# Run integration tests
make test-integration
```

## Code Review Process

1. All changes require review
2. CI must pass
3. At least one approval required
4. Squash and merge

## Documentation

- Update relevant docs
- Add examples for new features
- Keep README current

## Community

- Discord: https://discord.gg/synapse
- Forum: https://forum.synapse.io
- Twitter: @SynapseProtocol

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.

## Questions?

Open an issue or ask on Discord. We're here to help!

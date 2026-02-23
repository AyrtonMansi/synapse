# Load Testing Suite

Phase 14: Production load testing for Synapse network.

## Test Types

### 1. Spike Test (`spike-test.js`)
Tests the system's ability to handle sudden traffic increases.
- **Duration**: ~20 minutes
- **Load Pattern**: Gradual ramp to 400 concurrent users
- **Validates**: Response times stay under 500ms p95, <1% errors

```bash
k6 run tests/load/spike-test.js
```

### 2. Soak Test (`soak-test.js`)
Tests for memory leaks and degradation over extended periods.
- **Duration**: 1+ hour
- **Load Pattern**: 50 sustained concurrent users
- **Validates**: Stable performance, no memory growth

```bash
k6 run tests/load/soak-test.js
```

### 3. Stress Test (`stress-test.js`)
Finds the breaking point of the system.
- **Duration**: ~15 minutes
- **Load Pattern**: Ramp to 10,000 concurrent users
- **Validates**: Graceful degradation, recovery after overload

```bash
k6 run tests/load/stress-test.js
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | Target API endpoint | `https://api.synapse.sh` |
| `API_KEY` | API key for authenticated requests | Test key |

## Running Locally

```bash
# Install k6
brew install k6  # macOS
sudo apt install k6  # Ubuntu

# Run tests
export API_URL=http://localhost:3001
export API_KEY=your-test-key

k6 run tests/load/spike-test.js
```

## CI/CD Integration

Tests run automatically:
- **Nightly**: Spike test at 2 AM UTC
- **Manual**: All test types via workflow dispatch
- **PR**: Quick smoke test on PRs

## Interpreting Results

### Healthy Metrics
- P95 latency: < 500ms
- Error rate: < 1%
- Successful autoscaling: HPA triggers at 70% CPU

### Warning Signs
- P95 latency: 500ms - 1s
- Error rate: 1-5%
- Slow autoscaling: > 2 minutes

### Critical Issues
- P95 latency: > 1s
- Error rate: > 5%
- Pod restarts during test

## Load Testing Checklist

Before production release:
- [ ] Spike test passes at 2x expected peak load
- [ ] Soak test passes for 1 hour with no memory growth
- [ ] Stress test identifies breaking point
- [ ] Autoscaling triggers correctly
- [ ] Database connections don't exhaust pool
- [ ] No 5xx errors under normal load

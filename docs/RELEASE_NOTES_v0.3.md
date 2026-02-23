# Synapse v0.3 Release Notes — Economics Instrumentation

**Branch:** feat/v0.3-economics  
**Focus:** Miner adoption through profitability visibility

## What's New

### 🚀 GPU No-Friction (P1.1)
GPU bring-up now requires only:
```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```
- Removed Docker Compose profiles (simplified UX)
- Single command GPU node deployment
- Works on any CUDA-enabled host with nvidia-docker

### ⚡ O(1) API Key Auth (P1.2)
- **New format:** `syn_live_<keyId>_<secret>`
- **O(1) lookup:** Extract keyId from prefix → single DB row → bcrypt compare
- Eliminates O(n) key scanning for high-volume gateways
- Maintains bcrypt security for secret verification

### 📊 Node Benchmark + Telemetry (P1.3)
**Automatic startup benchmark:**
- Warmup: 1 inference
- Run: 5 inferences  
- Compute: tokens/sec from actual served output
- Report: tok_per_sec, model, hardware in HEARTBEAT

**Router tracks per-node:**
- Utilisation (busy_ms / wall_ms)
- Success rate (rolling window)
- p50 latency (approximate)

**Enhanced /stats endpoint:**
```json
{
  "nodes_online": 5,
  "jobs_today": 1234,
  "avg_latency_ms": 245,
  "served_model_counts": {
    "deepseek-v3": 890,
    "echo-stub": 344
  },
  "queue_depth": 0
}
```

### 💰 Miner Yield Estimate (P1.4)
**Gateway computes revenue band:**
```
$/day = tok/s × utilisation × 86400 × (rate_per_1m/1e6)
```

**Web UI displays:**
- Node fingerprint
- Benchmark tok/s
- Utilisation %
- Jobs/hr
- **Estimated** $/day band (explicitly labeled as estimate)

No promises. Just visibility into economic potential.

## Migration Guide

### API Keys
Old format `syn_...` continues to work. New keys use `syn_live_<id>_<secret>`.

### GPU Nodes
If you were using profiles:
```bash
# Old (with profiles)
docker compose --profile gpu up -d

# New (no profiles)
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

## Validation
```bash
# Full v0.3 validation
./scripts/validate-v0.3.sh

# Individual smoke tests
./scripts/smoke-test.sh        # CPU path
./scripts/smoke-test-gpu.sh    # GPU path (fails on fallback)
```

## Files Changed
- `docker-compose.gpu.yml` — Removed profiles
- `services/gateway-api/src/db/apiKeys.ts` — O(1) auth
- `services/gateway-api/src/schemas.ts` — New key format
- `services/node-agent/src/index.ts` — Benchmark telemetry
- `services/router/src/index.ts` — Utilisation tracking
- `services/gateway-api/src/index.ts` — Yield estimate
- `services/web-ui/src/App.tsx` — Miner dashboard
- `scripts/smoke-test.sh` — New key format
- `scripts/smoke-test-gpu.sh` — Profile removal
- `scripts/validate-v0.3.sh` — NEW validation suite

## Metrics Now Available
| Metric | Source | Use |
|--------|--------|-----|
| tok_per_sec | Node benchmark | Capacity planning |
| utilisation | Router telemetry | Fleet optimisation |
| served_model_counts | Router stats | Demand analysis |
| yield_estimate | Gateway calc | Miner onboarding |

---
*Built for miners who need to see the math before they commit GPUs.*

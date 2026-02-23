# Synapse P0 Hardening Implementation Summary

## Overview
Complete implementation of all 4 P0 hardening tasks for the Synapse inference network runtime.

---

## P0 TASK 1: Persist Node Keypair to Volume ✅

### Changes Made

**File: `/services/node-agent/src/index.ts`**
- Added `fs` and `path` imports for file operations
- Defined key storage paths (`/app/keys/node.key`, `/app/keys/node.pub`)
- Rewrote `initKeypair()` function to:
  - Check for existing keys in volume-mounted directory
  - Load existing keys if present (preserves identity across restarts)
  - Generate new ed25519 keypair only if missing
  - Persist keys to volume with secure permissions (0o600 for private key)
  - Generate stable fingerprint (first 16 chars of base64 public key)
  - Print fingerprint on startup for node identification

**File: `/docker-compose.yml`**
- Added `node-keys` volume for persistent key storage
- Mounted volume at `/app/keys` in node-agent service

**File: `/docker-compose.gpu.yml`**
- Added `vllm-keys` volume for vLLM node key persistence
- Mounted volume at `/app/keys` in vllm-node service

### Acceptance Criteria
- ✅ Node restart preserves identity (same fingerprint)
- ✅ Keys stored in Docker volume survive container restarts
- ✅ New keys generated only if missing
- ✅ Fingerprint printed on startup

---

## P0 TASK 2: Router Receipt Verification ✅

### Changes Made

**File: `/services/router/src/index.ts`**
- Added `createPublicKey` and `verify` imports from `crypto`
- Extended Node interface with:
  - `publicKey`: Store node's ed25519 public key
  - `fingerprint`: Node identity fingerprint
  - `receiptVersion`: Receipt schema version
- Implemented `verifyReceipt(node, data)` function:
  - Reconstructs receipt data exactly as node signed it
  - Loads node's public key from stored PEM
  - Verifies Ed25519 signature
  - Returns `{ valid: boolean, reason?: string }`
- Updated REGISTER handler to store publicKey and fingerprint
- Updated RESULT handler to:
  - Call `verifyReceipt()` on signed results
  - Apply 0.5x health penalty for invalid signatures
  - Reject results with invalid signatures (don't save to DB)
  - Maintain backward compatibility (soft warning for unsigned nodes)
  - Include `receipt_verified` status in response

### Security Features
- ✅ Signature verification using Ed25519
- ✅ Health penalty (0.5x) for invalid signatures
- ✅ Invalid receipts rejected (not saved to DB)
- ✅ Backward compatibility with unsigned nodes
- ✅ Verification status tracked per request

---

## P0 TASK 3: Served-Model Transparency ✅

### Changes Made

**File: `/services/node-agent/src/index.ts`**
- Track `servedModel` variable in `handleJob()`:
  - Set to `'deepseek-v3'` when vLLM is used
  - Set to `'echo-stub'` when fallback occurs
- Include `servedModel` in receipt data
- Return `servedModel` in RESULT message

**File: `/services/router/src/index.ts`**
- Track fallback in dispatch endpoint
- Include `served_model` and `fallback` status in response
- Pass through receipt verification status

**File: `/services/gateway-api/src/index.ts`**
- Add headers to HTTP response:
  - `x-synapse-model-served`: Actual model that served request
  - `x-synapse-model-requested`: Original requested model
  - `x-synapse-fallback: true` when fallback occurs
- Include `synapse_meta` in response body:
  - `requested_model`: What user asked for
  - `served_model`: What actually served it
  - `fallback`: Boolean fallback status
  - `node_id`: Serving node
  - `receipt_verified`: Signature verification status
- Store fallback status in usage_events

**File: `/services/gateway-api/src/router/client.ts`**
- Extended DispatchJobResult interface with:
  - `served_model`: Actual served model
  - `fallback`: Fallback flag
  - `requested_model`: Requested model
  - `receipt_verified`: Verification status

**File: `/services/web-ui/src/App.tsx`**
- Added Test tab with served model display
- Show requested vs served model comparison
- Visual indicator for fallback (yellow warning)
- Display receipt verification status
- Show node ID
- Green highlight when models match
- Yellow highlight on fallback

### Transparency Features
- ✅ Response headers show actual served model
- ✅ Fallback explicitly indicated
- ✅ Web UI displays model information
- ✅ No echo-stub fallback masking

---

## P0 TASK 4: GPU Path Readiness ✅

### Changes Made

**File: `/docker-compose.gpu.yml`** (Created)
- vLLM service with GPU profile:
  - Image: `vllm/vllm-openai:latest`
  - Model: `deepseek-ai/DeepSeek-V3`
  - Tensor parallel size: 1
  - Data type: float16
  - Max model length: 4096
  - GPU device reservations (nvidia driver)
  - Healthcheck endpoint
  - HuggingFace cache volume
- vLLM node agent service:
  - MODEL_PROFILE=vllm
  - NODE_ID configurable
  - Depends on vLLM healthcheck
  - Key persistence volume

**File: `/scripts/smoke-test-gpu.sh`** (Updated)
- Added `FALLBACK_DETECTED` tracking variable
- Verify vLLM health before testing
- Check `x-synapse-model-served` header is `deepseek-v3`
- Check `x-synapse-fallback` header is NOT `true`
- Verify response `model` field is `deepseek-v3`
- Check response does NOT contain `[Echo]`
- Verify `synapse_meta` present in response
- Check node fingerprint in router stats
- **CRITICAL**: Test FAILS if fallback to echo-stub detected
- Exit code 1 on any fallback

### GPU Features
- ✅ vLLM service with GPU support
- ✅ DeepSeek-V3 model registration
- ✅ GPU smoke test fails on echo-stub downgrade
- ✅ Health checks for vLLM availability
- ✅ Separate profile for GPU services

---

## Acceptance Criteria Summary

| Criteria | Status | Implementation |
|----------|--------|----------------|
| 1. Node restart preserves identity | ✅ | Keys loaded from `/app/keys/` volume, same fingerprint |
| 2. Router rejects invalid signatures | ✅ | verifyReceipt() rejects invalid, 0.5x health penalty |
| 3. Response header shows served model | ✅ | `x-synapse-model-served` header added |
| 4. GPU smoke test fails on downgrade | ✅ | FALLBACK_DETECTED triggers exit 1 |
| 5. CPU smoke test untouched | ✅ | Original smoke-test.sh unchanged |
| 6. No regression in concurrency | ✅ | Router concurrency tracking maintained |

---

## File Changes Summary

### Modified Files (7)
1. `services/node-agent/src/index.ts` - Key persistence, served model tracking
2. `services/router/src/index.ts` - Receipt verification, public key storage
3. `services/gateway-api/src/index.ts` - Response headers, synapse_meta
4. `services/gateway-api/src/router/client.ts` - Type definitions
5. `services/web-ui/src/App.tsx` - Test tab with model transparency UI
6. `docker-compose.yml` - Key volume mount
7. `scripts/smoke-test-gpu.sh` - Fail on fallback detection

### Created Files (2)
1. `docker-compose.gpu.yml` - GPU overlay with vLLM service
2. `scripts/validate-p0.sh` - P0 validation script

---

## Validation Commands

```bash
# Validate all P0 tasks
./scripts/validate-p0.sh

# Start services (CPU mode)
docker compose up -d --build

# Run CPU smoke test
./scripts/smoke-test.sh

# Start GPU services
docker compose -f docker-compose.yml -f docker-compose.gpu.yml --profile gpu up -d

# Run GPU smoke test (FAILS if fallback detected)
./scripts/smoke-test-gpu.sh

# View logs
docker compose logs -f
```

---

## Security Considerations

1. **Private Key Storage**: Private keys stored with 0o600 permissions (owner read/write only)
2. **Signature Verification**: All signed receipts verified before acceptance
3. **Health Penalties**: Invalid signatures reduce node health score (0.5x)
4. **Backward Compatibility**: Unsigned nodes allowed with warning (gradual migration)
5. **Transparency**: Users can see actual served model vs requested model
6. **Fallback Detection**: GPU tests explicitly fail on echo-stub fallback

---

## Implementation Notes

- All TypeScript files include inline comments marking P0 task changes
- No external dependencies added (uses Node.js built-in crypto)
- Docker volumes ensure persistence across container restarts
- Web UI backward compatible (shows additional info when available)
- Router maintains concurrent job handling (no regression)
- Zero-downtime key rotation possible (update keys, restart node)

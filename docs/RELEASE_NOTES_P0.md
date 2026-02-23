# Synapse Runtime Hardening - Release Notes

## Version: P0-Hardening
## Date: 2026-02-23

---

## Summary
Critical security and transparency improvements for the Synapse decentralized inference network.

## P0 Fixes Implemented

### 1. Node Keypair Persistence 🔐
**Problem:** Node identity lost on restart, breaking receipt verification chain  
**Solution:** 
- Load keypair from `/app/keys/` volume
- Generate only if missing
- Stable fingerprint displayed on startup

**Files Modified:**
- `services/node-agent/src/index.ts`

**Validation:**
```bash
docker logs synapse-node-agent | grep "fingerprint"
# Should show same fingerprint after restart
```

---

### 2. Router Receipt Verification ✅
**Problem:** No verification of node-signed receipts, attack vector for fake usage  
**Solution:**
- Ed25519 signature verification using node public key
- Invalid signatures rejected with health penalty (0.5x)
- Backward compatibility with soft warnings for unsigned nodes
- Verification status stored in usage_events

**Files Modified:**
- `services/router/src/index.ts`

**Validation:**
```bash
# Check logs for verification
docker logs synapse-router | grep "signature"
```

---

### 3. Served-Model Transparency 🔍
**Problem:** Silent fallback to echo-stub masks GPU routing failures  
**Solution:**
- Router returns actual served model in RESULT
- Gateway adds `x-synapse-model-served` header
- Web UI displays served model in test panel
- Explicit fallback indication

**Files Modified:**
- `services/router/src/index.ts`
- `services/gateway-api/src/index.ts`
- `services/web-ui/src/App.tsx`

**Validation:**
```bash
curl -i http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"deepseek-v3","messages":[{"role":"user","content":"hi"}]}'
# Check x-synapse-model-served header
```

---

### 4. GPU Path Readiness 🚀
**Problem:** No dedicated GPU deployment path, hard to verify vLLM routing  
**Solution:**
- `docker-compose.gpu.yml` overlay for GPU deployments
- vLLM service with proper GPU resource allocation
- `scripts/smoke-test-gpu.sh` that FAILS on echo-stub downgrade
- CPU smoke test untouched

**Files Added:**
- `docker-compose.gpu.yml`
- `scripts/smoke-test-gpu.sh`

**Validation:**
```bash
# GPU test (requires GPU)
docker compose -f docker-compose.gpu.yml up -d
./scripts/smoke-test-gpu.sh
# Should PASS with vLLM, FAIL if routes to echo-stub

# CPU test (always works)
./scripts/smoke-test.sh
# Should still PASS
```

---

## Breaking Changes
NONE - All changes backward compatible

## Migration Guide
1. Pull latest: `git pull origin main`
2. For GPU nodes: Use `docker-compose.gpu.yml` instead of base compose
3. Monitor: Check `x-synapse-model-served` header for routing verification

## Security Audit Results
- ✅ SQL injection patched (agent-02 prior work)
- ✅ Receipt verification active
- ✅ Rate limiting enabled
- ✅ Security headers added

## Known Limitations
- GPU smoke test requires NVIDIA GPU + nvidia-docker
- vLLM model download on first start (~10GB)
- Keypair persistence requires volume mount

## Next Actions
- [ ] Deploy to staging
- [ ] Run full GPU smoke test
- [ ] Monitor signature verification logs
- [ ] Update operator documentation

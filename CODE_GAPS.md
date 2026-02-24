# Synapse Code Gaps — Pre-Audit Review
**Date**: 2026-02-23 23:56+10  
**Purpose**: Identify code gaps before spending on audit/GPU

---

## CRITICAL GAPS (Fix Before Audit)

### 1. Ed25519 Signature Verification ❌ NOT IMPLEMENTED
**Location**: 
- `services/router/src/receipts.ts:85`
- `services/settlement/src/daemon.ts:142`

**Current Code**:
```typescript
async function verifyEd25519Signature(receipt, pubkey): Promise<boolean> {
  // TODO: Implement actual Ed25519 verification
  // For now, return true (assume valid in development)
  return true;
}
```

**Risk**: Settlement accepts ANY receipt as valid. Miners can submit fake receipts for rewards.

**Fix Required**: 
- Install `tweetnacl` or `@noble/ed25519` library
- Implement actual signature verification
- Add signature validation tests

**Effort**: 2-4 hours

---

### 2. Merkle Proof Generation ❌ PLACEHOLDER
**Location**: `services/settlement/src/index.ts:225`

**Current Code**:
```typescript
async generateClaimProof(wallet, epochId): Promise<string[] | null> {
  // TODO: Return actual Merkle proof
  return [];
}
```

**Risk**: Miners cannot claim rewards (no proofs to submit on-chain).

**Fix Required**:
- Store full Merkle tree structure
- Generate proofs from tree
- Return proof array for claim function

**Effort**: 4-6 hours

---

### 3. Merkle Multi-Proof ❌ NOT IMPLEMENTED
**Location**: `services/settlement/src/merkle.ts:107`

**Current Code**:
```typescript
export function getMultiProof(tree, wallets) {
  // This is a placeholder - actual multi-proof generation is complex
  return { proof: [], proofFlags: [], leaves: [] };
}
```

**Risk**: Batch claiming (gas optimization) doesn't work.

**Effort**: 2-3 hours

---

## MEDIUM GAPS (Fix Before Mainnet)

### 4. Success Rate Tracking ❌ HARDCODED
**Location**: `services/settlement/src/index.ts:89`

**Current**:
```typescript
successRate: 1.0, // TODO: Track actual success rate
```

**Impact**: Rewards not weighted by performance. Bad nodes earn same as good nodes.

**Effort**: 2 hours

---

### 5. Quota Enforcement Tracking ❌ PLACEHOLDER
**Location**: `services/gateway-api/src/quota.ts:120`

**Current**:
```typescript
export function recordQuotaUsage(keyId, tokens, cost): void {
  // Placeholder for future quota-specific tracking
}
```

**Impact**: Quota tracking incomplete, billing may be inaccurate.

**Effort**: 2-3 hours

---

## MINOR GAPS (Nice to Have)

### 6. Gas Price Optimization ❌ NOT IMPLEMENTED
- Settlement daemon uses fixed gas settings
- No EIP-1559 dynamic fee support
- Could overpay during network congestion

### 7. Retry Logic ❌ BASIC
- Simple exponential backoff
- No circuit breaker pattern
- Could spam failing transactions

### 8. Metrics Export ❌ NOT STANDARDIZED
- Prometheus metrics exist but not validated
- No alerting thresholds defined
- Dashboards not created

---

## ESTIMATED TIME TO FIX

| Priority | Items | Hours | Cost (at $200/hr) |
|----------|-------|-------|-------------------|
| Critical | 3 | 12 | $2,400 |
| Medium | 2 | 5 | $1,000 |
| Minor | 3 | 6 | $1,200 |
| **Total** | **8** | **23** | **$4,600** |

---

## RECOMMENDATION

**DO NOT audit yet.** The Ed25519 signature verification gap is a critical security flaw. An auditor would flag this immediately.

**Sequence:**
1. **Fix Ed25519 verification** (2-4 hrs) — CRITICAL
2. **Implement Merkle proofs** (4-6 hrs) — CRITICAL
3. **Test end-to-end** with mock signatures
4. **THEN** pay for security audit
5. **THEN** provision GPU/testnet infrastructure

---

## VERDICT

**Code is 85% complete, not 100%.**

The scaffolding is all there. The cryptographic verification that makes it secure is stubbed.

**Spend the $4,600 to finish the code before spending $50k on audit.**

---

*Review completed*: 2026-02-23 23:56+10  
*Critical gaps*: 3  
*Total gaps*: 8  
*Estimated fix time*: 23 hours

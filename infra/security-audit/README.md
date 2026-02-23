# PHASE 13: Security Audit Preparation

## Pre-Audit Checklist

### 1. Code Freeze
- [ ] Tag release candidate: `git tag -a v1.0.0-rc1 -m "Release candidate 1 for security audit"`
- [ ] Create audit branch: `git checkout -b audit/v1.0.0-rc1`
- [ ] Document all known issues in `KNOWN_ISSUES.md`
- [ ] Freeze all non-security changes during audit period

### 2. Documentation Package
- [ ] Architecture diagrams (threat model)
- [ ] API documentation (OpenAPI specs)
- [ ] Smart contract documentation (NatSpec)
- [ ] Deployment architecture
- [ ] Access control matrix
- [ ] Third-party dependencies list

### 3. Access Preparation
- [ ] Grant audit team repository access
- [ ] Provide staging environment credentials
- [ ] Share testnet deployment addresses
- [ ] Document admin roles and permissions
- [ ] Provide incident response contact

### 4. Test Environment
- [ ] Deploy fresh staging environment
- [ ] Fund test wallets with test ETH/tokens
- [ ] Provide VPN access if needed
- [ ] Share environment variables (sanitized)

## Scope Definition

### In Scope
1. **Smart Contracts**
   - HSKToken.sol (ERC20 implementation)
   - Treasury.sol (timelock and minting)
   - ComputeEscrow.sol (deposits and charging)
   - NodeRewards.sol (Merkle claims)

2. **Backend Services**
   - gateway-api (API key validation, routing)
   - router (job distribution, health scoring)
   - node-agent (job execution, receipts)
   - settlement (Merkle tree generation)

3. **Infrastructure**
   - Kubernetes manifests
   - Terraform configurations
   - Docker configurations

### Out of Scope
- Third-party dependencies (OpenZeppelin, etc.)
- vLLM/DeepSeek model code
- Frontend UI (Phase 15+)

## Known Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Centralized admin keys | High | Timelock on Treasury, multi-sig planned |
| Merkle tree generation | Medium | Off-chain generation, on-chain verification |
| Rate limit bypass | Medium | IP + API key dual rate limiting |
| Node impersonation | Medium | Ed25519 signatures required |

## Audit Questions for Reviewers

### Smart Contracts
1. Can the Treasury mint bypass the timelock?
2. Are there reentrancy risks in ComputeEscrow?
3. Is the Merkle verification correctly implemented?
4. Can rewards be double-claimed?

### Backend
1. Can API keys be brute-forced?
2. Is there request smuggling potential?
3. Can nodes fake benchmark results?
4. Is there SQL injection risk?

### Infrastructure
1. Are secrets properly managed?
2. Is mTLS enforced between services?
3. Are container images hardened?
4. Is the database properly secured?

## Tools for Auditors

### Static Analysis
```bash
# Smart contracts
cd hsk-contracts
slither .
mythril analyze src/HSKToken.sol
hevm symbolic --code $(cat bytecode.bin)

# TypeScript
npm audit
eslint --ext .ts services/
```

### Dynamic Analysis
```bash
# API fuzzing
ffuf -w wordlist.txt -u http://api.synapse.sh/FUZZ

# Contract interaction
yarn test:fuzz
```

### Penetration Testing
```bash
# Network scanning
nmap -sV api.synapse.sh

# SSL/TLS testing
testssl.sh api.synapse.sh
```

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Preparation | 3 days | Audit package ready |
| Initial Review | 5 days | First findings report |
| Fix Cycle | 5 days | Patches implemented |
| Re-review | 3 days | Verification |
| Final Report | 2 days | Signed audit report |

## Post-Audit Actions

1. Address all Critical and High findings
2. Document accepted risks for Medium/Low
3. Update security runbooks
4. Schedule re-audit in 6 months
5. Publish public audit report
6. Implement bug bounty program

## Contact

- Security Lead: security@synapse.sh
- Emergency: +1-XXX-XXX-XXXX
- PGP Key: [link]

# Security Checklist - Pre-Production

## Authentication & Authorization
- [ ] API keys use Argon2id/bcrypt hashing
- [ ] Key format includes extractable ID for O(1) lookup
- [ ] Rate limiting per IP (100 req/min)
- [ ] Rate limiting per API key
- [ ] Automatic IP blocking for abuse
- [ ] Admin endpoints require authentication
- [ ] Service-to-service mTLS configured

## Smart Contracts
- [ ] Treasury has 2-day timelock
- [ ] Daily mint cap enforced
- [ ] ReentrancyGuard on all external functions
- [ ] Pausable emergency stop
- [ ] Merkle proofs verified on-chain
- [ ] No unprotected selfdestruct
- [ ] No delegatecall to untrusted addresses
- [ ] Slither scan passing
- [ ] Mythril analysis completed

## Infrastructure
- [ ] TLS 1.3 only
- [ ] Security headers (HSTS, CSP, etc.)
- [ ] Secrets encrypted at rest
- [ ] Database encryption enabled
- [ ] Network policies in K8s
- [ ] Container images scanned (Trivy)
- [ ] Non-root containers
- [ ] Read-only filesystems where possible

## Monitoring & Response
- [ ] Structured logging enabled
- [ ] Prometheus metrics exposed
- [ ] Alerting rules configured
- [ ] Security runbook tested
- [ ] Incident response team contacts
- [ ] Log retention policy (90 days)
- [ ] Audit trail for admin actions

## Data Protection
- [ ] PII minimized in logs
- [ ] API keys never logged
- [ ] Private keys in HSM/secrets manager
- [ ] Database backups encrypted
- [ ] Backup testing schedule

## Network Security
- [ ] WAF configured
- [ ] DDoS protection enabled
- [ ] VPC network segmentation
- [ ] Security groups least privilege
- [ ] No exposed admin ports

## Operational Security
- [ ] Multi-factor auth for production access
- [ ] Production access logged
- [ ] Change management process
- [ ] Rollback procedures tested
- [ ] Security training completed

## Third-Party
- [ ] Dependencies audited (npm audit)
- [ ] No known CVEs in dependencies
- [ ] License compliance checked
- [ ] Vendor security assessments

## Pre-Launch
- [ ] Security audit completed
- [ ] Bug bounty program active
- [ ] Insurance coverage reviewed
- [ ] Legal terms finalized
- [ ] Incident response tested

# Payment System Setup Checklist

## Pre-Deployment

### Stripe Setup
- [ ] Create Stripe account
- [ ] Switch to production mode
- [ ] Configure webhook endpoint
- [ ] Set up subscription plans
- [ ] Configure tax settings
- [ ] Set up dispute handling

### Blockchain Setup
- [ ] Deploy HSK token to mainnet
- [ ] Fund treasury wallet
- [ ] Verify treasury has MINING_ROLE
- [ ] Set up multisig for large transfers
- [ ] Configure monitoring for treasury balance

### Database Setup
- [ ] Create PostgreSQL database
- [ ] Run migrations
- [ ] Seed credit packages
- [ ] Set up automated backups
- [ ] Configure connection pooling

### KYC Setup
- [ ] Choose KYC provider (SumSub/Onfido/Stripe)
- [ ] Complete provider onboarding
- [ ] Configure verification levels
- [ ] Set up webhook handling
- [ ] Test verification flow

### Security
- [ ] Generate strong JWT secret
- [ ] Configure SSL certificates
- [ ] Set up rate limiting
- [ ] Configure CORS
- [ ] Set up monitoring/alerting
- [ ] Enable database encryption

## Deployment

- [ ] Build Docker image
- [ ] Push to registry
- [ ] Deploy to production server
- [ ] Configure environment variables
- [ ] Run database migrations
- [ ] Start services
- [ ] Verify health checks pass
- [ ] Test webhook endpoints

## Post-Deployment Testing

### Stripe Testing
- [ ] Test successful payment
- [ ] Test failed payment
- [ ] Test subscription creation
- [ ] Test subscription cancellation
- [ ] Test refund
- [ ] Verify webhooks received

### Crypto Testing
- [ ] Test ETH payment
- [ ] Test USDC payment
- [ ] Verify confirmation flow
- [ ] Test expiration handling

### Credit System Testing
- [ ] Verify credit issuance
- [ ] Test credit balance queries
- [ ] Test reservation system
- [ ] Verify transaction history

### KYC Testing
- [ ] Test KYC initiation
- [ ] Test document upload
- [ ] Verify approval flow
- [ ] Test purchase restrictions

## Monitoring Setup

- [ ] Configure error tracking (Sentry)
- [ ] Set up log aggregation
- [ ] Configure uptime monitoring
- [ ] Set up payment success rate alerts
- [ ] Configure treasury balance alerts
- [ ] Set up database performance monitoring

## Documentation

- [ ] Update API documentation
- [ ] Document webhook handling
- [ ] Create troubleshooting guide
- [ ] Document refund policy
- [ ] Create KYC requirements doc

## Go-Live

- [ ] Final security audit
- [ ] Load testing
- [ ] Rollback plan verified
- [ ] Support team trained
- [ ] Announce to users
- [ ] Monitor first 24 hours closely
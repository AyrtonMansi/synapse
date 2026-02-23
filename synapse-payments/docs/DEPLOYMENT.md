# Production Deployment Guide

## Prerequisites

- Docker and Docker Compose
- Domain name with SSL certificate
- PostgreSQL database (AWS RDS, Google Cloud SQL, or managed)
- Redis instance (AWS ElastiCache, Redis Cloud, or self-hosted)
- Stripe account (production mode)
- Ethereum node access (Alchemy, Infura, or self-hosted)

## Step-by-Step Deployment

### 1. Infrastructure Setup

#### PostgreSQL Database
```sql
CREATE DATABASE synapse_payments;
CREATE USER synapse WITH PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE synapse_payments TO synapse;
```

#### Redis
Use managed Redis or deploy with Docker:
```bash
docker run -d --name synapse-redis \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --requirepass your_password
```

### 2. Environment Configuration

Create `.env.production`:

```env
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL="postgresql://synapse:strong_password@your-db-host:5432/synapse_payments?schema=public"

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Stripe (Production keys!)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Blockchain (Production)
TREASURY_PRIVATE_KEY=0x...
TREASURY_ADDRESS=0x...
HSK_TOKEN_ADDRESS=0x...
CHAIN_ID=1  # Ethereum mainnet

# RPC URLs (Use paid providers for production)
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# KYC
KYC_PROVIDER=stripe
KYC_SECRET_KEY=...

# Security
JWT_SECRET=use-a-random-256-bit-string-here

# Company
COMPANY_NAME="Synapse Network Inc."
COMPANY_TAX_ID=...
```

### 3. Deploy with Docker

```bash
# Build image
docker build -t synapse-payments:latest .

# Tag for registry
docker tag synapse-payments:latest your-registry/synapse-payments:latest

# Push to registry
docker push your-registry/synapse-payments:latest

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Database Migration

```bash
# Run migrations
docker-compose -f docker-compose.prod.yml exec payments npx prisma migrate deploy

# Seed initial data
docker-compose -f docker-compose.prod.yml exec payments npx tsx scripts/seed.ts
```

### 5. SSL/TLS Configuration

Use nginx or traefik as reverse proxy:

```nginx
server {
    listen 443 ssl http2;
    server_name payments.synapse.network;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6. Stripe Webhook Configuration

In Stripe Dashboard:
1. Go to Developers → Webhooks
2. Add endpoint: `https://payments.synapse.network/stripe/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `checkout.session.completed`

### 7. Monitoring Setup

#### Health Checks
```bash
# Add to your monitoring system
curl -f https://payments.synapse.network/health || alert
```

#### Logging
Configure log aggregation (Datadog, LogDNA, or CloudWatch):
```yaml
# docker-compose.prod.yml
logging:
  driver: awslogs
  options:
    awslogs-group: synapse-payments
    awslogs-region: us-east-1
```

### 8. Backup Strategy

#### Database
```bash
# Daily backups
0 2 * * * pg_dump synapse_payments > /backups/synapse_$(date +\%Y\%m\%d).sql
```

#### Treasury Wallet
- Store private key in AWS Secrets Manager or HashiCorp Vault
- Never commit to git
- Have backup keys in cold storage

## Security Checklist

- [ ] Use production Stripe keys
- [ ] Enable HTTPS only
- [ ] Set strong database password
- [ ] Configure firewall rules
- [ ] Enable database encryption at rest
- [ ] Set up log monitoring
- [ ] Configure rate limiting
- [ ] Enable 2FA for admin access
- [ ] Regular security audits
- [ ] DDoS protection (CloudFlare)

## Troubleshooting

### Webhook Not Receiving
1. Check webhook URL is accessible
2. Verify webhook secret is correct
3. Check logs for signature verification errors

### Treasury Balance Low
1. Check treasury wallet has ETH for gas
2. Monitor HSK token balance
3. Set up alerts for low balance

### Database Connection Issues
1. Verify connection string
2. Check security group rules
3. Ensure SSL is configured

## Rollback Procedure

```bash
# If deployment fails
docker-compose -f docker-compose.prod.yml down
docker pull your-registry/synapse-payments:previous-tag
docker-compose -f docker-compose.prod.yml up -d
```

## Support

For deployment issues:
- Check logs: `docker-compose logs -f payments`
- Health endpoint: `https://payments.synapse.network/health`
- Emergency contact: admin@synapse.network
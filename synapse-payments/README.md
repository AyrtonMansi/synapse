# Synapse Payment Service

Hybrid fiat/crypto payment system for the Synapse Network. Enables seamless purchasing of API credits through Stripe (credit cards) or cryptocurrency (ETH, USDC, USDT, HSK).

## 🎯 Features

### 1. Stripe Integration
- ✅ One-time credit purchases
- ✅ Monthly/annual subscriptions
- ✅ Automatic payment confirmation
- ✅ Full/partial refunds
- ✅ Webhook handling

### 2. Fiat → HSK Bridge
- 💱 $1 = 1,000 API credits (configurable)
- 🔒 Treasury-managed HSK reserves
- ⚡ Instant credit issuance on payment confirmation
- 📊 Real-time balance tracking

### 3. Crypto Payments
- 🔗 ETH, USDC, USDT, HSK support
- 🌐 Ethereum, Polygon, Base networks
- 📱 QR code generation for easy payment
- ⏱️ 30-minute payment windows
- 🔍 Automatic transaction monitoring

### 4. KYC & Compliance
- 🆔 Identity verification (SumSub, Onfido, Stripe Identity)
- 🚦 Configurable KYC thresholds
- 📄 PDF receipt generation
- 📊 Tax reporting exports

### 5. Credit Management
- 💳 Real-time balance tracking
- 🔒 Credit reservation system (for API calls)
- 📈 Transaction history
- 🎁 Bonus credits for larger purchases

## 🚀 Quick Start

```bash
# Clone and install
cd synapse-payments
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Setup database
npx prisma migrate dev
npx prisma generate

# Run development server
npm run dev

# Or use Docker
docker-compose up -d
```

## 📚 Documentation

- [Integration Guide](./docs/INTEGRATION.md) - Full API documentation
- [Architecture](./docs/ARCHITECTURE.md) - System design details
- [Deployment](./docs/DEPLOYMENT.md) - Production deployment guide

## 🔌 API Endpoints

### Public (No Auth)
- `GET /health` - Health check
- `GET /stripe/config` - Stripe publishable key
- `POST /stripe/create-payment-intent` - Create payment
- `POST /stripe/create-checkout-session` - Create checkout
- `POST /stripe/webhook` - Stripe webhooks
- `GET /crypto/networks` - Supported networks
- `POST /crypto/create-session` - Create crypto payment

### Protected (Requires Auth)
- `GET /credits/balance` - Get credit balance
- `GET /credits/transactions` - Transaction history
- `GET /credits/packages` - Available packages
- `POST /credits/reserve` - Reserve credits
- `GET /payments/history` - Payment history
- `POST /payments/:id/refund` - Request refund
- `GET /subscriptions/plans` - Subscription plans
- `POST /subscriptions/create` - Create subscription
- `GET /kyc/status` - KYC status
- `POST /kyc/start` - Start KYC
- `GET /receipts` - Get receipts
- `POST /receipts/generate` - Generate receipt

### Admin
- `GET /admin/stats` - System statistics
- `GET /admin/payments` - All payments
- `POST /admin/refund` - Process refund
- `POST /admin/credits/adjust` - Adjust credits
- `GET /admin/kyc/pending` - Pending KYC
- `GET /admin/treasury` - Treasury status

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Synapse Payment Service                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   │
│  │   Stripe    │   │   Crypto    │   │    KYC      │   │
│  │   Service   │   │   Service   │   │   Service   │   │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   │
│         │                 │                  │          │
│         └─────────────────┼──────────────────┘          │
│                           ▼                             │
│                  ┌─────────────────┐                    │
│                  │  Credit Service │                    │
│                  └────────┬────────┘                    │
│                           ▼                             │
│                  ┌─────────────────┐                    │
│                  │ Treasury Service│                    │
│                  │  (HSK Bridge)   │                    │
│                  └─────────────────┘                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              ┌──────────┐        ┌──────────┐
              │  PostgreSQL      │  Redis    │
              └──────────┘        └──────────┘
```

## 💳 Credit Packages

| Package | Credits | Price | Bonus | Best For |
|---------|---------|-------|-------|----------|
| Starter | 10,000 | $10 | - | Trying Synapse |
| Growth | 55,000 | $45 | 5,000 | Small projects |
| Pro | 240,000 | $160 | 40,000 | Serious devs |
| Enterprise | 1,300,000 | $700 | 300,000 | Large teams |

**Subscription Plans:**
- Basic: 50,000 credits/month - $39/month
- Pro: 200,000 credits/month - $149/month
- Enterprise: 1,000,000 credits/month - $599/month

## 🔐 Environment Variables

```env
# Required
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
TREASURY_PRIVATE_KEY=0x...
HSK_TOKEN_ADDRESS=0x...
DATABASE_URL=postgresql://...
JWT_SECRET=...

# Optional
KYC_PROVIDER=stripe
KYC_API_KEY=...
REDIS_HOST=localhost
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Stripe CLI for webhooks
stripe listen --forward-to localhost:3001/stripe/webhook
```

## 🐳 Docker

```bash
# Build
docker build -t synapse-payments .

# Run
docker run -p 3001:3001 --env-file .env synapse-payments

# Or use compose
docker-compose up -d
```

## 📈 Monitoring

Health check endpoint:
```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "services": {
    "database": true,
    "redis": true,
    "stripe": true,
    "treasury": true
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - see LICENSE file

## 🆘 Support

- Discord: [Synapse Network](https://discord.gg/synapse)
- Email: support@synapse.network
- Docs: https://docs.synapse.network
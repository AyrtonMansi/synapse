# Synapse Payment Service - Integration Guide

## Overview

The Synapse Payment Service is a hybrid fiat/crypto payment system that seamlessly bridges traditional payment methods (Stripe) with blockchain-based HSK tokens.

**Key Features:**
- **Stripe Integration**: Credit card payments, subscriptions, refunds
- **Crypto Payments**: Pay with ETH, USDC, USDT, or HSK
- **Fiat → HSK Bridge**: Automatic credit conversion ($1 = 1,000 credits)
- **KYC Compliance**: Built-in identity verification
- **Receipt Generation**: PDF receipts and tax reports

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Synapse Payment Service                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Stripe     │  │    Crypto    │  │     KYC      │          │
│  │  Payments    │  │  Payments    │  │ Verification │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            ▼                                     │
│                   ┌─────────────────┐                           │
│                   │  Fiat → HSK     │                           │
│                   │  Bridge         │                           │
│                   │  (Treasury)     │                           │
│                   └────────┬────────┘                           │
│                            ▼                                     │
│                   ┌─────────────────┐                           │
│                   │  Credit Balance │                           │
│                   │  & Usage        │                           │
│                   └─────────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Synapse API    │
                    │  Gateway        │
                    └─────────────────┘
```

## Quick Start

### 1. Environment Setup

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required environment variables:
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `TREASURY_PRIVATE_KEY` - Private key for treasury wallet
- `HSK_TOKEN_ADDRESS` - HSK token contract address
- `DATABASE_URL` - PostgreSQL connection string

### 2. Database Setup

```bash
npx prisma migrate dev
npx prisma generate
```

### 3. Start the Service

```bash
# Development
npm run dev

# Production
npm run build
npm start

# Or use Docker
docker-compose up -d
```

### 4. Configure Stripe Webhooks

For local development:
```bash
stripe login
stripe listen --forward-to localhost:3001/stripe/webhook
```

For production, configure webhook endpoint in Stripe Dashboard:
- URL: `https://your-domain.com/stripe/webhook`
- Events: `payment_intent.succeeded`, `invoice.payment_succeeded`, etc.

## API Integration

### Authentication

All protected endpoints require a Bearer token:

```http
Authorization: Bearer <jwt_token>
```

### 1. Credit Card Payments

#### Create Payment Intent

```typescript
// Frontend
const response = await fetch('/stripe/create-payment-intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_123',
    email: 'user@example.com',
    packageId: 'growth',
  }),
});

const { clientSecret } = await response.json();

// Use with Stripe.js
const { error } = await stripe.confirmCardPayment(clientSecret);
```

#### Checkout Session (Redirect Flow)

```typescript
const response = await fetch('/stripe/create-checkout-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_123',
    email: 'user@example.com',
    packageId: 'pro',
    successUrl: 'https://your-app.com/success',
    cancelUrl: 'https://your-app.com/cancel',
  }),
});

const { url } = await response.json();
window.location.href = url;
```

### 2. Crypto Payments

#### Create Crypto Payment Session

```typescript
const response = await fetch('/crypto/create-session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>',
  },
  body: JSON.stringify({
    amountUsd: 100,
    token: 'ETH',
    chainId: 1,
  }),
});

const { sessionId, paymentAddress, requiredAmount } = await response.json();

// Display QR code and address to user
// User sends payment to address
// Webhook confirms payment
```

#### Check Payment Status

```typescript
const checkStatus = async (sessionId: string) => {
  const response = await fetch(`/crypto/session/${sessionId}`);
  const { status, txHash } = await response.json();
  
  if (status === 'paid') {
    console.log('Payment confirmed!');
  }
};
```

### 3. Credit Balance Management

#### Get Balance

```typescript
const response = await fetch('/credits/balance', {
  headers: { 'Authorization': 'Bearer <token>' },
});

const { totalCredits, availableCredits } = await response.json();
```

#### Reserve Credits for API Call

```typescript
const response = await fetch('/credits/reserve', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>',
  },
  body: JSON.stringify({
    amount: 100,
    operationId: 'job_123',
  }),
});

const { reservationId } = await response.json();

// After API call completes:
await fetch('/credits/spend', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reservationId,
    description: 'AI inference job',
    jobId: 'job_123',
  }),
});
```

### 4. KYC Verification

#### Start Verification

```typescript
const response = await fetch('/kyc/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>',
  },
  body: JSON.stringify({ level: 'standard' }),
});

const { redirectUrl } = await response.json();
window.location.href = redirectUrl;
```

#### Check KYC Status

```typescript
const response = await fetch('/kyc/status', {
  headers: { 'Authorization': 'Bearer <token>' },
});

const { status, level } = await response.json();
```

### 5. Subscriptions

#### Get Plans

```typescript
const response = await fetch('/subscriptions/plans');
const plans = await response.json();
```

#### Subscribe

```typescript
const response = await fetch('/subscriptions/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>',
  },
  body: JSON.stringify({
    planId: 'pro-monthly',
    paymentMethodId: 'pm_123', // Stripe payment method
  }),
});
```

### 6. Receipts

#### Generate Receipt

```typescript
const response = await fetch('/receipts/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>',
  },
  body: JSON.stringify({ paymentId: 'pay_123' }),
});

const { pdfUrl } = await response.json();
```

## Frontend UI Toggle

Implement a simple toggle for payment methods:

```tsx
function PaymentMethodToggle({ onSelect }: { onSelect: (method: 'card' | 'crypto') => void }) {
  const [method, setMethod] = useState<'card' | 'crypto'>('card');

  return (
    <div className="payment-toggle">
      <button
        className={method === 'card' ? 'active' : ''}
        onClick={() => { setMethod('card'); onSelect('card'); }}
      >
        💳 Pay with Card
      </button>
      <button
        className={method === 'crypto' ? 'active' : ''}
        onClick={() => { setMethod('crypto'); onSelect('crypto'); }}
      >
        🪙 Pay with Crypto
      </button>
    </div>
  );
}
```

## API Gateway Integration

To integrate with the existing Synapse API Gateway:

### 1. Credit Check Middleware

Add to API Gateway to validate credits before processing jobs:

```typescript
// In api-gateway/src/middleware/creditCheck.ts
import { creditService } from '@synapse/payments';

export async function requireCredits(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.user!.id;
  const estimatedCost = estimateJobCost(req.body);
  
  const hasCredits = await creditService.hasSufficientCredits(userId, estimatedCost);
  
  if (!hasCredits) {
    return res.status(402).json({
      error: 'Insufficient credits',
      checkoutUrl: '/billing',
    });
  }
  
  // Reserve credits
  const { reservationId } = await creditService.reserveCredits(
    userId, 
    estimatedCost, 
    req.requestId
  );
  
  req.creditReservationId = reservationId;
  next();
}
```

### 2. Credit Deduction After Job

```typescript
// After job completion
await creditService.commitReservation(
  req.creditReservationId,
  `Job ${jobId}`,
  jobId
);
```

## Configuration Options

### Credit Rates

Modify in `src/services/credit.ts`:

```typescript
const config = {
  creditsPerUsd: 1000,        // 1000 credits per $1
  kycThreshold: 1000,         // $1000 requires KYC
  maxPurchaseWithoutKyc: 500, // $500 max without KYC
};
```

### Supported Crypto Networks

Modify in `src/services/cryptoPayment.ts`:

```typescript
const supportedNetworks = [
  { chainId: 1, name: 'Ethereum', tokens: ['ETH', 'USDC', 'USDT'] },
  { chainId: 137, name: 'Polygon', tokens: ['MATIC', 'USDC'] },
  { chainId: 8453, name: 'Base', tokens: ['ETH', 'USDC'] },
];
```

## Testing

### Run Tests

```bash
npm test
```

### Stripe Test Cards

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

### Crypto Testing

Use Sepolia testnet for development:
- Get test ETH from [Sepolia Faucet](https://sepoliafaucet.com/)
- Set `CHAIN_ID=11155111` in `.env`

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use production Stripe keys
- [ ] Configure production RPC URLs
- [ ] Set up S3 for receipt storage
- [ ] Configure SSL/TLS
- [ ] Set up monitoring (health checks)
- [ ] Configure backups for database
- [ ] Set up Stripe webhook endpoint

### Docker Deployment

```bash
# Build and push
docker build -t synapse-payments:latest .
docker push your-registry/synapse-payments:latest

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## Support

For issues or questions:
- Discord: [Synapse Network](https://discord.gg/synapse)
- Email: support@synapse.network
- Docs: https://docs.synapse.network
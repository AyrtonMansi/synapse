# Architecture Overview

## System Design

### Core Components

#### 1. Stripe Service (`src/services/stripe.ts`)
- **Purpose**: Handle all Stripe-related operations
- **Key Methods**:
  - `createPaymentIntent()` - One-time payments
  - `createSubscription()` - Recurring subscriptions
  - `processRefund()` - Handle refunds
  - `handleWebhookEvent()` - Process Stripe webhooks
- **Events Handled**:
  - `payment_intent.succeeded` - Issue credits
  - `invoice.payment_succeeded` - Subscription renewal
  - `customer.subscription.deleted` - Cancel subscription

#### 2. Treasury Service (`src/services/treasury.ts`)
- **Purpose**: Bridge fiat payments to HSK tokens
- **Key Methods**:
  - `mintCredits()` - Issue HSK for fiat payment
  - `deductCredits()` - Handle refunds/adjustments
  - `getUserCreditBalance()` - Check user balance
  - `reserveCredits()` - Lock credits for pending operations
- **On-Chain Operations**:
  - Transfer HSK from treasury to user
  - Monitor treasury balance
  - Emergency operations

#### 3. Crypto Payment Service (`src/services/cryptoPayment.ts`)
- **Purpose**: Accept crypto payments
- **Key Methods**:
  - `createPaymentSession()` - Generate payment address
  - `monitorPayment()` - Watch for incoming transactions
  - `verifyPayment()` - Confirm payment received
- **Supported Networks**:
  - Ethereum Mainnet (1)
  - Polygon (137)
  - Base (8453)
  - Sepolia Testnet (11155111)

#### 4. Credit Service (`src/services/credit.ts`)
- **Purpose**: Manage credit balances and transactions
- **Key Methods**:
  - `getBalance()` - Get user's credit balance
  - `addCredits()` - Add credits (purchase/bonus)
  - `deductCredits()` - Deduct credits (usage)
  - `reserveCredits()` - Reserve for pending operations
- **Features**:
  - Redis caching for performance
  - Transaction history
  - KYC validation

#### 5. KYC Service (`src/services/kyc.ts`)
- **Purpose**: Identity verification
- **Providers**: SumSub, Onfido, Stripe Identity
- **Levels**: Basic, Standard, Enhanced
- **Triggers**:
  - Purchases over $500 (single)
  - Lifetime purchases over $1000

#### 6. Receipt Service (`src/services/receipt.ts`)
- **Purpose**: Generate receipts and tax reports
- **Output**: PDF receipts, CSV tax reports
- **Storage**: S3 (production), local (development)

### Data Flow

#### Credit Card Payment Flow

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  User   │───▶│    Stripe    │───▶│   Webhook    │───▶│   Treasury   │
│         │    │   Payment    │    │   Handler    │    │   Service    │
└─────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                              │
                                                              ▼
                                                       ┌──────────────┐
                                                       │  Issue HSK   │
                                                       │   Credits    │
                                                       └──────────────┘
```

#### Crypto Payment Flow

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  User   │───▶│   Create     │───▶│  Send Crypto │───▶│   Monitor    │
│         │    │   Session    │    │   to Address │    │  Blockchain  │
└─────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                              │
                                                              ▼
                                                       ┌──────────────┐
                                                       │  Confirm &   │
                                                       │  Issue HSK   │
                                                       └──────────────┘
```

#### API Credit Usage Flow

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  API    │───▶│   Reserve    │───▶│  Process Job │───▶│   Confirm    │
│  Request│    │   Credits    │    │              │    │   Usage      │
└─────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

## Security Considerations

### 1. Webhook Security
- Stripe webhooks verified with signature
- KYC webhooks verified with secret
- Idempotency keys for duplicate prevention

### 2. Treasury Security
- Private key stored securely (AWS Secrets Manager / env)
- Multi-sig for large transfers (production)
- Emergency withdrawal capability

### 3. Credit Validation
- KYC checks before large purchases
- Rate limiting on all endpoints
- Request authentication required

### 4. Database Security
- Connection encryption (TLS)
- Row-level security (optional)
- Regular backups

## Scaling Considerations

### 1. Database
- Read replicas for query scaling
- Connection pooling (Prisma)
- Sharding for high volume (future)

### 2. Caching
- Redis for credit balance caching
- Rate limiting storage
- Session state

### 3. Blockchain
- Load balanced RPC endpoints
- WebSocket subscriptions for events
- Queue for processing transactions

## Monitoring

### Key Metrics
- Payment success rate
- Credit issuance latency
- Treasury balance
- KYC verification rate
- Refund rate

### Alerts
- Treasury balance low
- High failure rate
- Webhook processing errors
- Database connection issues
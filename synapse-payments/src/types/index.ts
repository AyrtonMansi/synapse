/**
 * Synapse Payment System - Type Definitions
 * 
 * @module synapse-payments/types
 * @description Core type definitions for the hybrid payment system
 */

// ============================================================================
// USER & AUTHENTICATION TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  walletAddress?: string;
  stripeCustomerId?: string;
  kycStatus: KycStatus;
  kycVerifiedAt?: Date;
  tier: UserTier;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected';

export type UserTier = 'free' | 'basic' | 'pro' | 'enterprise';

export interface AuthenticatedRequest extends Request {
  user?: User;
  requestId: string;
  startTime: number;
}

// ============================================================================
// PAYMENT TYPES
// ============================================================================

export type PaymentMethod = 'stripe' | 'crypto' | 'credits';

export type PaymentStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled';

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  cryptoTxHash?: string;
  creditsPurchased: number;
  creditsRate: number; // Credits per USD
  metadata: Record<string, any>;
  receiptUrl?: string;
  refundedAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CREDIT PACKAGE TYPES
// ============================================================================

export interface CreditPackage {
  id: string;
  name: string;
  description: string;
  credits: number;
  priceUsd: number;
  bonusCredits: number;
  tier: UserTier;
  isPopular: boolean;
  isSubscription: boolean;
  stripePriceId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for trying out Synapse',
    credits: 10000,
    priceUsd: 10,
    bonusCredits: 0,
    tier: 'free',
    isPopular: false,
    isSubscription: false,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'Best for small projects',
    credits: 50000,
    priceUsd: 45,
    bonusCredits: 5000,
    tier: 'basic',
    isPopular: true,
    isSubscription: false,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For serious developers',
    credits: 200000,
    priceUsd: 160,
    bonusCredits: 40000,
    tier: 'pro',
    isPopular: false,
    isSubscription: false,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for large teams',
    credits: 1000000,
    priceUsd: 700,
    bonusCredits: 300000,
    tier: 'enterprise',
    isPopular: false,
    isSubscription: false,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ============================================================================
// SUBSCRIPTION TYPES
// ============================================================================

export type SubscriptionStatus = 
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  tier: UserTier;
  creditsPerPeriod: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  tier: UserTier;
  monthlyCredits: number;
  priceUsd: number;
  stripePriceId: string;
  features: string[];
  isActive: boolean;
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface StripeWebhookEvent {
  id: string;
  object: 'event';
  api_version: string;
  created: number;
  data: {
    object: any;
  };
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string | null;
    idempotency_key: string | null;
  };
  type: StripeWebhookType;
}

export type StripeWebhookType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.canceled'
  | 'charge.succeeded'
  | 'charge.failed'
  | 'charge.refunded'
  | 'charge.dispute.created'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'invoice.finalized'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.trial_will_end'
  | 'checkout.session.completed'
  | 'checkout.session.expired';

// ============================================================================
// CREDIT BALANCE TYPES
// ============================================================================

export interface CreditBalance {
  userId: string;
  totalCredits: number;
  availableCredits: number;
  reservedCredits: number;
  lifetimePurchased: number;
  lifetimeUsed: number;
  lastPurchaseAt?: Date;
  updatedAt: Date;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  paymentId?: string;
  jobId?: string;
  description: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export type CreditTransactionType = 
  | 'purchase'
  | 'usage'
  | 'refund'
  | 'bonus'
  | 'subscription'
  | 'adjustment'
  | 'promo';

// ============================================================================
// KYC TYPES
// ============================================================================

export interface KycVerification {
  id: string;
  userId: string;
  provider: 'sumsub' | 'onfido' | 'stripe';
  providerApplicantId?: string;
  status: KycStatus;
  level: KycLevel;
  submittedAt?: Date;
  reviewedAt?: Date;
  rejectedReason?: string;
  documents: KycDocument[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type KycLevel = 'basic' | 'standard' | 'enhanced';

export interface KycDocument {
  id: string;
  type: 'passport' | 'id_card' | 'driving_license' | 'proof_of_address' | 'selfie';
  country: string;
  status: 'pending' | 'verified' | 'rejected';
  uploadedAt: Date;
  verifiedAt?: Date;
  rejectionReason?: string;
}

// ============================================================================
// RECEIPT TYPES
// ============================================================================

export interface Receipt {
  id: string;
  paymentId: string;
  userId: string;
  receiptNumber: string;
  issuedAt: Date;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  billingAddress?: Address;
  pdfUrl?: string;
  metadata: Record<string, any>;
}

export interface ReceiptItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

// ============================================================================
// TAX REPORTING TYPES
// ============================================================================

export interface TaxReport {
  id: string;
  userId: string;
  year: number;
  quarter?: number;
  totalRevenue: number;
  totalRefunds: number;
  totalTaxCollected: number;
  transactions: TaxTransaction[];
  generatedAt: Date;
  pdfUrl?: string;
  csvUrl?: string;
}

export interface TaxTransaction {
  date: Date;
  type: 'sale' | 'refund';
  amount: number;
  tax: number;
  currency: string;
  country: string;
  taxRate: number;
}

// ============================================================================
// CRYPTO PAYMENT TYPES
// ============================================================================

export interface CryptoPaymentSession {
  id: string;
  userId: string;
  amountUsd: number;
  creditsToReceive: number;
  paymentAddress: string;
  requiredAmount: string; // in wei/token units
  token: 'ETH' | 'USDC' | 'USDT' | 'HSK';
  chainId: number;
  expiryTime: Date;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  txHash?: string;
  confirmedAt?: Date;
  createdAt: Date;
}

export interface TreasuryWallet {
  id: string;
  address: string;
  chainId: number;
  token: string;
  balance: string;
  pendingIncoming: string;
  lastUpdated: Date;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  durationMs: number;
  version: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface PaymentConfig {
  stripe: {
    secretKey: string;
    webhookSecret: string;
    publishableKey: string;
  };
  crypto: {
    treasuryPrivateKey: string;
    rpcUrls: Record<number, string>;
    chainIds: number[];
    acceptedTokens: string[];
  };
  credits: {
    ratePerUsd: number; // 1000 = 1000 credits per $1
    kycThreshold: number; // USD amount requiring KYC
    maxPurchaseWithoutKyc: number;
  };
  kyc: {
    provider: 'sumsub' | 'onfido' | 'stripe';
    apiKey: string;
    secretKey: string;
  };
}
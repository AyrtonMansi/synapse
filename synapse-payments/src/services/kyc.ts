/**
 * KYC Service
 * 
 * @module synapse-payments/services/kyc
 * @description Handles KYC verification using SumSub, Onfido, or Stripe Identity
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { logger } from '../index';
import type { KycVerification, KycStatus, KycLevel, KycDocument } from '../types';

export interface KycConfig {
  provider: 'sumsub' | 'onfido' | 'stripe';
  apiKey: string;
  secretKey: string;
  webhookSecret?: string;
}

export class KycService {
  private config: KycConfig;
  private prisma: PrismaClient;
  private apiClient: any;

  constructor(config: KycConfig, prisma: PrismaClient) {
    this.config = config;
    this.prisma = prisma;
    this.initializeClient();
  }

  private initializeClient(): void {
    switch (this.config.provider) {
      case 'sumsub':
        this.apiClient = axios.create({
          baseURL: 'https://api.sumsub.com',
          headers: {
            'Authorization': `Bearer ${this.config.secretKey}`,
            'Content-Type': 'application/json',
          },
        });
        break;
      case 'onfido':
        this.apiClient = axios.create({
          baseURL: 'https://api.onfido.com/v3.5',
          headers: {
            'Authorization': `Token token=${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        break;
      case 'stripe':
        this.apiClient = axios.create({
          baseURL: 'https://api.stripe.com/v1',
          headers: {
            'Authorization': `Bearer ${this.config.secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        break;
    }
  }

  /**
   * Create a KYC verification session for a user
   */
  async createVerification(
    userId: string,
    level: KycLevel = 'standard'
  ): Promise<{ verificationId: string; redirectUrl: string }> {
    // Check if user already has a pending verification
    const existing = await this.prisma.kycVerification.findFirst({
      where: {
        userId,
        status: { in: ['none', 'pending'] },
      },
    });

    if (existing && existing.status === 'pending') {
      // Return existing session
      return {
        verificationId: existing.id,
        redirectUrl: await this.getVerificationUrl(existing.providerApplicantId!),
      };
    }

    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    let providerApplicantId: string;
    let redirectUrl: string;

    switch (this.config.provider) {
      case 'sumsub':
        const sumsubResult = await this.createSumSubApplicant(userId, user.email, level);
        providerApplicantId = sumsubResult.applicantId;
        redirectUrl = sumsubResult.redirectUrl;
        break;
      case 'onfido':
        const onfidoResult = await this.createOnfidoApplicant(userId, user.email, level);
        providerApplicantId = onfidoResult.applicantId;
        redirectUrl = onfidoResult.redirectUrl;
        break;
      case 'stripe':
        const stripeResult = await this.createStripeVerification(userId, user.email, level);
        providerApplicantId = stripeResult.verificationSessionId;
        redirectUrl = stripeResult.redirectUrl;
        break;
      default:
        throw new Error('Unsupported KYC provider');
    }

    // Create verification record
    const verification = await this.prisma.kycVerification.create({
      data: {
        userId,
        provider: this.config.provider,
        providerApplicantId,
        status: 'pending',
        level,
        submittedAt: new Date(),
        documents: [],
      },
    });

    // Update user KYC status
    await this.prisma.user.update({
      where: { id: userId },
      data: { kycStatus: 'pending' },
    });

    logger.info('Created KYC verification', {
      userId,
      verificationId: verification.id,
      provider: this.config.provider,
      level,
    });

    return {
      verificationId: verification.id,
      redirectUrl,
    };
  }

  /**
   * Get verification status
   */
  async getVerification(verificationId: string): Promise<KycVerification | null> {
    const verification = await this.prisma.kycVerification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) return null;

    return {
      id: verification.id,
      userId: verification.userId,
      provider: verification.provider as any,
      providerApplicantId: verification.providerApplicantId || undefined,
      status: verification.status as KycStatus,
      level: verification.level as KycLevel,
      submittedAt: verification.submittedAt || undefined,
      reviewedAt: verification.reviewedAt || undefined,
      rejectedReason: verification.rejectedReason || undefined,
      documents: (verification.documents as KycDocument[]) || [],
      metadata: (verification.metadata as Record<string, any>) || {},
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
    };
  }

  /**
   * Get user's verification status
   */
  async getUserVerificationStatus(userId: string): Promise<{
    status: KycStatus;
    level?: KycLevel;
    verifiedAt?: Date;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        kycVerifications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const latestVerification = user.kycVerifications[0];

    return {
      status: user.kycStatus as KycStatus,
      level: latestVerification?.level as KycLevel,
      verifiedAt: user.kycVerifiedAt || undefined,
    };
  }

  /**
   * Handle webhook from KYC provider
   */
  async handleWebhook(payload: any, signature?: string): Promise<void> {
    // Verify signature if provided
    if (signature && this.config.webhookSecret) {
      const isValid = this.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }
    }

    switch (this.config.provider) {
      case 'sumsub':
        await this.handleSumSubWebhook(payload);
        break;
      case 'onfido':
        await this.handleOnfidoWebhook(payload);
        break;
      case 'stripe':
        await this.handleStripeWebhook(payload);
        break;
    }
  }

  /**
   * Admin: Approve verification manually
   */
  async approveVerification(
    verificationId: string,
    adminId: string
  ): Promise<void> {
    const verification = await this.prisma.kycVerification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new Error('Verification not found');
    }

    await this.updateVerificationStatus(verificationId, 'verified');

    logger.info('KYC verification manually approved', {
      verificationId,
      adminId,
      userId: verification.userId,
    });
  }

  /**
   * Admin: Reject verification
   */
  async rejectVerification(
    verificationId: string,
    reason: string,
    adminId: string
  ): Promise<void> {
    const verification = await this.prisma.kycVerification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new Error('Verification not found');
    }

    await this.prisma.kycVerification.update({
      where: { id: verificationId },
      data: {
        status: 'rejected',
        rejectedReason: reason,
        reviewedAt: new Date(),
      },
    });

    await this.prisma.user.update({
      where: { id: verification.userId },
      data: { kycStatus: 'rejected' },
    });

    logger.info('KYC verification rejected', {
      verificationId,
      adminId,
      userId: verification.userId,
      reason,
    });
  }

  // ============================================================================
  // PROVIDER-SPECIFIC METHODS
  // ============================================================================

  private async createSumSubApplicant(
    userId: string,
    email: string,
    level: KycLevel
  ): Promise<{ applicantId: string; redirectUrl: string }> {
    const levelName = level === 'basic' ? 'basic-kyc-level' : 
                      level === 'enhanced' ? 'enhanced-kyc-level' : 
                      'standard-kyc-level';

    const response = await this.apiClient.post('/resources/applicants', {
      externalUserId: userId,
      email,
      fixedInfo: {
        country: 'USA', // Default, can be changed
      },
    }, {
      params: { levelName },
    });

    const applicantId = response.data.id;

    // Generate SDK token for web integration
    const tokenResponse = await this.apiClient.post(
      `/resources/accessTokens?userId=${applicantId}&levelName=${levelName}&ttlInSecs=600`
    );

    const sdkToken = tokenResponse.data.token;
    const redirectUrl = `https://api.sumsub.com/websdk/prepopulate?token=${sdkToken}`;

    return { applicantId, redirectUrl };
  }

  private async createOnfidoApplicant(
    userId: string,
    email: string,
    level: KycLevel
  ): Promise<{ applicantId: string; redirectUrl: string }> {
    const response = await this.apiClient.post('/applicants', {
      external_id: userId,
      email,
    });

    const applicantId = response.data.id;

    // Create check
    const checkResponse = await this.apiClient.post('/checks', {
      applicant_id: applicantId,
      report_names: ['document', 'facial_similarity_photo'],
    });

    // Generate SDK token
    const sdkTokenResponse = await this.apiClient.post('/sdk_token', {
      applicant_id: applicantId,
      referrer: '*://*/*',
    });

    const redirectUrl = `https://id.onfido.com/?token=${sdkTokenResponse.data.token}`;

    return { applicantId, redirectUrl };
  }

  private async createStripeVerification(
    userId: string,
    email: string,
    level: KycLevel
  ): Promise<{ verificationSessionId: string; redirectUrl: string }> {
    const response = await this.apiClient.post('/identity/verification_sessions', {
      type: 'document',
      metadata: {
        user_id: userId,
      },
      options: {
        document: {
          allowed_types: ['passport', 'driving_license', 'id_card'],
          require_id_number: level === 'enhanced',
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
    });

    const verificationSessionId = response.data.id;
    const redirectUrl = response.data.url;

    return { verificationSessionId, redirectUrl };
  }

  private async getVerificationUrl(applicantId: string): Promise<string> {
    // Regenerate URL for existing applicant
    switch (this.config.provider) {
      case 'sumsub':
        const tokenResponse = await this.apiClient.post(
          `/resources/accessTokens?userId=${applicantId}&ttlInSecs=600`
        );
        return `https://api.sumsub.com/websdk/prepopulate?token=${tokenResponse.data.token}`;
      case 'stripe':
        const response = await this.apiClient.get(`/identity/verification_sessions/${applicantId}`);
        return response.data.url;
      default:
        return '';
    }
  }

  private verifyWebhookSignature(payload: any, signature: string): boolean {
    // Implementation depends on provider
    // SumSub, Onfido, and Stripe all have different signature verification methods
    return true; // Placeholder
  }

  private async handleSumSubWebhook(payload: any): Promise<void> {
    const { externalUserId, reviewStatus, reviewResult } = payload;

    if (reviewStatus === 'completed') {
      const status = reviewResult.reviewAnswer === 'GREEN' ? 'verified' : 'rejected';
      await this.updateVerificationStatusByUserId(externalUserId, status, reviewResult);
    }
  }

  private async handleOnfidoWebhook(payload: any): Promise<void> {
    const { payload: eventPayload } = payload;
    
    if (eventPayload.action === 'check.completed') {
      const applicantId = eventPayload.object.applicant_id;
      const result = eventPayload.object.result;
      
      const status = result === 'clear' ? 'verified' : 'rejected';
      await this.updateVerificationStatusByApplicantId(applicantId, status);
    }
  }

  private async handleStripeWebhook(payload: any): Promise<void> {
    const { type, data } = payload;

    if (type === 'identity.verification_session.verified') {
      const userId = data.object.metadata.user_id;
      await this.updateVerificationStatusByUserId(userId, 'verified');
    } else if (type === 'identity.verification_session.canceled') {
      const userId = data.object.metadata.user_id;
      await this.updateVerificationStatusByUserId(userId, 'rejected');
    }
  }

  private async updateVerificationStatus(
    verificationId: string,
    status: KycStatus,
    metadata?: any
  ): Promise<void> {
    const verification = await this.prisma.kycVerification.update({
      where: { id: verificationId },
      data: {
        status,
        reviewedAt: new Date(),
        metadata: metadata ? { ...metadata } : undefined,
      },
    });

    await this.prisma.user.update({
      where: { id: verification.userId },
      data: {
        kycStatus: status,
        kycVerifiedAt: status === 'verified' ? new Date() : null,
      },
    });

    logger.info('KYC verification status updated', {
      verificationId,
      userId: verification.userId,
      status,
    });
  }

  private async updateVerificationStatusByUserId(
    userId: string,
    status: KycStatus,
    metadata?: any
  ): Promise<void> {
    const verification = await this.prisma.kycVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (verification) {
      await this.updateVerificationStatus(verification.id, status, metadata);
    }
  }

  private async updateVerificationStatusByApplicantId(
    applicantId: string,
    status: KycStatus
  ): Promise<void> {
    const verification = await this.prisma.kycVerification.findFirst({
      where: { providerApplicantId: applicantId },
    });

    if (verification) {
      await this.updateVerificationStatus(verification.id, status);
    }
  }
}
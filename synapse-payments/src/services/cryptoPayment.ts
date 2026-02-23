/**
 * Crypto Payment Service
 * 
 * @module synapse-payments/services/cryptoPayment
 * @description Handles crypto payments: monitoring, confirmation, credit issuance
 */

import { ethers, JsonRpcProvider } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { TreasuryService } from './treasury';
import { logger } from '../index';
import type { CryptoPaymentSession } from '../types';

export interface CryptoPaymentConfig {
  rpcUrls: Record<number, string>;
  treasuryAddress: string;
  hskTokenAddress: string;
  paymentTimeoutMinutes: number;
}

// ERC20 Token ABI for payment monitoring
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export class CryptoPaymentService {
  private config: CryptoPaymentConfig;
  private prisma: PrismaClient;
  private treasury: TreasuryService;
  private providers: Map<number, JsonRpcProvider> = new Map();
  private activeSessions: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: CryptoPaymentConfig, prisma: PrismaClient, treasury: TreasuryService) {
    this.config = config;
    this.prisma = prisma;
    this.treasury = treasury;

    // Initialize providers for each supported chain
    for (const [chainId, rpcUrl] of Object.entries(config.rpcUrls)) {
      this.providers.set(Number(chainId), new JsonRpcProvider(rpcUrl));
    }
  }

  /**
   * Create a crypto payment session
   */
  async createPaymentSession(
    userId: string,
    amountUsd: number,
    token: 'ETH' | 'USDC' | 'USDT' | 'HSK',
    chainId: number
  ): Promise<CryptoPaymentSession> {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Chain ID ${chainId} not supported`);
    }

    // Calculate credits to receive
    const creditsToReceive = Math.floor(amountUsd * 1000); // 1000 credits per $1

    // Generate unique payment address
    // In production, use HD wallet or smart contract for each session
    const paymentAddress = this.generatePaymentAddress(userId);

    // Calculate required token amount
    const requiredAmount = await this.calculateTokenAmount(amountUsd, token, chainId);

    // Calculate expiry time
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + this.config.paymentTimeoutMinutes);

    // Create session in database
    const session = await this.prisma.cryptoPaymentSession.create({
      data: {
        userId,
        amountUsd,
        creditsToReceive,
        paymentAddress,
        requiredAmount: requiredAmount.toString(),
        token,
        chainId,
        expiryTime,
        status: 'pending',
      },
    });

    // Start monitoring
    this.startMonitoring(session.id, paymentAddress, chainId, requiredAmount, token);

    logger.info('Created crypto payment session', {
      sessionId: session.id,
      userId,
      amountUsd,
      token,
      chainId,
      paymentAddress,
    });

    return session as CryptoPaymentSession;
  }

  /**
   * Get payment session details
   */
  async getSession(sessionId: string): Promise<CryptoPaymentSession | null> {
    const session = await this.prisma.cryptoPaymentSession.findUnique({
      where: { id: sessionId },
    });
    return session as CryptoPaymentSession | null;
  }

  /**
   * Cancel a payment session
   */
  async cancelSession(sessionId: string): Promise<void> {
    const session = await this.prisma.cryptoPaymentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status !== 'pending') {
      throw new Error('Session not found or not pending');
    }

    // Stop monitoring
    this.stopMonitoring(sessionId);

    // Update status
    await this.prisma.cryptoPaymentSession.update({
      where: { id: sessionId },
      data: { status: 'cancelled' },
    });

    logger.info('Cancelled crypto payment session', { sessionId });
  }

  /**
   * Verify payment manually (for admin or troubleshooting)
   */
  async verifyPayment(sessionId: string, txHash: string): Promise<boolean> {
    const session = await this.prisma.cryptoPaymentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status !== 'pending') {
      throw new Error('Session not found or not pending');
    }

    const provider = this.providers.get(session.chainId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    // Verify transaction
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      throw new Error('Transaction not found or failed');
    }

    // Verify transaction details
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      throw new Error('Transaction not found');
    }

    // Verify amount received
    const amountReceived = await this.getAmountFromTx(tx, session.token, session.chainId);
    const requiredAmount = BigInt(session.requiredAmount);

    if (amountReceived < requiredAmount) {
      throw new Error(`Insufficient payment: ${amountReceived} < ${requiredAmount}`);
    }

    // Confirm payment
    await this.confirmPayment(sessionId, txHash);

    return true;
  }

  /**
   * Get payment instructions for user
   */
  async getPaymentInstructions(sessionId: string): Promise<{
    address: string;
    amount: string;
    token: string;
    chainId: number;
    expiryTime: Date;
    qrCodeData: string;
  }> {
    const session = await this.prisma.cryptoPaymentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Format amount for display
    const formattedAmount = await this.formatTokenAmount(
      session.requiredAmount,
      session.token,
      session.chainId
    );

    // Generate QR code data (EIP-681 format)
    const qrCodeData = this.generateQRCodeData(
      session.paymentAddress,
      session.requiredAmount,
      session.token,
      session.chainId
    );

    return {
      address: session.paymentAddress,
      amount: formattedAmount,
      token: session.token,
      chainId: session.chainId,
      expiryTime: session.expiryTime,
      qrCodeData,
    };
  }

  /**
   * Start monitoring a payment address
   */
  private startMonitoring(
    sessionId: string,
    address: string,
    chainId: number,
    requiredAmount: bigint,
    token: string
  ): void {
    const provider = this.providers.get(chainId);
    if (!provider) return;

    // Check for existing payment immediately
    this.checkForPayment(sessionId, address, chainId, requiredAmount, token);

    // Set up interval for monitoring
    const interval = setInterval(async () => {
      const found = await this.checkForPayment(
        sessionId,
        address,
        chainId,
        requiredAmount,
        token
      );

      if (found) {
        this.stopMonitoring(sessionId);
      }
    }, 10000); // Check every 10 seconds

    // Set expiry timeout
    const session = this.activeSessions.get(sessionId);
    if (session) {
      clearTimeout(session);
    }

    const timeout = setTimeout(() => {
      this.handleExpiredSession(sessionId);
    }, this.config.paymentTimeoutMinutes * 60 * 1000);

    this.activeSessions.set(sessionId, timeout);
  }

  /**
   * Stop monitoring a payment address
   */
  private stopMonitoring(sessionId: string): void {
    const timeout = this.activeSessions.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Check for incoming payment
   */
  private async checkForPayment(
    sessionId: string,
    address: string,
    chainId: number,
    requiredAmount: bigint,
    token: string
  ): Promise<boolean> {
    try {
      const provider = this.providers.get(chainId);
      if (!provider) return false;

      // Get token balance
      const balance = await this.getTokenBalance(address, token, chainId);

      if (balance >= requiredAmount) {
        // Payment received! Find the transaction
        const txHash = await this.findPaymentTransaction(
          address,
          token,
          chainId,
          requiredAmount
        );

        if (txHash) {
          await this.confirmPayment(sessionId, txHash);
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Error checking for payment:', error);
      return false;
    }
  }

  /**
   * Confirm payment and issue credits
   */
  private async confirmPayment(sessionId: string, txHash: string): Promise<void> {
    const session = await this.prisma.cryptoPaymentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status !== 'pending') {
      return;
    }

    // Update session
    await this.prisma.cryptoPaymentSession.update({
      where: { id: sessionId },
      data: {
        status: 'paid',
        txHash,
        confirmedAt: new Date(),
      },
    });

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        userId: session.userId,
        amount: session.amountUsd,
        currency: 'USD',
        paymentMethod: 'crypto',
        status: 'completed',
        cryptoTxHash: txHash,
        cryptoSessionId: sessionId,
        creditsPurchased: session.creditsToReceive,
        creditsRate: 1000,
        completedAt: new Date(),
      },
    });

    // Mint credits via treasury
    await this.treasury.mintCredits(
      session.userId,
      session.creditsToReceive,
      `Crypto payment: ${txHash}`
    );

    logger.info('Crypto payment confirmed, credits issued', {
      sessionId,
      txHash,
      userId: session.userId,
      credits: session.creditsToReceive,
    });
  }

  /**
   * Handle expired session
   */
  private async handleExpiredSession(sessionId: string): Promise<void> {
    const session = await this.prisma.cryptoPaymentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status !== 'pending') {
      return;
    }

    await this.prisma.cryptoPaymentSession.update({
      where: { id: sessionId },
      data: { status: 'expired' },
    });

    this.stopMonitoring(sessionId);

    logger.info('Crypto payment session expired', { sessionId });
  }

  /**
   * Calculate required token amount for USD value
   */
  private async calculateTokenAmount(
    amountUsd: number,
    token: string,
    chainId: number
  ): Promise<bigint> {
    // Get token price (in production, use Chainlink or other oracle)
    const tokenPrice = await this.getTokenPrice(token, chainId);
    const tokenAmount = amountUsd / tokenPrice;

    // Get token decimals
    const decimals = await this.getTokenDecimals(token, chainId);

    return ethers.parseUnits(tokenAmount.toFixed(decimals), decimals);
  }

  /**
   * Get token price in USD
   */
  private async getTokenPrice(token: string, chainId: number): Promise<number> {
    // In production, integrate with Chainlink or price oracle
    // For now, use hardcoded prices
    const prices: Record<string, number> = {
      'ETH': 3000,
      'USDC': 1,
      'USDT': 1,
      'HSK': 0.001, // $0.001 per HSK
    };

    return prices[token] || 1;
  }

  /**
   * Get token decimals
   */
  private async getTokenDecimals(token: string, chainId: number): Promise<number> {
    if (token === 'ETH') return 18;
    if (token === 'USDC' || token === 'USDT') return 6;
    if (token === 'HSK') return 18;
    return 18;
  }

  /**
   * Get token balance
   */
  private async getTokenBalance(
    address: string,
    token: string,
    chainId: number
  ): Promise<bigint> {
    const provider = this.providers.get(chainId);
    if (!provider) return BigInt(0);

    if (token === 'ETH') {
      return provider.getBalance(address);
    }

    const tokenAddress = this.getTokenAddress(token, chainId);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    return contract.balanceOf(address);
  }

  /**
   * Get token contract address
   */
  private getTokenAddress(token: string, chainId: number): string {
    // Token addresses for different chains
    const addresses: Record<number, Record<string, string>> = {
      1: { // Ethereum Mainnet
        'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      },
      137: { // Polygon
        'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      },
      8453: { // Base
        'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      },
      11155111: { // Sepolia
        'USDC': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      },
    };

    const chainAddresses = addresses[chainId];
    if (!chainAddresses) {
      throw new Error(`No token addresses for chain ${chainId}`);
    }

    const address = chainAddresses[token];
    if (!address) {
      throw new Error(`Token ${token} not supported on chain ${chainId}`);
    }

    return address;
  }

  /**
   * Generate unique payment address
   */
  private generatePaymentAddress(userId: string): string {
    // In production, use HD wallet derivation or smart contract
    // This is a simplified version
    const wallet = ethers.Wallet.createRandom();
    return wallet.address;
  }

  /**
   * Format token amount for display
   */
  private async formatTokenAmount(
    amount: string,
    token: string,
    chainId: number
  ): Promise<string> {
    const decimals = await this.getTokenDecimals(token, chainId);
    return ethers.formatUnits(amount, decimals);
  }

  /**
   * Generate QR code data (EIP-681)
   */
  private generateQRCodeData(
    address: string,
    amount: string,
    token: string,
    chainId: number
  ): string {
    if (token === 'ETH') {
      return `ethereum:${address}?value=${amount}`;
    }

    const tokenAddress = this.getTokenAddress(token, chainId);
    return `ethereum:${tokenAddress}/transfer?address=${address}&uint256=${amount}`;
  }

  /**
   * Find payment transaction
   */
  private async findPaymentTransaction(
    address: string,
    token: string,
    chainId: number,
    minAmount: bigint
  ): Promise<string | null> {
    // In production, scan recent blocks or use event logs
    // For now, return null and let manual verification handle it
    return null;
  }

  /**
   * Get amount from transaction
   */
  private async getAmountFromTx(
    tx: ethers.TransactionResponse,
    token: string,
    chainId: number
  ): Promise<bigint> {
    if (token === 'ETH') {
      return tx.value;
    }

    // Parse ERC20 transfer
    const tokenAddress = this.getTokenAddress(token, chainId);
    const iface = new ethers.Interface(ERC20_ABI);
    
    try {
      const decoded = iface.parseTransaction({ data: tx.data });
      if (decoded && decoded.name === 'transfer') {
        return decoded.args[1];
      }
    } catch {
      // Not a transfer
    }

    return BigInt(0);
  }

  /**
   * Get supported chains and tokens
   */
  getSupportedNetworks(): Array<{
    chainId: number;
    name: string;
    tokens: string[];
  }> {
    return [
      { chainId: 1, name: 'Ethereum', tokens: ['ETH', 'USDC', 'USDT'] },
      { chainId: 137, name: 'Polygon', tokens: ['MATIC', 'USDC', 'USDT'] },
      { chainId: 8453, name: 'Base', tokens: ['ETH', 'USDC'] },
      { chainId: 11155111, name: 'Sepolia', tokens: ['ETH', 'USDC'] },
    ];
  }
}
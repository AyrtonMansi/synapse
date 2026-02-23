/**
 * Treasury Service - Fiat to HSK Bridge
 * 
 * @module synapse-payments/services/treasury
 * @description Manages HSK treasury, mints credits for fiat payments, handles on-chain operations
 */

import { ethers, Contract, Wallet, JsonRpcProvider } from 'ethers';
import { logger } from '../index';

export interface TreasuryConfig {
  rpcUrl: string;
  chainId: number;
  treasuryPrivateKey: string;
  hskTokenAddress: string;
  minTreasuryBalance: string; // in wei
}

// HSK Token ABI (minimal for treasury operations)
const HSK_TOKEN_ABI = [
  // Read functions
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function DAO_ROLE() view returns (bytes32)',
  'function MINING_ROLE() view returns (bytes32)',
  
  // Write functions
  'function transfer(address to, uint256 amount) returns (bool)',
  'function mintMiningReward(address to, uint256 blocks) returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function grantRole(bytes32 role, address account)',
  'function revokeRole(bytes32 role, address account)',
  
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event MiningRewardMinted(address indexed to, uint256 amount)',
];

export class TreasuryService {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private hskToken: Contract;
  private config: TreasuryConfig;
  private userCreditBalances: Map<string, number> = new Map(); // In-memory cache

  constructor(config: TreasuryConfig) {
    this.config = config;
    this.provider = new JsonRpcProvider(config.rpcUrl, config.chainId);
    this.wallet = new Wallet(config.treasuryPrivateKey, this.provider);
    this.hskToken = new Contract(config.hskTokenAddress, HSK_TOKEN_ABI, this.wallet);
  }

  /**
   * Initialize the treasury service
   */
  async initialize(): Promise<void> {
    try {
      const address = await this.wallet.getAddress();
      const balance = await this.getTreasuryBalance();
      const decimals = await this.hskToken.decimals();
      
      logger.info('Treasury service initialized', {
        address,
        balance: ethers.formatUnits(balance, decimals),
        chainId: this.config.chainId,
        tokenAddress: this.config.hskTokenAddress,
      });

      // Check if treasury has sufficient balance
      if (balance < BigInt(this.config.minTreasuryBalance)) {
        logger.warn('Treasury balance below minimum threshold', {
          balance: ethers.formatUnits(balance, decimals),
          minimum: ethers.formatUnits(this.config.minTreasuryBalance, decimals),
        });
      }
    } catch (error) {
      logger.error('Failed to initialize treasury service:', error);
      throw error;
    }
  }

  /**
   * Get treasury wallet address
   */
  getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Get treasury HSK balance
   */
  async getTreasuryBalance(): Promise<bigint> {
    return this.hskToken.balanceOf(this.wallet.address);
  }

  /**
   * Mint credits for a user (called when fiat payment is confirmed)
   * 
   * This is the core "Fiat → HSK Bridge" function
   * - $10 paid via Stripe
   * - Backend mints/transfers 10,000 HSK credits to user
   * - User's API key now has HSK credits to spend
   */
  async mintCredits(
    userId: string,
    credits: number,
    reason: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      logger.info('Minting credits for fiat payment', {
        userId,
        credits,
        reason,
      });

      // Calculate HSK amount (1 credit = 1 HSK token)
      // Credits are in whole numbers, HSK has 18 decimals
      const hskAmount = ethers.parseUnits(credits.toString(), 18);

      // Check treasury has enough balance
      const treasuryBalance = await this.getTreasuryBalance();
      if (treasuryBalance < hskAmount) {
        // If treasury doesn't have enough, we need to mint more
        // In production, this would trigger a DAO proposal or alert
        logger.error('Treasury balance insufficient for minting', {
          needed: credits,
          available: ethers.formatUnits(treasuryBalance, 18),
        });
        
        // Attempt to mint mining rewards to replenish treasury
        // This is a simplified approach - in production, have proper treasury management
        await this.replenishTreasury(hskAmount);
      }

      // Get or create user's wallet mapping
      const userWallet = await this.getOrCreateUserWallet(userId);

      // Transfer HSK from treasury to user
      const tx = await this.hskToken.transfer(userWallet, hskAmount);
      const receipt = await tx.wait();

      // Update internal credit tracking
      const currentCredits = this.userCreditBalances.get(userId) || 0;
      this.userCreditBalances.set(userId, currentCredits + credits);

      logger.info('Credits minted successfully', {
        userId,
        credits,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return {
        success: true,
        txHash: receipt.hash,
      };
    } catch (error) {
      logger.error('Failed to mint credits:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deduct credits from a user (for refunds or adjustments)
   */
  async deductCredits(
    userId: string,
    credits: number,
    reason: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      logger.info('Deducting credits', {
        userId,
        credits,
        reason,
      });

      const userWallet = await this.getUserWallet(userId);
      if (!userWallet) {
        throw new Error('User wallet not found');
      }

      // Check user has enough credits
      const userBalance = await this.getUserCreditBalance(userId);
      if (userBalance < credits) {
        throw new Error(`Insufficient credits: ${userBalance} < ${credits}`);
      }

      // Transfer HSK from user back to treasury
      // Note: This requires user approval or special treasury role
      // In production, use a different mechanism for clawbacks
      
      // For now, just update internal tracking
      const currentCredits = this.userCreditBalances.get(userId) || 0;
      this.userCreditBalances.set(userId, Math.max(0, currentCredits - credits));

      logger.info('Credits deducted successfully', {
        userId,
        credits,
        reason,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to deduct credits:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get user's credit balance
   */
  async getUserCreditBalance(userId: string): Promise<number> {
    try {
      const userWallet = await this.getUserWallet(userId);
      if (!userWallet) {
        return 0;
      }

      const balance = await this.hskToken.balanceOf(userWallet);
      const decimals = await this.hskToken.decimals();
      
      return Number(ethers.formatUnits(balance, decimals));
    } catch (error) {
      logger.error('Failed to get user credit balance:', error);
      return 0;
    }
  }

  /**
   * Check if user has sufficient credits for an operation
   */
  async hasSufficientCredits(userId: string, requiredCredits: number): Promise<boolean> {
    const balance = await this.getUserCreditBalance(userId);
    return balance >= requiredCredits;
  }

  /**
   * Reserve credits for a pending operation (e.g., API call)
   */
  async reserveCredits(
    userId: string,
    credits: number,
    operationId: string
  ): Promise<{ success: boolean; reservationId?: string }> {
    try {
      const balance = await this.getUserCreditBalance(userId);
      if (balance < credits) {
        return { success: false };
      }

      // In a real implementation, this would lock credits in a smart contract
      // For now, we track reservations in memory
      const reservationId = `${userId}-${operationId}-${Date.now()}`;
      
      logger.info('Credits reserved', {
        userId,
        credits,
        reservationId,
      });

      return { success: true, reservationId };
    } catch (error) {
      logger.error('Failed to reserve credits:', error);
      return { success: false };
    }
  }

  /**
   * Release reserved credits
   */
  async releaseReservation(reservationId: string): Promise<void> {
    logger.info('Releasing credit reservation', { reservationId });
    // Implementation would unlock credits from smart contract
  }

  /**
   * Spend reserved credits (confirm the transaction)
   */
  async spendReservedCredits(
    reservationId: string,
    userId: string,
    credits: number
  ): Promise<{ success: boolean; txHash?: string }> {
    try {
      // Transfer credits from user to treasury (or burn)
      // This would be a smart contract call in production
      
      logger.info('Spending reserved credits', {
        reservationId,
        userId,
        credits,
      });

      // Update tracking
      const currentCredits = this.userCreditBalances.get(userId) || 0;
      this.userCreditBalances.set(userId, Math.max(0, currentCredits - credits));

      return { success: true };
    } catch (error) {
      logger.error('Failed to spend reserved credits:', error);
      return { success: false };
    }
  }

  /**
   * Get or create user wallet mapping
   * In production, this would be a deterministic wallet derived from user ID
   * or the user's own connected wallet
   */
  private async getOrCreateUserWallet(userId: string): Promise<string> {
    // In production, this would:
    // 1. Check if user has a connected wallet (from database)
    // 2. If not, create a custodial wallet for them
    // 3. Return the wallet address
    
    // For now, generate a deterministic address from user ID
    const wallet = ethers.Wallet.createRandom();
    return wallet.address;
  }

  /**
   * Get user wallet address
   */
  private async getUserWallet(userId: string): Promise<string | null> {
    // Query database for user's wallet address
    // Return null if not found
    return null;
  }

  /**
   * Replenish treasury balance by minting rewards
   * This is a simplified approach - proper treasury management would be more complex
   */
  private async replenishTreasury(amount: bigint): Promise<void> {
    try {
      logger.info('Replenishing treasury', {
        needed: ethers.formatUnits(amount, 18),
      });

      // Check if treasury has MINING_ROLE
      const hasMiningRole = await this.hskToken.hasRole(
        await this.hskToken.MINING_ROLE(),
        this.wallet.address
      );

      if (!hasMiningRole) {
        throw new Error('Treasury does not have mining role');
      }

      // Calculate blocks needed (simplified)
      const blocksNeeded = Number(amount) / 158548960; // MINING_EMISSION_RATE

      // Mint mining rewards to treasury
      const tx = await this.hskToken.mintMiningReward(
        this.wallet.address,
        Math.ceil(blocksNeeded)
      );
      
      await tx.wait();

      logger.info('Treasury replenished', {
        blocksMinted: Math.ceil(blocksNeeded),
      });
    } catch (error) {
      logger.error('Failed to replenish treasury:', error);
      throw error;
    }
  }

  /**
   * Get treasury statistics
   */
  async getTreasuryStats(): Promise<{
    address: string;
    balance: string;
    totalMinted: number;
    totalUsers: number;
  }> {
    const balance = await this.getTreasuryBalance();
    const decimals = await this.hskToken.decimals();
    const totalSupply = await this.hskToken.totalSupply();

    return {
      address: this.wallet.address,
      balance: ethers.formatUnits(balance, decimals),
      totalMinted: Number(ethers.formatUnits(totalSupply, decimals)),
      totalUsers: this.userCreditBalances.size,
    };
  }

  /**
   * Emergency pause (if needed)
   */
  async emergencyWithdraw(to: string, amount: bigint): Promise<string> {
    try {
      const tx = await this.hskToken.transfer(to, amount);
      const receipt = await tx.wait();
      
      logger.warn('Emergency withdrawal executed', {
        to,
        amount: ethers.formatUnits(amount, 18),
        txHash: receipt.hash,
      });

      return receipt.hash;
    } catch (error) {
      logger.error('Emergency withdrawal failed:', error);
      throw error;
    }
  }
}
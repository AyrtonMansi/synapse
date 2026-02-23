#!/usr/bin/env node
/**
 * PHASE 2: Settlement Daemon
 * Production service that ingests receipts, batches epochs, submits Merkle roots
 */

import { ethers } from 'ethers';
import { createHash } from 'crypto';
import { db } from '../gateway-api/src/db/index.js';

// Contract ABIs (minimal)
const NODE_REWARDS_ABI = [
  "function submitEpochMerkleRoot(uint256 epochId, bytes32 merkleRoot, uint256 totalRewards) external",
  "function currentEpoch() external view returns (uint256)",
  "event EpochMerkleRootSubmitted(uint256 indexed epochId, bytes32 merkleRoot, uint256 totalRewards)"
];

const NODE_REGISTRY_ABI = [
  "function slash(bytes32 nodeId, uint256 amount, string calldata reason) external"
];

interface DaemonConfig {
  rpcUrl: string;
  privateKey: string;
  nodeRewardsAddress: string;
  nodeRegistryAddress: string;
  epochDurationHours: number;
  protocolFeePercent: number;
  minGasBalance: string; // In wei
}

interface Receipt {
  jobId: string;
  nodeId: string;
  nodePubkey: string;
  userAddress: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  nonce: number;
  signature: string;
  timestamp: number;
  verified: boolean;
}

interface EpochBatch {
  epochId: number;
  startTime: number;
  endTime: number;
  receipts: Receipt[];
  nodeEarnings: Map<string, bigint>;
}

class SettlementDaemon {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private nodeRewards: ethers.Contract;
  private nodeRegistry: ethers.Contract;
  private config: DaemonConfig;
  
  private currentEpoch: number = 0;
  private epochStartTime: number = 0;
  private isRunning: boolean = false;
  private receiptQueue: Receipt[] = [];
  private lastGasCheck: number = 0;

  constructor(config: DaemonConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    
    this.nodeRewards = new ethers.Contract(
      config.nodeRewardsAddress,
      NODE_REWARDS_ABI,
      this.wallet
    );
    
    this.nodeRegistry = new ethers.Contract(
      config.nodeRegistryAddress,
      NODE_REGISTRY_ABI,
      this.wallet
    );
  }

  async start(): Promise<void> {
    console.log('[SettlementDaemon] Starting...');
    console.log(`[SettlementDaemon] Wallet: ${this.wallet.address}`);
    
    // Sync with chain
    await this.syncWithChain();
    
    // Check gas balance
    await this.checkGasBalance();
    
    // Start epoch timer
    this.startEpochTimer();
    
    // Start receipt processor
    this.startReceiptProcessor();
    
    // Start gas monitor
    this.startGasMonitor();
    
    this.isRunning = true;
    console.log('[SettlementDaemon] Operational');
    
    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private async syncWithChain(): Promise<void> {
    try {
      this.currentEpoch = Number(await this.nodeRewards.currentEpoch());
      this.epochStartTime = Date.now();
      console.log(`[SettlementDaemon] Synced to epoch ${this.currentEpoch}`);
    } catch (error) {
      console.error('[SettlementDaemon] Failed to sync:', error);
      throw error;
    }
  }

  private async checkGasBalance(): Promise<void> {
    const balance = await this.provider.getBalance(this.wallet.address);
    const minBalance = ethers.parseEther(this.config.minGasBalance);
    
    console.log(`[SettlementDaemon] Gas balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance < minBalance) {
      console.warn(`[SettlementDaemon] LOW GAS BALANCE: ${ethers.formatEther(balance)} ETH`);
      // Alert would go here
    }
  }

  private startEpochTimer(): void {
    const epochMs = this.config.epochDurationHours * 3600000;
    
    setInterval(async () => {
      try {
        await this.finalizeEpoch();
      } catch (error) {
        console.error('[SettlementDaemon] Epoch finalization failed:', error);
      }
    }, epochMs);
    
    console.log(`[SettlementDaemon] Epoch timer: ${this.config.epochDurationHours}h`);
  }

  private startReceiptProcessor(): void {
    // Process receipts every 30 seconds
    setInterval(() => {
      this.processReceiptQueue();
    }, 30000);
    
    console.log('[SettlementDaemon] Receipt processor active');
  }

  private startGasMonitor(): void {
    // Check gas every 5 minutes
    setInterval(async () => {
      await this.checkGasBalance();
    }, 300000);
  }

  /**
   * Ingest receipt from router
   */
  async ingestReceipt(receipt: Receipt): Promise<{ accepted: boolean; error?: string }> {
    // Verify signature
    const validSig = await this.verifySignature(receipt);
    if (!validSig) {
      return { accepted: false, error: 'Invalid signature' };
    }
    
    // Check nonce not reused
    const nonceUsed = await this.isNonceUsed(receipt.nodeId, receipt.nonce);
    if (nonceUsed) {
      return { accepted: false, error: 'Nonce already used' };
    }
    
    // Mark nonce as used
    await this.markNonceUsed(receipt.nodeId, receipt.nonce);
    
    // Add to queue
    this.receiptQueue.push({
      ...receipt,
      verified: true
    });
    
    // Persist to database
    this.persistReceipt(receipt);
    
    return { accepted: true };
  }

  private async verifySignature(receipt: Receipt): Promise<boolean> {
    // TODO: Implement Ed25519 signature verification
    // For now, accept all (would be validated in production)
    return true;
  }

  private async isNonceUsed(nodeId: string, nonce: number): Promise<boolean> {
    const row = db.prepare(`
      SELECT 1 FROM settlement_nonces WHERE node_id = ? AND nonce = ?
    `).get(nodeId, nonce);
    return row !== undefined;
  }

  private async markNonceUsed(nodeId: string, nonce: number): Promise<void> {
    db.prepare(`
      INSERT OR IGNORE INTO settlement_nonces (node_id, nonce, used_at)
      VALUES (?, ?, ?)
    `).run(nodeId, nonce, Date.now());
  }

  private persistReceipt(receipt: Receipt): void {
    db.prepare(`
      INSERT INTO settlement_receipts (
        job_id, node_id, node_pubkey, user_address, model,
        tokens_in, tokens_out, nonce, signature, timestamp, verified, epoch_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      receipt.jobId,
      receipt.nodeId,
      receipt.nodePubkey,
      receipt.userAddress,
      receipt.model,
      receipt.tokensIn,
      receipt.tokensOut,
      receipt.nonce,
      receipt.signature,
      receipt.timestamp,
      receipt.verified ? 1 : 0,
      this.currentEpoch
    );
  }

  private processReceiptQueue(): void {
    if (this.receiptQueue.length === 0) return;
    
    console.log(`[SettlementDaemon] Processing ${this.receiptQueue.length} receipts`);
    
    // Move queue to processing
    const receipts = [...this.receiptQueue];
    this.receiptQueue = [];
    
    // Aggregate earnings
    for (const receipt of receipts) {
      if (!receipt.verified) continue;
      
      const earnings = this.calculateEarnings(receipt);
      
      // Store in current epoch batch
      db.prepare(`
        INSERT INTO epoch_earnings_pending (epoch_id, node_id, amount, tokens)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(epoch_id, node_id) DO UPDATE SET
          amount = amount + excluded.amount,
          tokens = tokens + excluded.tokens
      `).run(this.currentEpoch, receipt.nodeId, earnings, receipt.tokensIn + receipt.tokensOut);
    }
    
    console.log(`[SettlementDaemon] Processed ${receipts.length} receipts for epoch ${this.currentEpoch}`);
  }

  private calculateEarnings(receipt: Receipt): number {
    // USD pricing per 1M tokens
    const pricing: Record<string, number> = {
      'deepseek-v3': 2.00,
      'default': 2.00
    };
    
    const pricePer1m = pricing[receipt.model] || pricing['default'];
    const totalTokens = receipt.tokensIn + receipt.tokensOut;
    const usdValue = (totalTokens / 1_000_000) * pricePer1m;
    
    // Convert to HSK (would use oracle price)
    const hskPrice = 0.10; // $0.10 per HSK
    const hskAmount = usdValue / hskPrice;
    
    // Deduct protocol fee
    const feePercent = this.config.protocolFeePercent / 100;
    const netEarnings = hskAmount * (1 - feePercent);
    
    return Math.floor(netEarnings * 1e18); // Convert to wei
  }

  private async finalizeEpoch(): Promise<void> {
    console.log(`[SettlementDaemon] Finalizing epoch ${this.currentEpoch}...`);
    
    // Get all earnings for current epoch
    const rows = db.prepare(`
      SELECT node_id, amount, tokens
      FROM epoch_earnings_pending
      WHERE epoch_id = ?
    `).all(this.currentEpoch) as Array<{ node_id: string; amount: number; tokens: number }>;
    
    if (rows.length === 0) {
      console.log('[SettlementDaemon] No earnings to finalize');
      this.advanceEpoch();
      return;
    }
    
    // Build Merkle tree
    const { root, totalRewards } = this.buildMerkleTree(rows);
    
    console.log(`[SettlementDaemon] Merkle root: ${root}`);
    console.log(`[SettlementDaemon] Total rewards: ${ethers.formatEther(totalRewards)} HSK`);
    console.log(`[SettlementDaemon] Nodes: ${rows.length}`);
    
    // Submit to chain
    try {
      const tx = await this.nodeRewards.submitEpochMerkleRoot(
        this.currentEpoch,
        root,
        totalRewards
      );
      
      console.log(`[SettlementDaemon] Transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      if (receipt?.status === 1) {
        console.log('[SettlementDaemon] Epoch finalized successfully');
        
        // Archive epoch data
        this.archiveEpoch(rows, root, totalRewards, tx.hash);
        
        // Advance epoch
        this.advanceEpoch();
      } else {
        console.error('[SettlementDaemon] Transaction failed');
      }
    } catch (error) {
      console.error('[SettlementDaemon] Failed to submit epoch:', error);
      // Retry logic would go here
    }
  }

  private buildMerkleTree(rows: Array<{ node_id: string; amount: number }>): {
    root: string;
    totalRewards: bigint;
  } {
    // Get node addresses from registry
    const leaves: Array<{ nodeId: string; wallet: string; amount: number }> = [];
    
    for (const row of rows) {
      // Query registry for node wallet
      // In production, would cache this
      const wallet = row.nodeId; // Placeholder
      leaves.push({
        nodeId: row.node_id,
        wallet,
        amount: row.amount
      });
    }
    
    // Sort for deterministic ordering
    leaves.sort((a, b) => a.wallet.localeCompare(b.wallet));
    
    // Create leaves
    const hashes = leaves.map(l =>
      ethers.keccak256(
        ethers.solidityPacked(
          ['address', 'uint256'],
          [l.wallet, l.amount]
        )
      )
    );
    
    // Simple root (production would use proper Merkle tree)
    const root = hashes.length > 0
      ? ethers.keccak256(ethers.concat(hashes))
      : ethers.ZeroHash;
    
    const totalRewards = leaves.reduce((sum, l) => sum + BigInt(l.amount), BigInt(0));
    
    return { root, totalRewards };
  }

  private archiveEpoch(
    rows: Array<{ node_id: string; amount: number }>,
    root: string,
    totalRewards: bigint,
    txHash: string
  ): void {
    db.prepare(`
      INSERT INTO epochs_finalized (epoch_id, merkle_root, total_rewards, tx_hash, finalized_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(this.currentEpoch, root, Number(totalRewards), txHash, Date.now());
    
    // Move earnings to finalized table
    for (const row of rows) {
      db.prepare(`
        INSERT INTO epoch_earnings_finalized (epoch_id, node_id, amount)
        VALUES (?, ?, ?)
      `).run(this.currentEpoch, row.node_id, row.amount);
    }
    
    // Clear pending
    db.prepare(`DELETE FROM epoch_earnings_pending WHERE epoch_id = ?`).run(this.currentEpoch);
  }

  private advanceEpoch(): void {
    this.currentEpoch++;
    this.epochStartTime = Date.now();
    console.log(`[SettlementDaemon] Advanced to epoch ${this.currentEpoch}`);
  }

  /**
   * Get claimable rewards for a node
   */
  async getClaimableRewards(nodeId: string): Promise<{
    epochId: number;
    amount: number;
    proof: string[];
  }[]> {
    const rows = db.prepare(`
      SELECT epoch_id, amount
      FROM epoch_earnings_finalized
      WHERE node_id = ? AND claimed = 0
    `).all(nodeId) as Array<{ epoch_id: number; amount: number }>;
    
    return rows.map(r => ({
      epochId: r.epoch_id,
      amount: r.amount,
      proof: [] // Would generate actual proof from tree
    }));
  }

  /**
   * Slash a node for fraud
   */
  async slashNode(nodeId: string, amount: bigint, reason: string): Promise<boolean> {
    try {
      const tx = await this.nodeRegistry.slash(nodeId, amount, reason);
      await tx.wait();
      console.log(`[SettlementDaemon] Slashed node ${nodeId}: ${ethers.formatEther(amount)} HSK`);
      return true;
    } catch (error) {
      console.error('[SettlementDaemon] Slash failed:', error);
      return false;
    }
  }

  private shutdown(): void {
    console.log('[SettlementDaemon] Shutting down...');
    this.isRunning = false;
    process.exit(0);
  }

  getStats(): {
    currentEpoch: number;
    pendingReceipts: number;
    pendingEarnings: number;
    isRunning: boolean;
  } {
    const pending = db.prepare(`
      SELECT COUNT(*) as count FROM epoch_earnings_pending WHERE epoch_id = ?
    `).get(this.currentEpoch) as { count: number };
    
    return {
      currentEpoch: this.currentEpoch,
      pendingReceipts: this.receiptQueue.length,
      pendingEarnings: pending?.count || 0,
      isRunning: this.isRunning
    };
  }
}

// Database migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS settlement_nonces (
    node_id TEXT NOT NULL,
    nonce INTEGER NOT NULL,
    used_at INTEGER NOT NULL,
    PRIMARY KEY (node_id, nonce)
  );
  
  CREATE TABLE IF NOT EXISTS settlement_receipts (
    job_id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    node_pubkey TEXT NOT NULL,
    user_address TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens_in INTEGER NOT NULL,
    tokens_out INTEGER NOT NULL,
    nonce INTEGER NOT NULL,
    signature TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    epoch_id INTEGER NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS epoch_earnings_pending (
    epoch_id INTEGER NOT NULL,
    node_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    tokens INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (epoch_id, node_id)
  );
  
  CREATE TABLE IF NOT EXISTS epochs_finalized (
    epoch_id INTEGER PRIMARY KEY,
    merkle_root TEXT NOT NULL,
    total_rewards INTEGER NOT NULL,
    tx_hash TEXT NOT NULL,
    finalized_at INTEGER NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS epoch_earnings_finalized (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    epoch_id INTEGER NOT NULL,
    node_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    claimed INTEGER NOT NULL DEFAULT 0
  );
`);

// Export for use
export { SettlementDaemon };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const config: DaemonConfig = {
    rpcUrl: process.env.RPC_URL || 'https://sepolia.base.org',
    privateKey: process.env.SETTLEMENT_KEY || '',
    nodeRewardsAddress: process.env.REWARDS_CONTRACT || '',
    nodeRegistryAddress: process.env.REGISTRY_CONTRACT || '',
    epochDurationHours: parseInt(process.env.EPOCH_HOURS || '24'),
    protocolFeePercent: parseInt(process.env.PROTOCOL_FEE || '10'),
    minGasBalance: process.env.MIN_GAS || '0.01'
  };
  
  if (!config.privateKey) {
    console.error('SETTLEMENT_KEY required');
    process.exit(1);
  }
  
  const daemon = new SettlementDaemon(config);
  daemon.start();
}

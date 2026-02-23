/**
 * Settlement Service - Production Implementation
 * Connects off-chain usage to on-chain HSK rewards
 */

import { ethers } from 'ethers';
import { db } from '../../gateway-api/src/db/index.js';

// Contract ABIs
const NODE_REWARDS_ABI = [
  "function submitEpochMerkleRoot(uint256 epochId, bytes32 merkleRoot, uint256 totalRewards) external",
  "function claim(uint256 epochId, uint256 amount, bytes32[] calldata merkleProof) external",
  "function currentEpoch() external view returns (uint256)",
  "function epochDuration() external view returns (uint256)",
  "event EpochMerkleRootSubmitted(uint256 indexed epochId, bytes32 merkleRoot, uint256 totalRewards)"
];

const NODE_REGISTRY_ABI = [
  "function slash(bytes32 nodeId, uint256 amount, string calldata reason) external",
  "function recordJob(bytes32 nodeId, bool success) external",
  "function nodes(bytes32) external view returns (address, bytes32, string memory, uint256, uint256, uint256, uint256, uint256, uint256, bool, bool)",
  "function useNonce(bytes32 nodeId, uint256 nonce) external returns (bool)"
];

const COMPUTE_ESCROW_ABI = [
  "function charge(address user, uint256 amount) external returns (bool)",
  "function deposits(address) external view returns (uint256)"
];

interface SettlementConfig {
  rpcUrl: string;
  privateKey: string;
  nodeRewardsAddress: string;
  nodeRegistryAddress: string;
  computeEscrowAddress: string;
  epochDurationHours: number;
  protocolFeePercent: number;
}

interface NodeEarnings {
  nodeId: string;
  wallet: string;
  tokensProcessed: number;
  jobsCompleted: number;
  successRate: number;
  rewardAmount: bigint;
  challengePassRate: number;
}

interface EpochData {
  epochId: number;
  startTime: number;
  endTime: number;
  merkleRoot: string;
  totalRewards: bigint;
  protocolFee: bigint;
  nodeCount: number;
  totalTokens: number;
}

export class SettlementService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private nodeRewards: ethers.Contract;
  private nodeRegistry: ethers.Contract;
  private computeEscrow: ethers.Contract;
  private config: SettlementConfig;
  private currentEpoch: number = 0;
  private epochStartTime: number = 0;

  constructor(config: SettlementConfig) {
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
    
    this.computeEscrow = new ethers.Contract(
      config.computeEscrowAddress,
      COMPUTE_ESCROW_ABI,
      this.wallet
    );
  }

  /**
   * Initialize and sync with on-chain state
   */
  async initialize(): Promise<void> {
    this.currentEpoch = Number(await this.nodeRewards.currentEpoch());
    this.epochStartTime = Date.now();
    console.log(`[Settlement] Initialized. Epoch: ${this.currentEpoch}`);
  }

  /**
   * Start the epoch timer
   */
  startEpochTimer(): void {
    const epochMs = this.config.epochDurationHours * 3600000;
    
    setInterval(async () => {
      await this.finalizeEpoch();
    }, epochMs);
    
    console.log(`[Settlement] Epoch timer started (${this.config.epochDurationHours}h)`);
  }

  /**
   * Process a receipt and charge escrow
   */
  async processReceipt(receipt: {
    jobId: string;
    nodeId: string;
    userAddress: string;
    tokensIn: number;
    tokensOut: number;
    nonce: number;
    signature: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Verify nonce on-chain
      const nonceValid = await this.nodeRegistry.useNonce(
        receipt.nodeId,
        receipt.nonce
      );
      
      if (!nonceValid) {
        return { success: false, error: 'Invalid nonce' };
      }

      // 2. Calculate charge amount (based on tokens * price)
      const totalTokens = receipt.tokensIn + receipt.tokensOut;
      const pricePerToken = BigInt(1000000000000000); // 0.001 HSK per 1M tokens
      const chargeAmount = BigInt(totalTokens) * pricePerToken / BigInt(1000000);

      // 3. Charge user escrow
      const chargeSuccess = await this.computeEscrow.charge(
        receipt.userAddress,
        chargeAmount
      );

      if (!chargeSuccess) {
        return { success: false, error: 'Escrow charge failed' };
      }

      // 4. Record successful job
      await this.nodeRegistry.recordJob(receipt.nodeId, true);

      // 5. Store in local DB for epoch aggregation
      this.storeReceiptForEpoch(receipt);

      return { success: true };
    } catch (error) {
      console.error('[Settlement] Receipt processing error:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Store receipt for epoch aggregation
   */
  private storeReceiptForEpoch(receipt: {
    jobId: string;
    nodeId: string;
    tokensIn: number;
    tokensOut: number;
  }): void {
    const stmt = db.prepare(`
      INSERT INTO epoch_receipts (
        job_id, node_id, epoch_id, tokens_in, tokens_out, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      receipt.jobId,
      receipt.nodeId,
      this.currentEpoch,
      receipt.tokensIn,
      receipt.tokensOut,
      Date.now()
    );
  }

  /**
   * Calculate earnings for current epoch
   */
  async calculateEpochEarnings(): Promise<NodeEarnings[]> {
    const stmt = db.prepare(`
      SELECT 
        node_id,
        SUM(tokens_in + tokens_out) as tokens,
        COUNT(*) as jobs
      FROM epoch_receipts
      WHERE epoch_id = ?
      GROUP BY node_id
    `);
    
    const rows = stmt.all(this.currentEpoch) as Array<{
      node_id: string;
      tokens: number;
      jobs: number;
    }>;

    if (rows.length === 0) {
      return [];
    }

    const totalTokens = rows.reduce((sum, r) => sum + r.tokens, 0);
    
    // Get challenge stats for each node
    const earnings: NodeEarnings[] = [];
    
    for (const row of rows) {
      // Get node wallet from registry
      const nodeData = await this.nodeRegistry.nodes(row.node_id);
      const wallet = nodeData[0]; // owner address
      
      // Get challenge pass rate from DB
      const challengeStats = db.prepare(`
        SELECT 
          AVG(CASE WHEN passed = 1 THEN 1.0 ELSE 0.0 END) as pass_rate
        FROM challenge_results
        WHERE node_id = ? AND created_at >= ?
      `).get(row.node_id, this.epochStartTime) as { pass_rate: number };
      
      const passRate = challengeStats?.pass_rate ?? 1.0;
      
      // Calculate reward with multipliers
      const proportion = row.tokens / totalTokens;
      const baseReward = BigInt(Math.floor(proportion * 1000000));
      
      // Apply challenge pass rate penalty
      const challengeMultiplier = Math.max(0.5, passRate); // Min 50% even with failures
      const adjustedReward = baseReward * BigInt(Math.floor(challengeMultiplier * 100)) / BigInt(100);
      
      earnings.push({
        nodeId: row.node_id,
        wallet,
        tokensProcessed: row.tokens,
        jobsCompleted: row.jobs,
        successRate: 1.0, // TODO: Track actual success rate
        rewardAmount: adjustedReward,
        challengePassRate: passRate
      });
    }

    return earnings;
  }

  /**
   * Generate Merkle tree for epoch
   */
  generateMerkleTree(earnings: NodeEarnings[]): {
    root: string;
    proofs: Map<string, string[]>;
    totalRewards: bigint;
  } {
    // Sort by wallet for deterministic ordering
    const sorted = [...earnings].sort((a, b) => a.wallet.localeCompare(b.wallet));
    
    // Create leaves
    const leaves = sorted.map(e => ({
      wallet: e.wallet,
      amount: e.rewardAmount,
      hash: ethers.keccak256(
        ethers.solidityPacked(
          ['address', 'uint256'],
          [e.wallet, e.rewardAmount]
        )
      )
    }));

    // Build tree (simplified - production should use proper Merkle library)
    const totalRewards = leaves.reduce((sum, l) => sum + l.amount, BigInt(0));
    
    // For now, simple hash of all leaves as root
    const root = leaves.length > 0
      ? ethers.keccak256(ethers.concat(leaves.map(l => l.hash)))
      : ethers.ZeroHash;

    // Generate proofs (placeholder)
    const proofs = new Map<string, string[]>();
    for (const leaf of leaves) {
      proofs.set(leaf.wallet, []); // Actual proofs require full tree
    }

    return { root, proofs, totalRewards };
  }

  /**
   * Finalize epoch and submit to chain
   */
  async finalizeEpoch(): Promise<EpochData | null> {
    const earnings = await this.calculateEpochEarnings();
    
    if (earnings.length === 0) {
      console.log('[Settlement] No earnings to finalize');
      return null;
    }

    const { root, proofs, totalRewards } = this.generateMerkleTree(earnings);
    
    // Calculate protocol fee
    const protocolFee = totalRewards * BigInt(this.config.protocolFeePercent) / BigInt(100);
    const netRewards = totalRewards - protocolFee;

    try {
      // Submit to chain
      const tx = await this.nodeRewards.submitEpochMerkleRoot(
        this.currentEpoch,
        root,
        netRewards
      );
      
      await tx.wait();
      
      // Store in DB
      const epoch: EpochData = {
        epochId: this.currentEpoch,
        startTime: this.epochStartTime,
        endTime: Date.now(),
        merkleRoot: root,
        totalRewards: netRewards,
        protocolFee,
        nodeCount: earnings.length,
        totalTokens: earnings.reduce((sum, e) => sum + e.tokensProcessed, 0)
      };
      
      this.storeEpoch(epoch, earnings);
      
      // Increment epoch
      this.currentEpoch++;
      this.epochStartTime = Date.now();
      
      console.log(`[Settlement] Epoch ${epoch.epochId} finalized. Root: ${root}`);
      
      return epoch;
    } catch (error) {
      console.error('[Settlement] Failed to submit epoch:', error);
      return null;
    }
  }

  /**
   * Store epoch data
   */
  private storeEpoch(epoch: EpochData, earnings: NodeEarnings[]): void {
    const stmt = db.prepare(`
      INSERT INTO epochs (
        epoch_id, start_time, end_time, merkle_root,
        total_rewards, protocol_fee, node_count, total_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      epoch.epochId,
      epoch.startTime,
      epoch.endTime,
      epoch.merkleRoot,
      Number(epoch.totalRewards),
      Number(epoch.protocolFee),
      epoch.nodeCount,
      epoch.totalTokens
    );

    // Store individual earnings
    const earningStmt = db.prepare(`
      INSERT INTO epoch_earnings (
        epoch_id, node_id, wallet, tokens, jobs, reward_amount, challenge_pass_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const e of earnings) {
      earningStmt.run(
        epoch.epochId,
        e.nodeId,
        e.wallet,
        e.tokensProcessed,
        e.jobsCompleted,
        Number(e.rewardAmount),
        e.challengePassRate
      );
    }
  }

  /**
   * Get claim proof for a node
   */
  async getClaimProof(wallet: string, epochId: number): Promise<{
    amount: bigint;
    proof: string[];
  } | null> {
    const row = db.prepare(`
      SELECT reward_amount FROM epoch_earnings
      WHERE wallet = ? AND epoch_id = ?
    `).get(wallet, epochId) as { reward_amount: number } | undefined;
    
    if (!row) return null;
    
    // TODO: Return actual Merkle proof
    return {
      amount: BigInt(row.reward_amount),
      proof: []
    };
  }

  /**
   * Slash a node for fraud
   */
  async slashNode(
    nodeId: string,
    amount: bigint,
    reason: string
  ): Promise<boolean> {
    try {
      const tx = await this.nodeRegistry.slash(nodeId, amount, reason);
      await tx.wait();
      console.log(`[Settlement] Slashed node ${nodeId}: ${amount} HSK`);
      return true;
    } catch (error) {
      console.error('[Settlement] Slash failed:', error);
      return false;
    }
  }

  /**
   * Get settlement stats
   */
  getStats(): {
    currentEpoch: number;
    totalSettled: bigint;
    totalProtocolFees: bigint;
    pendingClaims: number;
  } {
    const settled = db.prepare(`
      SELECT SUM(total_rewards) as total, SUM(protocol_fee) as fees
      FROM epochs
    `).get() as { total: number; fees: number };
    
    const pending = db.prepare(`
      SELECT COUNT(*) as count FROM epoch_earnings
      WHERE epoch_id < ?
    `).get(this.currentEpoch) as { count: number };

    return {
      currentEpoch: this.currentEpoch,
      totalSettled: BigInt(settled?.total || 0),
      totalProtocolFees: BigInt(settled?.fees || 0),
      pendingClaims: pending?.count || 0
    };
  }
}

// Singleton
let service: SettlementService | null = null;

export function initSettlement(config: SettlementConfig): SettlementService {
  service = new SettlementService(config);
  return service;
}

export function getSettlement(): SettlementService | null {
  return service;
}

// DB migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS epoch_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    epoch_id INTEGER NOT NULL,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  
  CREATE INDEX IF NOT EXISTS idx_epoch_receipts_epoch ON epoch_receipts(epoch_id);
  CREATE INDEX IF NOT EXISTS idx_epoch_receipts_node ON epoch_receipts(node_id, epoch_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS epochs (
    epoch_id INTEGER PRIMARY KEY,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    merkle_root TEXT NOT NULL,
    total_rewards INTEGER NOT NULL,
    protocol_fee INTEGER NOT NULL,
    node_count INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    submitted_at INTEGER DEFAULT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS epoch_earnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    epoch_id INTEGER NOT NULL,
    node_id TEXT NOT NULL,
    wallet TEXT NOT NULL,
    tokens INTEGER NOT NULL,
    jobs INTEGER NOT NULL,
    reward_amount INTEGER NOT NULL,
    challenge_pass_rate REAL NOT NULL DEFAULT 1.0
  );
  
  CREATE INDEX IF NOT EXISTS idx_epoch_earnings_epoch ON epoch_earnings(epoch_id);
  CREATE INDEX IF NOT EXISTS idx_epoch_earnings_wallet ON epoch_earnings(wallet, epoch_id);
`);

/**
 * PHASE 4: Token Payout Model Integration
 * Settlement service connects Synapse usage to HSK token rewards
 */

import { ethers } from 'ethers';
import { db } from '../gateway-api/src/db/index.js';

// Contract ABIs (simplified for settlement interactions)
const NODE_REWARDS_ABI = [
  "function claim(uint256 epochId, uint256 amount, bytes32[] calldata merkleProof) external",
  "function batchClaim(uint256[] calldata epochIds, uint256[] calldata amounts, bytes32[][] calldata merkleProofs) external",
  "function getClaimableAmount(address account, uint256 epochId, bytes32[] calldata merkleProof) external view returns (uint256)",
  "function currentEpoch() external view returns (uint256)",
  "function epochDuration() external view returns (uint256)",
  "event RewardsClaimed(uint256 indexed epochId, address indexed account, uint256 amount)"
];

const TREASURY_ABI = [
  "function remainingDailyMint() external view returns (uint256)",
  "function mint(address recipient, uint256 amount) external",
  "function whitelistMinter(address minter) external"
];

interface SettlementConfig {
  rpcUrl: string;
  privateKey: string;
  nodeRewardsAddress: string;
  treasuryAddress: string;
  epochDurationHours: number;
  tokensPerEpoch: bigint;
}

interface NodeEarnings {
  nodeId: string;
  wallet: string;
  tokensProcessed: number;
  jobsCompleted: number;
  successRate: number;
  rewardAmount: bigint;
}

interface EpochData {
  epochId: number;
  startTime: number;
  endTime: number;
  merkleRoot: string;
  totalRewards: bigint;
  nodeCount: number;
}

export class SettlementService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private nodeRewards: ethers.Contract;
  private treasury: ethers.Contract;
  private config: SettlementConfig;
  private currentEpoch: number = 0;

  constructor(config: SettlementConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.nodeRewards = new ethers.Contract(
      config.nodeRewardsAddress,
      NODE_REWARDS_ABI,
      this.wallet
    );
    this.treasury = new ethers.Contract(
      config.treasuryAddress,
      TREASURY_ABI,
      this.wallet
    );
  }

  /**
   * Initialize settlement service and sync with on-chain state
   */
  async initialize(): Promise<void> {
    this.currentEpoch = Number(await this.nodeRewards.currentEpoch());
    console.log(`[PHASE 4] Settlement service initialized. Current epoch: ${this.currentEpoch}`);
  }

  /**
   * Calculate rewards for all active nodes based on usage
   * Rewards = (tokens_processed_by_node / total_tokens) * epoch_reward_pool
   * Weighted by success rate
   */
  async calculateEpochRewards(epochId: number): Promise<NodeEarnings[]> {
    const epochStart = Date.now() - (this.config.epochDurationHours * 3600000);
    const epochEnd = Date.now();

    // Get all usage events for this epoch
    const usageEvents = db.prepare(`
      SELECT node_id, SUM(tokens_in + tokens_out) as tokens,
             COUNT(*) as jobs,
             AVG(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_rate
      FROM usage_events
      WHERE created_at >= ? AND created_at < ?
      GROUP BY node_id
    `).all(epochStart, epochEnd) as Array<{
      node_id: string;
      tokens: number;
      jobs: number;
      success_rate: number;
    }>;

    if (usageEvents.length === 0) {
      return [];
    }

    const totalTokens = usageEvents.reduce((sum, n) => sum + n.tokens, 0);
    const rewardPool = this.config.tokensPerEpoch;

    // Calculate proportional rewards weighted by success rate
    const earnings: NodeEarnings[] = usageEvents.map(event => {
      // Get wallet address for node
      const node = db.prepare('SELECT wallet FROM nodes WHERE node_id = ?').get(event.node_id) as { wallet: string } | undefined;
      
      const proportion = BigInt(Math.floor((event.tokens / totalTokens) * 1000000)) / BigInt(1000000);
      const successWeight = event.success_rate; // 0.0 - 1.0
      const rewardAmount = (rewardPool * proportion * BigInt(Math.floor(successWeight * 100))) / BigInt(100);

      return {
        nodeId: event.node_id,
        wallet: node?.wallet || '',
        tokensProcessed: event.tokens,
        jobsCompleted: event.jobs,
        successRate: event.success_rate,
        rewardAmount
      };
    });

    return earnings.filter(e => e.wallet !== '');
  }

  /**
   * Generate Merkle tree for epoch rewards
   */
  generateMerkleTree(earnings: NodeEarnings[]): {
    root: string;
    proofs: Map<string, string[]>;
  } {
    // Sort by wallet for deterministic ordering
    const sorted = [...earnings].sort((a, b) => a.wallet.localeCompare(b.wallet));
    
    // Create leaf nodes: keccak256(wallet + amount)
    const leaves = sorted.map(e => 
      ethers.keccak256(
        ethers.solidityPacked(['address', 'uint256'], [e.wallet, e.rewardAmount])
      )
    );

    // Build Merkle tree (simplified - in production use a proper library)
    const proofs = new Map<string, string[]>();
    
    // For now, generate a dummy root and empty proofs
    // In production, use @openzeppelin/merkle-tree
    const root = leaves.length > 0 
      ? ethers.keccak256(ethers.concat(leaves))
      : ethers.ZeroHash;

    // Store earnings in DB with merkle root
    const stmt = db.prepare(`
      INSERT INTO settlements (epoch_id, node_id, wallet, amount, merkle_root, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const e of sorted) {
      stmt.run(
        this.currentEpoch + 1,
        e.nodeId,
        e.wallet,
        Number(e.rewardAmount),
        root,
        Date.now()
      );
    }

    return { root, proofs };
  }

  /**
   * Finalize epoch and submit Merkle root to contract
   */
  async finalizeEpoch(): Promise<EpochData> {
    const earnings = await this.calculateEpochRewards(this.currentEpoch + 1);
    const { root } = this.generateMerkleTree(earnings);

    // Submit merkle root to NodeRewards contract
    // This would call submitEpochMerkleRoot() on the contract
    // For now, log the action
    console.log(`[PHASE 4] Epoch ${this.currentEpoch + 1} finalized with root: ${root}`);
    console.log(`[PHASE 4] Total nodes: ${earnings.length}, Total rewards: ${earnings.reduce((s, e) => s + e.rewardAmount, BigInt(0))}`);

    return {
      epochId: this.currentEpoch + 1,
      startTime: Date.now() - (this.config.epochDurationHours * 3600000),
      endTime: Date.now(),
      merkleRoot: root,
      totalRewards: earnings.reduce((s, e) => s + e.rewardAmount, BigInt(0)),
      nodeCount: earnings.length
    };
  }

  /**
   * Generate Merkle proof for a node's claim
   */
  async generateClaimProof(wallet: string, epochId: number): Promise<string[] | null> {
    // Retrieve settlement data
    const settlement = db.prepare(`
      SELECT amount, merkle_root FROM settlements
      WHERE wallet = ? AND epoch_id = ?
    `).get(wallet, epochId) as { amount: number; merkle_root: string } | undefined;

    if (!settlement) return null;

    // In production, reconstruct tree and generate proof
    // For now, return empty proof (contract handles this)
    return [];
  }

  /**
   * Check if node has claimable rewards
   */
  async checkClaimable(wallet: string, epochId: number): Promise<bigint> {
    const settlement = db.prepare(`
      SELECT amount FROM settlements
      WHERE wallet = ? AND epoch_id = ? AND claimed_at IS NULL
    `).get(wallet, epochId) as { amount: number } | undefined;

    return settlement ? BigInt(settlement.amount) : BigInt(0);
  }

  /**
   * Mark settlement as claimed after on-chain claim
   */
  async markClaimed(wallet: string, epochId: number, txHash: string): Promise<void> {
    db.prepare(`
      UPDATE settlements
      SET claimed_at = ?, tx_hash = ?
      WHERE wallet = ? AND epoch_id = ?
    `).run(Date.now(), txHash, wallet, epochId);
  }

  /**
   * Get settlement stats
   */
  getStats(): {
    currentEpoch: number;
    totalSettled: bigint;
    totalClaimed: bigint;
    pendingClaims: number;
  } {
    const settled = db.prepare('SELECT SUM(amount) as total FROM settlements').get() as { total: number };
    const claimed = db.prepare('SELECT SUM(amount) as total FROM settlements WHERE claimed_at IS NOT NULL').get() as { total: number };
    const pending = db.prepare('SELECT COUNT(*) as count FROM settlements WHERE claimed_at IS NULL').get() as { count: number };

    return {
      currentEpoch: this.currentEpoch,
      totalSettled: BigInt(settled?.total || 0),
      totalClaimed: BigInt(claimed?.total || 0),
      pendingClaims: pending?.count || 0
    };
  }
}

// Singleton instance
let settlementService: SettlementService | null = null;

export function initSettlement(config: SettlementConfig): SettlementService {
  settlementService = new SettlementService(config);
  return settlementService;
}

export function getSettlementService(): SettlementService | null {
  return settlementService;
}

import { ethers } from 'ethers';
import type { 
  InferenceJob, 
  JobResult, 
  EscrowState,
  JobRegistryEvent,
  ZKProof 
} from './types.js';

/**
 * Smart Contract Interface Layer
 * 
 * AUDIT: All blockchain interactions must:
 * 1. Validate transaction parameters before submission
 * 2. Wait for sufficient confirmations before considering final
 * 3. Handle reorgs gracefully (check for replaced transactions)
 * 4. Never expose private keys in logs or errors
 */

// Contract ABIs (simplified for audit clarity)
const JOB_REGISTRY_ABI = [
  'function createJob(bytes32 jobId, string modelId, uint256 maxPrice, uint8 priority) external payable returns (bool)',
  'function assignJob(bytes32 jobId, address node) external returns (bool)',
  'function completeJob(bytes32 jobId, bytes calldata proof) external returns (bool)',
  'function disputeJob(bytes32 jobId) external returns (bool)',
  'function releasePayment(bytes32 jobId) external returns (bool)',
  'function refundJob(bytes32 jobId) external returns (bool)',
  'function getJobStatus(bytes32 jobId) external view returns (uint8)',
  'function getEscrow(bytes32 jobId) external view returns (uint256 amount, uint8 status, uint256 expiry)',
  'event JobCreated(bytes32 indexed jobId, address indexed user, string modelId, uint256 maxPrice)',
  'event JobAssigned(bytes32 indexed jobId, address indexed node)',
  'event JobCompleted(bytes32 indexed jobId, bytes proof)',
  'event JobDisputed(bytes32 indexed jobId)',
  'event PaymentReleased(bytes32 indexed jobId, address indexed node, uint256 amount)',
];

const TOKEN_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address recipient, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

const ZK_VERIFIER_ABI = [
  'function verifyProof(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool)',
];

/**
 * Gas estimation constants
 * AUDIT: These are upper bounds to prevent failed transactions
 * Actual gas used may be lower, but we never exceed these limits
 */
const GAS_LIMITS = {
  CREATE_JOB: 300000,
  ASSIGN_JOB: 150000,
  COMPLETE_JOB: 200000,
  DISPUTE_JOB: 100000,
  RELEASE_PAYMENT: 150000,
  REFUND_JOB: 100000,
  VERIFY_PROOF: 500000,  // ZK verification is expensive
} as const;

export class SynapseContracts {
  private readonly provider: ethers.Provider;
  private readonly signer?: ethers.Signer;
  private readonly jobRegistry: ethers.Contract;
  private readonly token: ethers.Contract;
  private readonly verifier: ethers.Contract;

  constructor(
    provider: ethers.Provider,
    contractAddresses: { jobRegistry: string; token: string; verifier: string },
    signer?: ethers.Signer
  ) {
    this.provider = provider;
    this.signer = signer;

    // AUDIT: Contract instances are immutable after creation
    this.jobRegistry = new ethers.Contract(
      contractAddresses.jobRegistry,
      JOB_REGISTRY_ABI,
      signer || provider
    );

    this.token = new ethers.Contract(
      contractAddresses.token,
      TOKEN_ABI,
      signer || provider
    );

    this.verifier = new ethers.Contract(
      contractAddresses.verifier,
      ZK_VERIFIER_ABI,
      provider  // Verifier is read-only from client side
    );
  }

  // ============================================================================
  // JOB REGISTRY OPERATIONS
  // ============================================================================

  /**
   * Create a new inference job with escrow
   * 
   * AUDIT: This locks user funds. Must verify:
   * 1. User has sufficient HSK balance
   * 2. Approved allowance covers maxPrice
   * 3. Job ID is unique (UUID collision check)
   * 4. Max price is reasonable (prevent fat-finger errors)
   */
  async createJob(
    job: Omit<InferenceJob, 'status' | 'createdAt' | 'expiresAt'>,
    options: { gasLimit?: number } = {}
  ): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new ContractError('Signer required for write operations');
    }

    // AUDIT: Validate job parameters on-chain
    const maxPriceWei = ethers.parseUnits(job.maxPrice, 18);
    
    // Check balance
    const address = await this.signer.getAddress();
    const balance = await this.token.balanceOf(address);
    if (balance < maxPriceWei) {
      throw new ContractError(
        `Insufficient HSK balance. Have: ${ethers.formatUnits(balance, 18)}, Need: ${job.maxPrice}`
      );
    }

    // Check allowance
    const allowance = await this.token.allowance(address, await this.jobRegistry.getAddress());
    if (allowance < maxPriceWei) {
      throw new ContractError(
        'Insufficient token allowance. Approve the job registry first.'
      );
    }

    // Validate max price (prevent errors > $10,000 equivalent)
    const maxPriceUsd = parseFloat(job.maxPrice);  // Assuming 1 HSK ≈ $1
    if (maxPriceUsd > 10000) {
      throw new ContractError(
        `Max price ${maxPriceUsd} exceeds safety limit. Contact support for large jobs.`
      );
    }

    const tx = await this.jobRegistry.createJob(
      ethers.keccak256(ethers.toUtf8Bytes(job.id)),
      job.modelId,
      maxPriceWei,
      this.priorityToUint(job.priority),
      {
        gasLimit: options.gasLimit || GAS_LIMITS.CREATE_JOB,
      }
    );

    return tx;
  }

  /**
   * Node assigns itself to a job
   * 
   * AUDIT: Nodes must stake collateral before assigning to prevent spam.
   * Stake amount should be proportional to job value to prevent griefing.
   */
  async assignJob(
    jobId: string,
    options: { gasLimit?: number } = {}
  ): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new ContractError('Signer required for write operations');
    }

    // AUDIT: Verify job is in pending state before attempting assignment
    const status = await this.getJobStatus(jobId);
    if (status !== 'pending') {
      throw new ContractError(`Job ${jobId} is not available for assignment (status: ${status})`);
    }

    const nodeAddress = await this.signer.getAddress();

    const tx = await this.jobRegistry.assignJob(
      ethers.keccak256(ethers.toUtf8Bytes(jobId)),
      nodeAddress,
      {
        gasLimit: options.gasLimit || GAS_LIMITS.ASSIGN_JOB,
      }
    );

    return tx;
  }

  /**
   * Complete job and submit proof
   * 
   * AUDIT: This is the critical security path. Proof must:
   * 1. Verify actual inference was performed
   * 2. Match the job parameters (input hash check)
   * 3. Be from the assigned node (prevent result stealing)
   * 4. Pass on-chain verification before payment
   */
  async completeJob(
    jobId: string,
    result: JobResult,
    options: { gasLimit?: number } = {}
  ): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new ContractError('Signer required for write operations');
    }

    // Verify proof off-chain first (cheaper than failing on-chain)
    const proofValid = await this.verifyProof(result.proof);
    if (!proofValid) {
      throw new ContractError('ZK proof verification failed');
    }

    // AUDIT: Serialize proof for on-chain submission
    const proofBytes = ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes', 'uint256[]'],
      [result.proof.proof, result.proof.publicInputs.map(x => BigInt(x))]
    );

    const tx = await this.jobRegistry.completeJob(
      ethers.keccak256(ethers.toUtf8Bytes(jobId)),
      proofBytes,
      {
        gasLimit: options.gasLimit || GAS_LIMITS.COMPLETE_JOB,
      }
    );

    return tx;
  }

  /**
   * User disputes job result
   * 
   * AUDIT: Disputes require bond to prevent spam. Bond is forfeited if
   * dispute is frivolous. This creates economic incentive for honesty.
   */
  async disputeJob(
    jobId: string,
    options: { gasLimit?: number } = {}
  ): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new ContractError('Signer required for write operations');
    }

    const tx = await this.jobRegistry.disputeJob(
      ethers.keccak256(ethers.toUtf8Bytes(jobId)),
      {
        gasLimit: options.gasLimit || GAS_LIMITS.DISPUTE_JOB,
      }
    );

    return tx;
  }

  /**
   * Release payment to node after successful completion
   */
  async releasePayment(
    jobId: string,
    options: { gasLimit?: number } = {}
  ): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new ContractError('Signer required for write operations');
    }

    const tx = await this.jobRegistry.releasePayment(
      ethers.keccak256(ethers.toUtf8Bytes(jobId)),
      {
        gasLimit: options.gasLimit || GAS_LIMITS.RELEASE_PAYMENT,
      }
    );

    return tx;
  }

  // ============================================================================
  // VIEW FUNCTIONS (no gas cost)
  // ============================================================================

  /**
   * Get current job status from chain
   */
  async getJobStatus(jobId: string): Promise<InferenceJob['status']> {
    const statusUint = await this.jobRegistry.getJobStatus(
      ethers.keccak256(ethers.toUtf8Bytes(jobId))
    );
    return this.uintToPriority(Number(statusUint));
  }

  /**
   * Get escrow state for a job
   */
  async getEscrow(jobId: string): Promise<EscrowState> {
    const [amount, status, expiry] = await this.jobRegistry.getEscrow(
      ethers.keccak256(ethers.toUtf8Bytes(jobId))
    );

    const statusMap: Record<number, EscrowState['status']> = {
      0: 'locked',
      1: 'released',
      2: 'refunded',
    };

    return {
      jobId,
      amount: ethers.formatUnits(amount, 18),
      status: statusMap[Number(status)] || 'locked',
      lockExpiry: new Date(Number(expiry) * 1000),
    };
  }

  /**
   * Verify ZK proof off-chain
   * 
   * AUDIT: This is a view function - no transaction needed.
   * Used for pre-validation before expensive on-chain submission.
   */
  async verifyProof(proof: ZKProof): Promise<boolean> {
    try {
      const result = await this.verifier.verifyProof(
        proof.proof,
        proof.publicInputs.map(x => BigInt(x))
      );
      return result;
    } catch (error) {
      console.error('Proof verification error:', error);
      return false;
    }
  }

  /**
   * Get HSK token balance
   */
  async getBalance(address: string): Promise<string> {
    const balance = await this.token.balanceOf(address);
    return ethers.formatUnits(balance, 18);
  }

  /**
   * Approve token spending for job registry
   */
  async approveTokens(
    amount: string,
    options: { gasLimit?: number } = {}
  ): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new ContractError('Signer required for write operations');
    }

    const amountWei = ethers.parseUnits(amount, 18);
    const registryAddress = await this.jobRegistry.getAddress();

    const tx = await this.token.approve(registryAddress, amountWei, {
      gasLimit: options.gasLimit || 100000,
    });

    return tx;
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  /**
   * Listen for job registry events
   * 
   * AUDIT: Event listeners should have automatic reconnection
   * and deduplication to prevent double-processing.
   */
  onJobCreated(callback: (event: JobRegistryEvent) => void): () => void {
    const filter = this.jobRegistry.filters.JobCreated() as ethers.ProviderEvent;
    
    const handler = (log: ethers.Log) => {
      const parsed = this.jobRegistry.interface.parseLog(log);
      if (!parsed) return;

      callback({
        event: 'JobCreated',
        jobId: parsed.args.jobId,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: new Date(),  // Would query block timestamp in production
        data: {
          user: parsed.args.user,
          modelId: parsed.args.modelId,
          maxPrice: ethers.formatUnits(parsed.args.maxPrice, 18),
        },
      });
    };

    this.provider.on(filter, handler);

    // Return unsubscribe function
    return () => this.provider.off(filter, handler);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private priorityToUint(priority: InferenceJob['priority']): number {
    const map: Record<InferenceJob['priority'], number> = {
      low: 0,
      normal: 1,
      high: 2,
      urgent: 3,
    };
    return map[priority];
  }

  private uintToPriority(uint: number): InferenceJob['status'] {
    // Map contract status enum to our status type
    const map: Record<number, InferenceJob['status']> = {
      0: 'pending',
      1: 'assigned',
      2: 'running',
      3: 'completed',
      4: 'failed',
      5: 'disputed',
    };
    return map[uint] || 'pending';
  }
}

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractError';
  }
}

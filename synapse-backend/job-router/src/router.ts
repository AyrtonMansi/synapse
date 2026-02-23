import P2PMesh, { JobOffer, JobMessage } from './mesh';
import { ethers } from 'ethers';
import winston from 'winston';

// Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// Types
interface JobRouterConfig {
  bootstrapPeers?: string[];
  networkId?: string;
  capabilities?: string[];
  maxConcurrentJobs?: number;
  minReputation?: number;
}

interface ActiveJob {
  jobId: string;
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed';
  creator: string;
  worker?: string;
  offer: JobOffer;
  createdAt: number;
  assignedAt?: number;
  completedAt?: number;
  resultCid?: string;
}

class JobRouter {
  private mesh: P2PMesh;
  private jobs: Map<string, ActiveJob> = new Map();
  private config: JobRouterConfig;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(config: JobRouterConfig = {}) {
    this.config = {
      maxConcurrentJobs: 5,
      minReputation: 50,
      capabilities: ['compute', 'storage'],
      ...config
    };
    
    this.mesh = new P2PMesh({
      bootstrapPeers: config.bootstrapPeers,
      networkId: config.networkId
    });

    this.setupEventHandlers();
  }

  /**
   * Start the job router
   */
  async start(listenAddrs?: string[]): Promise<void> {
    await this.mesh.start(listenAddrs);
    
    // Start heartbeat
    this.startHeartbeat();
    
    logger.info('Job Router started', {
      peerId: this.mesh.getNodeInfo()?.peerId,
      capabilities: this.config.capabilities
    });
  }

  /**
   * Stop the job router
   */
  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    await this.mesh.stop();
    logger.info('Job Router stopped');
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Handle job offers from the mesh
    this.mesh.on('job:offer', ({ from, job }: { from: string; job: JobOffer }) => {
      this.handleIncomingJobOffer(from, job);
    });

    // Handle job acceptance
    this.mesh.on('job:accepted', ({ jobId, worker }: { jobId: string; worker: string }) => {
      this.handleJobAccepted(jobId, worker);
    });

    // Handle job completion
    this.mesh.on('job:completed', ({ jobId, resultCid, worker }: { jobId: string; resultCid: string; worker: string }) => {
      this.handleJobCompleted(jobId, resultCid, worker);
    });

    // Handle peer connections
    this.mesh.on('peer:connect', (peerId: string) => {
      logger.info(`Peer connected: ${peerId}`);
    });

    this.mesh.on('peer:disconnect', (peerId: string) => {
      logger.info(`Peer disconnected: ${peerId}`);
      this.handlePeerDisconnect(peerId);
    });
  }

  /**
   * Submit a job to the network
   */
  async submitJob(jobType: string, inputCid: string, payment: string, requirements?: any): Promise<string> {
    const jobId = ethers.keccak256(
      ethers.solidityPacked(
        ['string', 'string', 'uint256'],
        [jobType, inputCid, Date.now()]
      )
    );

    const jobOffer: JobOffer = {
      jobId,
      jobType,
      inputCid,
      payment,
      timeout: 3600,
      requirements: {
        minReputation: requirements?.minReputation || this.config.minReputation!,
        capabilities: requirements?.capabilities || ['compute']
      }
    };

    // Store job locally
    this.jobs.set(jobId, {
      jobId,
      status: 'pending',
      creator: 'self',
      offer: jobOffer,
      createdAt: Date.now()
    });

    // Broadcast to network
    await this.mesh.broadcastJob(jobOffer);

    logger.info(`Job submitted: ${jobId}`, { jobType, payment });

    return jobId;
  }

  /**
   * Handle incoming job offer (as a worker)
   */
  private async handleIncomingJobOffer(from: string, job: JobOffer): Promise<void> {
    // Check if we should accept this job
    const currentJobs = Array.from(this.jobs.values()).filter(j => 
      j.status === 'running' && j.worker === 'self'
    ).length;

    if (currentJobs >= this.config.maxConcurrentJobs!) {
      return; // At capacity
    }

    // Check reputation of job creator
    const creatorReputation = this.mesh.getReputation(from);
    if (creatorReputation < 10) {
      logger.warn(`Rejecting job from low-reputation peer: ${from}`);
      return;
    }

    // Accept the job
    await this.mesh.acceptJob(job.jobId, from);
    
    // Track locally
    this.jobs.set(job.jobId, {
      jobId: job.jobId,
      status: 'running',
      creator: from,
      worker: 'self',
      offer: job,
      createdAt: Date.now(),
      assignedAt: Date.now()
    });

    logger.info(`Accepted job: ${job.jobId} from ${from}`);

    // Start job processing (in real implementation, this would execute the job)
    this.processJob(job);
  }

  /**
   * Process a job (placeholder - would integrate with actual compute)
   */
  private async processJob(job: JobOffer): Promise<void> {
    logger.info(`Processing job: ${job.jobId}`);
    
    // Simulate job processing
    // In real implementation, fetch input from IPFS, execute, store result
    setTimeout(async () => {
      // Mock result
      const resultCid = 'Qm' + ethers.randomBytes(32).toString('hex').slice(0, 44);
      
      await this.mesh.submitResult(job.jobId, resultCid, job.jobId);
      
      logger.info(`Job completed: ${job.jobId}`);
    }, 5000);
  }

  /**
   * Handle job accepted by worker
   */
  private handleJobAccepted(jobId: string, worker: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'assigned';
      job.worker = worker;
      job.assignedAt = Date.now();
      
      logger.info(`Job ${jobId} assigned to ${worker}`);
    }
  }

  /**
   * Handle job completed
   */
  private handleJobCompleted(jobId: string, resultCid: string, worker: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.resultCid = resultCid;
      job.completedAt = Date.now();
      
      // Update worker reputation positively
      this.mesh.updateReputation(worker, 5, 'Job completed successfully');
      
      logger.info(`Job ${jobId} completed by ${worker}`, { resultCid });
    }
  }

  /**
   * Handle peer disconnection
   */
  private handlePeerDisconnect(peerId: string): void {
    // Find jobs assigned to this peer and reassign
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.worker === peerId && job.status === 'running') {
        job.status = 'pending';
        job.worker = undefined;
        
        // Penalize peer for dropping
        this.mesh.updateReputation(peerId, -10, 'Disconnected during job execution');
        
        // Rebroadcast job
        this.mesh.broadcastJob(job.offer);
        
        logger.warn(`Reassigning job ${jobId} due to peer disconnect`);
      }
    }
  }

  /**
   * Start heartbeat to announce presence
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const heartbeat: JobMessage = {
        type: 'heartbeat',
        payload: {
          capabilities: this.config.capabilities,
          reputation: this.mesh.getMyReputation(),
          activeJobs: Array.from(this.jobs.values()).filter(j => j.status === 'running').length,
          version: '1.0.0'
        },
        timestamp: Date.now(),
        from: this.mesh.getNodeInfo()?.peerId || 'unknown'
      };

      this.mesh.publish(`synapse-${process.env.NETWORK_ID || 'mainnet'}-heartbeat`, heartbeat);
    }, 30000); // Every 30 seconds
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): ActiveJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): ActiveJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get stats
   */
  getStats(): any {
    const jobs = Array.from(this.jobs.values());
    
    return {
      totalJobs: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      running: jobs.filter(j => j.status === 'running').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      peers: this.mesh.getPeerCount(),
      reputation: this.mesh.getMyReputation()
    };
  }

  /**
   * Get mesh info
   */
  getMeshInfo(): any {
    return this.mesh.getNodeInfo();
  }
}

export default JobRouter;
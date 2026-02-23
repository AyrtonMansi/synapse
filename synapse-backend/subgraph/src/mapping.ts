import {
  BigInt,
  Bytes,
  Address,
  ethereum
} from '@graphprotocol/graph-ts';
import {
  JobCreated,
  JobAssigned,
  JobCompleted,
  JobCancelled,
  PaymentReleased,
  PaymentDisputed,
  ReputationUpdated
} from '../generated/SynapseJobManager/SynapseJobManager';
import {
  Job,
  User,
  Payment,
  Reputation,
  ReputationUpdate,
  NetworkStats
} from '../generated/schema';

// Helper to get or create user
function getOrCreateUser(address: Address): User {
  let user = User.load(address.toHex());
  
  if (!user) {
    user = new User(address.toHex());
    user.jobsCreatedCount = BigInt.zero();
    user.jobsCompletedCount = BigInt.zero();
    user.totalEarned = BigInt.zero();
    user.totalPaid = BigInt.zero();
    user.firstSeenAt = ethereum.getBlock()!.timestamp;
    user.lastActiveAt = ethereum.getBlock()!.timestamp;
    
    // Create initial reputation
    let reputation = new Reputation(address.toHex());
    reputation.user = address.toHex();
    reputation.score = BigInt.fromI32(100); // Starting score
    reputation.jobsCompleted = BigInt.zero();
    reputation.jobsFailed = BigInt.zero();
    reputation.disputesInitiated = BigInt.zero();
    reputation.disputesLost = BigInt.zero();
    reputation.lastUpdatedAt = ethereum.getBlock()!.timestamp;
    reputation.save();
    
    user.reputation = reputation.id;
    user.save();
    
    // Increment total users
    let stats = getOrCreateNetworkStats();
    stats.totalUsers = stats.totalUsers.plus(BigInt.fromI32(1));
    stats.save();
  }
  
  return user;
}

// Helper to get or create network stats
function getOrCreateNetworkStats(): NetworkStats {
  let stats = NetworkStats.load('singleton');
  
  if (!stats) {
    stats = new NetworkStats('singleton');
    stats.totalJobs = BigInt.zero();
    stats.pendingJobs = BigInt.zero();
    stats.activeJobs = BigInt.zero();
    stats.completedJobs = BigInt.zero();
    stats.cancelledJobs = BigInt.zero();
    stats.disputedJobs = BigInt.zero();
    stats.totalVolume = BigInt.zero();
    stats.totalPaidToWorkers = BigInt.zero();
    stats.averageJobValue = BigInt.zero();
    stats.totalUsers = BigInt.zero();
    stats.activeWorkers = BigInt.zero();
    stats.averageReputation = BigInt.fromI32(100);
    stats.lastUpdatedAt = ethereum.getBlock()!.timestamp;
  }
  
  return stats;
}

// Handler: JobCreated
export function handleJobCreated(event: JobCreated): void {
  let jobId = event.params.jobId.toHex();
  let creator = getOrCreateUser(event.params.creator);
  
  // Create job
  let job = new Job(jobId);
  job.jobType = event.params.jobType.toString();
  job.creator = creator.id;
  job.payment = event.params.payment;
  job.timeout = event.params.timeout;
  job.status = 'PENDING';
  job.createdAt = event.block.timestamp;
  job.inputCid = ''; // Would be set from call data
  job.save();
  
  // Update creator stats
  creator.jobsCreatedCount = creator.jobsCreatedCount.plus(BigInt.fromI32(1));
  creator.totalPaid = creator.totalPaid.plus(event.params.payment);
  creator.lastActiveAt = event.block.timestamp;
  creator.save();
  
  // Update network stats
  let stats = getOrCreateNetworkStats();
  stats.totalJobs = stats.totalJobs.plus(BigInt.fromI32(1));
  stats.pendingJobs = stats.pendingJobs.plus(BigInt.fromI32(1));
  stats.totalVolume = stats.totalVolume.plus(event.params.payment);
  stats.averageJobValue = stats.totalVolume.div(stats.totalJobs);
  stats.lastUpdatedAt = event.block.timestamp;
  stats.save();
}

// Handler: JobAssigned
export function handleJobAssigned(event: JobAssigned): void {
  let jobId = event.params.jobId.toHex();
  let job = Job.load(jobId);
  
  if (job) {
    let worker = getOrCreateUser(event.params.worker);
    
    job.worker = worker.id;
    job.status = 'ASSIGNED';
    job.assignedAt = event.block.timestamp;
    job.save();
    
    // Update worker
    worker.lastActiveAt = event.block.timestamp;
    worker.save();
    
    // Update stats
    let stats = getOrCreateNetworkStats();
    stats.pendingJobs = stats.pendingJobs.minus(BigInt.fromI32(1));
    stats.activeJobs = stats.activeJobs.plus(BigInt.fromI32(1));
    stats.save();
  }
}

// Handler: JobCompleted
export function handleJobCompleted(event: JobCompleted): void {
  let jobId = event.params.jobId.toHex();
  let job = Job.load(jobId);
  
  if (job && job.worker) {
    let worker = User.load(job.worker)!;
    
    job.resultCid = event.params.resultHash.toHex();
    job.status = 'COMPLETED';
    job.completedAt = event.block.timestamp;
    job.save();
    
    // Update worker stats
    worker.jobsCompletedCount = worker.jobsCompletedCount.plus(BigInt.fromI32(1));
    worker.lastActiveAt = event.block.timestamp;
    worker.save();
    
    // Update worker reputation
    let reputation = Reputation.load(worker.reputation)!;
    reputation.jobsCompleted = reputation.jobsCompleted.plus(BigInt.fromI32(1));
    reputation.score = reputation.score.plus(BigInt.fromI32(5));
    reputation.lastUpdatedAt = event.block.timestamp;
    reputation.save();
    
    // Update stats
    let stats = getOrCreateNetworkStats();
    stats.activeJobs = stats.activeJobs.minus(BigInt.fromI32(1));
    stats.completedJobs = stats.completedJobs.plus(BigInt.fromI32(1));
    stats.totalPaidToWorkers = stats.totalPaidToWorkers.plus(event.params.payout);
    stats.save();
  }
}

// Handler: JobCancelled
export function handleJobCancelled(event: JobCancelled): void {
  let jobId = event.params.jobId.toHex();
  let job = Job.load(jobId);
  
  if (job) {
    job.status = 'CANCELLED';
    job.cancelledAt = event.block.timestamp;
    job.save();
    
    // Update stats
    let stats = getOrCreateNetworkStats();
    if (job.status == 'PENDING') {
      stats.pendingJobs = stats.pendingJobs.minus(BigInt.fromI32(1));
    } else if (job.status == 'ASSIGNED') {
      stats.activeJobs = stats.activeJobs.minus(BigInt.fromI32(1));
    }
    stats.cancelledJobs = stats.cancelledJobs.plus(BigInt.fromI32(1));
    stats.save();
  }
}

// Handler: PaymentReleased
export function handlePaymentReleased(event: PaymentReleased): void {
  let paymentId = event.params.jobId.toHex();
  let payment = Payment.load(paymentId);
  
  if (!payment) {
    payment = new Payment(paymentId);
    payment.job = event.params.jobId.toHex();
    payment.sender = event.transaction.from.toHex();
    payment.recipient = event.params.recipient.toHex();
    payment.amount = event.params.amount;
    payment.createdAt = event.block.timestamp;
  }
  
  payment.status = 'RELEASED';
  payment.releasedAt = event.block.timestamp;
  payment.save();
  
  // Update recipient earnings
  let recipient = User.load(event.params.recipient.toHex())!;
  recipient.totalEarned = recipient.totalEarned.plus(event.params.amount);
  recipient.save();
}

// Handler: PaymentDisputed
export function handlePaymentDisputed(event: PaymentDisputed): void {
  let payment = Payment.load(event.params.jobId.toHex());
  
  if (payment) {
    payment.status = 'DISPUTED';
    payment.disputedAt = event.block.timestamp;
    payment.disputeReason = event.params.reason;
    payment.save();
  }
}

// Handler: ReputationUpdated
export function handleReputationUpdated(event: ReputationUpdated): void {
  let user = getOrCreateUser(event.params.user);
  let reputation = Reputation.load(user.reputation)!;
  
  // Create update record
  let updateId = event.transaction.hash.toHex() + '-' + event.logIndex.toString();
  let update = new ReputationUpdate(updateId);
  update.user = user.id;
  update.reputation = reputation.id;
  update.delta = event.params.delta;
  update.newScore = reputation.score.plus(event.params.delta);
  update.reason = event.params.reason;
  update.updatedBy = event.transaction.from.toHex();
  update.blockNumber = event.block.number;
  update.timestamp = event.block.timestamp;
  update.transactionHash = event.transaction.hash.toHex();
  update.save();
  
  // Update reputation
  reputation.score = update.newScore;
  reputation.lastUpdatedAt = event.block.timestamp;
  
  if (event.params.delta < BigInt.zero()) {
    reputation.disputesLost = reputation.disputesLost.plus(BigInt.fromI32(1));
  }
  
  reputation.save();
  
  // Update network average
  let stats = getOrCreateNetworkStats();
  stats.averageReputation = reputation.score; // Simplified - would calculate actual average
  stats.save();
}
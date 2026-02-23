const express = require('express');
const { ethers } = require('ethers');
const winston = require('winston');

const router = express.Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Job contract ABI
const JOB_CONTRACT_ABI = [
  "function createJob(bytes32 jobId, bytes32 jobType, uint256 maxPayment, uint256 timeout) external payable returns (bool)",
  "function cancelJob(bytes32 jobId) external",
  "function getJob(bytes32 jobId) external view returns (address creator, bytes32 jobType, uint256 payment, uint256 timeout, uint8 status)",
  "function getJobsByCreator(address creator) external view returns (bytes32[] memory)",
  "event JobCreated(bytes32 indexed jobId, address indexed creator, bytes32 jobType, uint256 payment, uint256 timeout)",
  "event JobAssigned(bytes32 indexed jobId, address indexed worker)",
  "event JobCompleted(bytes32 indexed jobId, bytes32 resultHash, uint256 payout)"
];

const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL || 'http://localhost:8545'
);

let jobContract = null;

function getJobContract() {
  if (!jobContract && process.env.JOB_CONTRACT) {
    jobContract = new ethers.Contract(
      process.env.JOB_CONTRACT,
      JOB_CONTRACT_ABI,
      provider
    );
  }
  return jobContract;
}

/**
 * @route GET /jobs
 * @desc Get jobs for authenticated user
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    const contract = getJobContract();
    
    if (!contract) {
      return res.status(503).json({ error: 'Job contract not configured' });
    }
    
    const jobIds = await contract.getJobsByCreator(req.walletAddress);
    
    const jobs = await Promise.all(
      jobIds.map(async (jobId) => {
        const job = await contract.getJob(jobId);
        return {
          jobId: jobId,
          creator: job.creator,
          jobType: ethers.decodeBytes32String(job.jobType),
          payment: job.payment.toString(),
          timeout: job.timeout.toString(),
          status: ['Pending', 'Assigned', 'Completed', 'Cancelled'][job.status]
        };
      })
    );
    
    res.json({ jobs });
  } catch (error) {
    logger.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

/**
 * @route GET /jobs/:jobId
 * @desc Get specific job details
 * @access Private
 */
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const contract = getJobContract();
    
    if (!contract) {
      return res.status(503).json({ error: 'Job contract not configured' });
    }
    
    const job = await contract.getJob(jobId);
    
    res.json({
      jobId,
      creator: job.creator,
      jobType: ethers.decodeBytes32String(job.jobType),
      payment: job.payment.toString(),
      timeout: job.timeout.toString(),
      status: ['Pending', 'Assigned', 'Completed', 'Cancelled'][job.status]
    });
  } catch (error) {
    logger.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

/**
 * @route POST /jobs
 * @desc Create a new job (returns tx data for client to sign)
 * @access Private
 */
router.post('/', async (req, res) => {
  try {
    const { jobType, inputHash, maxPayment, timeout } = req.body;
    
    if (!jobType || !inputHash || !maxPayment) {
      return res.status(400).json({ 
        error: 'Missing required fields: jobType, inputHash, maxPayment' 
      });
    }
    
    const contract = getJobContract();
    
    if (!contract) {
      return res.status(503).json({ error: 'Job contract not configured' });
    }
    
    // Generate unique job ID
    const jobId = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'string', 'uint256'],
        [req.walletAddress, inputHash, Date.now()]
      )
    );
    
    // Encode job type
    const encodedJobType = ethers.encodeBytes32String(jobType.slice(0, 31));
    
    // Create transaction data (client must sign and send)
    const txData = {
      to: process.env.JOB_CONTRACT,
      data: contract.interface.encodeFunctionData('createJob', [
        jobId,
        encodedJobType,
        maxPayment,
        timeout || 3600
      ]),
      value: maxPayment
    };
    
    res.json({
      jobId,
      transaction: txData,
      status: 'awaiting_signature'
    });
  } catch (error) {
    logger.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

/**
 * @route POST /jobs/:jobId/cancel
 * @desc Cancel a pending job
 * @access Private
 */
router.post('/:jobId/cancel', async (req, res) => {
  try {
    const { jobId } = req.params;
    const contract = getJobContract();
    
    if (!contract) {
      return res.status(503).json({ error: 'Job contract not configured' });
    }
    
    const txData = {
      to: process.env.JOB_CONTRACT,
      data: contract.interface.encodeFunctionData('cancelJob', [jobId])
    };
    
    res.json({
      jobId,
      transaction: txData,
      status: 'awaiting_signature'
    });
  } catch (error) {
    logger.error('Error cancelling job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

module.exports = router;
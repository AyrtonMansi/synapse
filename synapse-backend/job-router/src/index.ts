import JobRouter from './router';
import express from 'express';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

const app = express();
app.use(express.json());

// Initialize job router
const router = new JobRouter({
  bootstrapPeers: process.env.BOOTSTRAP_PEERS?.split(','),
  networkId: process.env.NETWORK_ID || 'mainnet-v1',
  capabilities: process.env.CAPABILITIES?.split(',') || ['compute', 'storage'],
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '5')
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    mesh: router.getMeshInfo(),
    stats: router.getStats()
  });
});

// Submit job endpoint
app.post('/jobs', async (req, res) => {
  try {
    const { jobType, inputCid, payment, requirements } = req.body;
    
    if (!jobType || !inputCid || !payment) {
      return res.status(400).json({ 
        error: 'Missing required fields: jobType, inputCid, payment' 
      });
    }
    
    const jobId = await router.submitJob(jobType, inputCid, payment, requirements);
    
    res.json({ jobId, status: 'submitted' });
  } catch (error) {
    logger.error('Error submitting job:', error);
    res.status(500).json({ error: 'Failed to submit job' });
  }
});

// Get job status
app.get('/jobs/:jobId', (req, res) => {
  const job = router.getJobStatus(req.params.jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
});

// Get all jobs
app.get('/jobs', (req, res) => {
  res.json({ jobs: router.getAllJobs() });
});

// Get stats
app.get('/stats', (req, res) => {
  res.json(router.getStats());
});

// Start server
const PORT = process.env.PORT || 4000;

async function start() {
  await router.start();
  
  app.listen(PORT, () => {
    logger.info(`Job Router API listening on port ${PORT}`);
  });
}

start().catch(error => {
  logger.error('Failed to start:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await router.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down...');
  await router.stop();
  process.exit(0);
});
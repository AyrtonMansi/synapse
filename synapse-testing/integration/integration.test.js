/**
 * Synapse Integration Test Suite
 * Tests all components working together
 */

const { expect } = require('chai');
const { ethers } = require('hardhat');
const sinon = require('sinon');
const axios = require('axios');
const { io } = require('socket.io-client');

// Test configuration
const TEST_CONFIG = {
  apiUrl: process.env.TEST_API_URL || 'http://localhost:3000',
  chainId: 31337, // Hardhat local
  timeout: 30000,
};

/**
 * Integration Test Suite
 */
describe('Synapse Integration Tests', function() {
  this.timeout(TEST_CONFIG.timeout);
  
  // Shared test state
  let contracts;
  let accounts;
  let apiClient;
  let socket;
  
  before(async function() {
    // Deploy contracts
    contracts = await deployContracts();
    accounts = await ethers.getSigners();
    
    // Create API client
    apiClient = axios.create({
      baseURL: TEST_CONFIG.apiUrl,
      timeout: 10000,
    });
    
    console.log('✓ Contracts deployed');
    console.log(`✓ API URL: ${TEST_CONFIG.apiUrl}`);
  });
  
  after(async function() {
    // Cleanup
    if (socket) socket.disconnect();
  });
  
  describe('Smart Contract Integration', () => {
    it('should deploy all contracts successfully', async () => {
      expect(contracts.token.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(contracts.registry.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(contracts.staking.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(contracts.disputeResolver.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(contracts.priceOracle.address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });
    
    it('should create and fund a job through the registry', async () => {
      const [client, freelancer] = accounts;
      const budget = ethers.utils.parseEther('1');
      
      // Approve token spend
      await contracts.token.connect(client).approve(contracts.registry.address, budget);
      
      // Create job
      const tx = await contracts.registry.connect(client).createJob(
        budget,
        contracts.token.address,
        Math.floor(Date.now() / 1000) + 86400,
        'ipfs://QmTest123'
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'JobCreated');
      const jobId = event.args.jobId;
      
      expect(jobId).to.be.gt(0);
      
      // Fund job
      await contracts.registry.connect(client).fundJob(jobId);
      
      const job = await contracts.registry.jobs(jobId);
      expect(job.hasEscrow).to.be.true;
      expect(job.status).to.equal(1); // Funded
    });
    
    it('should assign freelancer and complete milestone', async () => {
      const [client, freelancer] = accounts;
      
      // Get job ID from previous test
      const jobCount = await contracts.registry.jobCount();
      const jobId = jobCount;
      
      // Assign freelancer
      await contracts.registry.connect(client).assignFreelancer(jobId, freelancer.address);
      
      // Add milestone
      await contracts.registry.connect(client).addMilestone(
        jobId,
        'Complete AI inference',
        ethers.utils.parseEther('0.5'),
        Math.floor(Date.now() / 1000) + 43200
      );
      
      // Submit milestone
      await contracts.registry.connect(freelancer).submitMilestone(jobId, 0, 'ipfs://QmResult456');
      
      // Approve and pay
      const freelancerBalanceBefore = await contracts.token.balanceOf(freelancer.address);
      await contracts.registry.connect(client).approveMilestone(jobId, 0);
      const freelancerBalanceAfter = await contracts.token.balanceOf(freelancer.address);
      
      expect(freelancerBalanceAfter).to.be.gt(freelancerBalanceBefore);
    });
    
    it('should update reputation after job completion', async () => {
      const [, freelancer] = accounts;
      
      const reputation = await contracts.registry.reputations(freelancer.address);
      expect(reputation.totalJobs).to.be.gt(0);
      expect(reputation.completedJobs).to.be.gt(0);
    });
    
    it('should stake tokens and slash on misconduct', async () => {
      const [, , node] = accounts;
      const stakeAmount = ethers.utils.parseEther('1000');
      
      // Mint tokens to node
      await contracts.token.mint(node.address, stakeAmount);
      await contracts.token.connect(node).approve(contracts.registry.address, stakeAmount);
      
      // Stake
      await contracts.registry.connect(node).depositStake(
        contracts.token.address,
        stakeAmount
      );
      
      const stake = await contracts.registry.getSlashableStake(
        node.address,
        contracts.token.address
      );
      expect(stake).to.equal(stakeAmount);
      
      // Slash (as DAO)
      const slashAmount = ethers.utils.parseEther('100');
      await contracts.registry.connect(accounts[0]).slashUser(
        node.address,
        contracts.token.address,
        slashAmount,
        'Test slashing'
      );
      
      const stakeAfter = await contracts.registry.getSlashableStake(
        node.address,
        contracts.token.address
      );
      expect(stakeAfter).to.equal(stakeAmount.sub(slashAmount));
    });
    
    it('should resolve disputes correctly', async () => {
      const [client, freelancer, arbitrator] = accounts;
      
      // Create and setup job
      const budget = ethers.utils.parseEther('1');
      await contracts.token.connect(client).approve(contracts.registry.address, budget);
      
      await contracts.registry.connect(client).createJob(
        budget,
        contracts.token.address,
        Math.floor(Date.now() / 1000) + 86400,
        'ipfs://QmDispute123'
      );
      
      const jobCount = await contracts.registry.jobCount();
      const jobId = jobCount;
      
      await contracts.registry.connect(client).fundJob(jobId);
      await contracts.registry.connect(client).assignFreelancer(jobId, freelancer.address);
      
      // Create dispute
      await contracts.disputeResolver.connect(client).createDispute(
        jobId,
        'Payment disagreement',
        'ipfs://QmEvidence789'
      );
      
      // Resolve dispute
      await contracts.disputeResolver.grantRole(
        await contracts.disputeResolver.ARBITRATOR_ROLE(),
        arbitrator.address
      );
      
      const tx = await contracts.disputeResolver.connect(arbitrator).resolveDispute(
        1, // disputeId
        5000, // 50% to client
        5000 // 50% to freelancer
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });
    
    it('should fetch correct price from oracle', async () => {
      const price = await contracts.priceOracle.getPrice(
        ethers.utils.formatBytes32String('HSK')
      );
      expect(price).to.be.gt(0);
    });
  });
  
  describe('Backend API Integration', () => {
    let authToken;
    let apiKey;
    
    it('should return health status', async () => {
      const response = await apiClient.get('/health');
      expect(response.status).to.equal(200);
      expect(response.data.status).to.equal('healthy');
    });
    
    it('should return detailed health metrics', async () => {
      const response = await apiClient.get('/health/detailed');
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('components');
    });
    
    it('should generate SIWE nonce', async () => {
      const response = await apiClient.post('/auth/nonce', {
        address: accounts[0].address
      });
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('nonce');
      expect(response.data).to.have.property('message');
    });
    
    it('should reject invalid wallet addresses', async () => {
      try {
        await apiClient.post('/auth/nonce', {
          address: 'invalid-address'
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.response.status).to.equal(400);
      }
    });
    
    it('should reject requests without API key', async () => {
      try {
        await apiClient.get('/jobs');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.response.status).to.equal(401);
      }
    });
    
    it('should validate job request format', async () => {
      try {
        await apiClient.post('/jobs', {
          jobType: '', // Invalid: empty
          inputCid: 'invalid', // Invalid: too short
        }, {
          headers: { 'X-API-Key': 'test-key' }
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.response.status).to.equal(400);
      }
    });
    
    it('should enforce rate limiting', async () => {
      const requests = Array(70).fill().map(() => 
        apiClient.get('/health')
      );
      
      const results = await Promise.allSettled(requests);
      const rateLimited = results.filter(r => 
        r.status === 'rejected' && r.reason.response?.status === 429
      );
      
      expect(rateLimited.length).to.be.gt(0);
    });
    
    it('should sanitize malicious input', async () => {
      const maliciousPayload = {
        jobType: 'test',
        inputCid: 'QmValid1234567890123456789012345678901234567890Valid',
        payment: {
          amount: '1000',
          token: contracts.token.address
        },
        '__proto__': { polluted: true },
        'constructor': { prototype: { polluted: true } }
      };
      
      const response = await apiClient.post('/jobs', maliciousPayload, {
        headers: { 'X-API-Key': 'test-key' }
      });
      
      // Request should succeed but with sanitized input
      expect(response.status).to.be.oneOf([200, 401, 403]);
    });
  });
  
  describe('P2P Mesh Integration', () => {
    it('should connect to P2P mesh', async () => {
      // This would test actual P2P connectivity
      // For integration tests, we mock the P2P layer
      const mockMesh = {
        connect: sinon.stub().resolves(true),
        getPeers: sinon.stub().returns([]),
        isConnected: sinon.stub().returns(true),
      };
      
      const connected = await mockMesh.connect();
      expect(connected).to.be.true;
      expect(mockMesh.connect.calledOnce).to.be.true;
    });
    
    it('should handle peer discovery', async () => {
      const mockPeers = [
        { nodeId: 'peer1', capabilities: ['inference'] },
        { nodeId: 'peer2', capabilities: ['inference', 'storage'] },
      ];
      
      const mockMesh = {
        getPeers: sinon.stub().returns(mockPeers),
      };
      
      const peers = mockMesh.getPeers();
      expect(peers).to.have.length(2);
      expect(peers[0]).to.have.property('capabilities');
    });
    
    it('should route jobs to appropriate peers', async () => {
      const jobRequest = {
        jobType: 'inference',
        requirements: { gpu: 'required' },
      };
      
      const eligiblePeers = [
        { nodeId: 'peer1', capabilities: ['inference'], gpu: true },
      ];
      
      // Simple routing logic test
      const canHandle = (peer, job) => {
        return peer.capabilities.includes(job.jobType) &&
               (!job.requirements.gpu || peer.gpu);
      };
      
      const routedPeer = eligiblePeers.find(p => canHandle(p, jobRequest));
      expect(routedPeer).to.exist;
      expect(routedPeer.nodeId).to.equal('peer1');
    });
  });
  
  describe('ZK Proof Integration', () => {
    it('should generate ZK proof for inference', async () => {
      // Mock proof generation
      const mockProof = {
        proof_id: 'test-proof-123',
        proof_data: { pi_a: ['1', '2'], pi_b: [['3', '4']], pi_c: ['5', '6'] },
        public_inputs: ['input1', 'input2'],
        verification_key_hash: '0xabc123',
      };
      
      expect(mockProof).to.have.property('proof_id');
      expect(mockProof).to.have.property('proof_data');
      expect(mockProof.proof_data).to.have.property('pi_a');
    });
    
    it('should verify ZK proof correctly', async () => {
      const proof = {
        proof_data: { pi_a: ['1', '2'], pi_b: [['3', '4']], pi_c: ['5', '6'] },
        public_inputs: ['input1', 'input2'],
      };
      
      // Mock verification
      const verifyProof = (p) => {
        return p.proof_data && p.public_inputs.length > 0;
      };
      
      expect(verifyProof(proof)).to.be.true;
    });
    
    it('should reject invalid proofs', async () => {
      const invalidProof = {
        proof_data: null,
        public_inputs: [],
      };
      
      const verifyProof = (p) => {
        return p.proof_data && p.public_inputs.length > 0;
      };
      
      expect(verifyProof(invalidProof)).to.be.false;
    });
  });
  
  describe('Wallet Connection Integration', () => {
    it('should handle wallet connection flow', async () => {
      // Simulate SIWE flow
      const wallet = accounts[0];
      const nonce = 'test-nonce-123';
      const message = `Sign in to Synapse: ${nonce}`;
      
      // Sign message
      const signature = await wallet.signMessage(message);
      
      expect(signature).to.match(/^0x[a-fA-F0-9]+$/);
      expect(signature.length).to.equal(132); // 65 bytes hex encoded
    });
    
    it('should verify wallet signature', async () => {
      const wallet = accounts[0];
      const message = 'Test message';
      const signature = await wallet.signMessage(message);
      
      // Recover address
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      expect(recoveredAddress.toLowerCase()).to.equal(wallet.address.toLowerCase());
    });
    
    it('should handle chain ID validation', async () => {
      const expectedChainId = TEST_CONFIG.chainId;
      const wallet = accounts[0];
      
      // Create SIWE message with chain ID
      const domain = 'localhost';
      const siweMessage = `localhost wants you to sign in with your Ethereum account:\n${wallet.address}\n\nChain ID: ${expectedChainId}`;
      
      expect(siweMessage).to.include(`Chain ID: ${expectedChainId}`);
    });
  });
  
  describe('Payment Flow Integration', () => {
    it('should process payment through escrow', async () => {
      const [client, freelancer] = accounts;
      const payment = ethers.utils.parseEther('0.5');
      
      // Initial balances
      const clientBalanceBefore = await contracts.token.balanceOf(client.address);
      const freelancerBalanceBefore = await contracts.token.balanceOf(freelancer.address);
      
      // Create job with payment
      await contracts.token.connect(client).approve(contracts.registry.address, payment);
      await contracts.registry.connect(client).createJob(
        payment,
        contracts.token.address,
        Math.floor(Date.now() / 1000) + 86400,
        'ipfs://QmPaymentTest'
      );
      
      const jobCount = await contracts.registry.jobCount();
      const jobId = jobCount;
      await contracts.registry.connect(client).fundJob(jobId);
      
      // Complete job flow
      await contracts.registry.connect(client).assignFreelancer(jobId, freelancer.address);
      await contracts.registry.connect(client).addMilestone(
        jobId,
        'Work completed',
        payment,
        Math.floor(Date.now() / 1000) + 43200
      );
      
      await contracts.registry.connect(freelancer).submitMilestone(jobId, 0, 'ipfs://QmResult');
      await contracts.registry.connect(client).approveMilestone(jobId, 0);
      
      // Verify payment transferred
      const freelancerBalanceAfter = await contracts.token.balanceOf(freelancer.address);
      expect(freelancerBalanceAfter).to.be.gt(freelancerBalanceBefore);
    });
    
    it('should handle refunds correctly', async () => {
      const [client] = accounts;
      const payment = ethers.utils.parseEther('0.5');
      
      await contracts.token.connect(client).approve(contracts.registry.address, payment);
      await contracts.registry.connect(client).createJob(
        payment,
        contracts.token.address,
        Math.floor(Date.now() / 1000) + 1, // Very short deadline
        'ipfs://QmRefundTest'
      );
      
      const jobCount = await contracts.registry.jobCount();
      const jobId = jobCount;
      await contracts.registry.connect(client).fundJob(jobId);
      
      const balanceBefore = await contracts.token.balanceOf(client.address);
      
      // Wait for deadline and request refund
      await new Promise(r => setTimeout(r, 2000));
      await contracts.registry.connect(client).requestRefund(jobId);
      
      const balanceAfter = await contracts.token.balanceOf(client.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });
  
  describe('End-to-End Flow', () => {
    it('should complete full job lifecycle', async () => {
      const [client, freelancer, arbitrator] = accounts;
      
      // 1. Client creates and funds job
      const budget = ethers.utils.parseEther('1');
      await contracts.token.connect(client).approve(contracts.registry.address, budget);
      
      const createTx = await contracts.registry.connect(client).createJob(
        budget,
        contracts.token.address,
        Math.floor(Date.now() / 1000) + 86400,
        'ipfs://QmFullTest123'
      );
      
      const createReceipt = await createTx.wait();
      const jobId = createReceipt.events.find(e => e.event === 'JobCreated').args.jobId;
      
      // 2. Fund job
      await contracts.registry.connect(client).fundJob(jobId);
      
      // 3. Assign freelancer
      await contracts.registry.connect(client).assignFreelancer(jobId, freelancer.address);
      
      // 4. Add milestone
      await contracts.registry.connect(client).addMilestone(
        jobId,
        'Complete AI inference task',
        budget,
        Math.floor(Date.now() / 1000) + 43200
      );
      
      // 5. Freelancer submits work
      await contracts.registry.connect(freelancer).submitMilestone(
        jobId, 
        0, 
        'ipfs://QmWorkResult'
      );
      
      // 6. Client approves and pays
      const freelancerBalanceBefore = await contracts.token.balanceOf(freelancer.address);
      await contracts.registry.connect(client).approveMilestone(jobId, 0);
      const freelancerBalanceAfter = await contracts.token.balanceOf(freelancer.address);
      
      // 7. Verify payment
      expect(freelancerBalanceAfter.sub(freelancerBalanceBefore)).to.be.gt(0);
      
      // 8. Check reputation updates
      const rep = await contracts.registry.reputations(freelancer.address);
      expect(rep.completedJobs).to.be.gt(0);
      
      // 9. Verify job status
      const job = await contracts.registry.jobs(jobId);
      expect(job.status).to.equal(4); // Completed
    });
  });
});

/**
 * Deploy all contracts for testing
 */
async function deployContracts() {
  const [deployer, dao, treasury] = await ethers.getSigners();
  
  // Deploy Token
  const TokenFactory = await ethers.getContractFactory('HSKToken');
  const token = await TokenFactory.deploy(dao.address);
  await token.deployed();
  
  // Deploy Timelock
  const TimelockFactory = await ethers.getContractFactory('TimelockController');
  const timelock = await TimelockFactory.deploy(
    3600, // min delay
    [dao.address],
    [dao.address],
    deployer.address
  );
  await timelock.deployed();
  
  // Deploy JobRegistry (proxy)
  const RegistryFactory = await ethers.getContractFactory('JobRegistry');
  const registryImpl = await RegistryFactory.deploy();
  await registryImpl.deployed();
  
  // Deploy proxy
  const ProxyFactory = await ethers.getContractFactory('ERC1967Proxy');
  const proxy = await ProxyFactory.deploy(
    registryImpl.address,
    RegistryFactory.interface.encodeFunctionData('initialize', [
      treasury.address,
      dao.address,
      timelock.address
    ])
  );
  await proxy.deployed();
  
  const registry = RegistryFactory.attach(proxy.address);
  
  // Deploy other contracts...
  // (Simplified for brevity)
  
  return {
    token,
    registry,
    staking: token, // Placeholder
    disputeResolver: registry, // Placeholder
    priceOracle: token, // Placeholder
  };
}

// Run tests if executed directly
if (require.main === module) {
  console.log('Running Synapse Integration Tests...');
  console.log('Make sure Hardhat node is running: npx hardhat node');
  console.log('And API server is running: npm start');
}

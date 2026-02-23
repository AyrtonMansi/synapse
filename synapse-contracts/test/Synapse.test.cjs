const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Synapse Contract Suite", function () {
  let hskToken, treasuryDAO, jobRegistry, disputeResolver, priceOracle, streamingPayments;
  let deployer, dao, client, freelancer, arbitrator, other;

  beforeEach(async function () {
    [deployer, dao, client, freelancer, arbitrator, other] = await ethers.getSigners();

    // Deploy HSKToken
    const HSKTokenFactory = await ethers.getContractFactory("HSKToken");
    hskToken = await HSKTokenFactory.deploy(dao.address, dao.address);
    await hskToken.waitForDeployment();

    // Deploy TreasuryDAO
    const TreasuryDAOFactory = await ethers.getContractFactory("TreasuryDAO");
    treasuryDAO = await TreasuryDAOFactory.deploy(await hskToken.getAddress(), [dao.address]);
    await treasuryDAO.waitForDeployment();

    // Deploy JobRegistry
    const JobRegistryFactory = await ethers.getContractFactory("JobRegistry");
    jobRegistry = await JobRegistryFactory.deploy(
      await treasuryDAO.getAddress(),
      dao.address
    );
    await jobRegistry.waitForDeployment();

    // Deploy DisputeResolver
    const DisputeResolverFactory = await ethers.getContractFactory("DisputeResolver");
    disputeResolver = await DisputeResolverFactory.deploy(dao.address);
    await disputeResolver.waitForDeployment();

    // Deploy PriceOracle
    const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracleFactory.deploy(dao.address);
    await priceOracle.waitForDeployment();

    // Deploy StreamingPayments
    const StreamingPaymentsFactory = await ethers.getContractFactory("StreamingPayments");
    streamingPayments = await StreamingPaymentsFactory.deploy(
      await treasuryDAO.getAddress(),
      dao.address
    );
    await streamingPayments.waitForDeployment();

    // Setup
    await jobRegistry.connect(dao).setDisputeResolver(await disputeResolver.getAddress());
    const DISPUTE_RESOLVER_ROLE = await jobRegistry.DISPUTE_RESOLVER_ROLE();
    await jobRegistry.connect(dao).grantRole(DISPUTE_RESOLVER_ROLE, await disputeResolver.getAddress());
    
    await streamingPayments.connect(dao).addSupportedToken(await hskToken.getAddress());

    // Register arbitrator
    await disputeResolver.connect(dao).registerArbitrator(
      arbitrator.address,
      ethers.parseEther("0.1"),
      100, // 1%
      7 * 24 * 60 * 60, // 7 days evidence period
      3 * 24 * 60 * 60, // 3 days vote period
      2 * 24 * 60 * 60, // 2 days appeal period
      await treasuryDAO.getAddress() // Fee recipient
    );

    // Distribute tokens
    await hskToken.connect(dao).transfer(client.address, ethers.parseEther("10000"));
    await hskToken.connect(dao).transfer(freelancer.address, ethers.parseEther("5000"));
  });

  describe("HSKToken", function () {
    it("Should have correct initial parameters", async function () {
      expect(await hskToken.name()).to.equal("Synapse");
      expect(await hskToken.symbol()).to.equal("HSK");
      expect(await hskToken.totalSupply()).to.equal(ethers.parseEther("20000000"));
      
      const daoBalance = await hskToken.balanceOf(dao.address);
      expect(daoBalance).to.equal(ethers.parseEther("20000000") - ethers.parseEther("15000"));
    });

    it("Should create vesting schedule", async function () {
      const amount = ethers.parseEther("1000");
      const latestBlock = await ethers.provider.getBlock("latest");
      const startTime = latestBlock.timestamp + 100;
      const duration = 365 * 24 * 60 * 60; // 1 year
      const cliff = 90 * 24 * 60 * 60; // 3 months

      await hskToken.connect(dao).approve(await hskToken.getAddress(), amount);
      await hskToken.connect(dao).createVestingSchedule(
        freelancer.address,
        amount,
        startTime,
        duration,
        cliff,
        true
      );

      const schedule = await hskToken.vestingSchedules(freelancer.address);
      expect(schedule.totalAmount).to.equal(amount);
      expect(schedule.startTime).to.equal(startTime);
      expect(schedule.duration).to.equal(duration);
    });

    it("Should mint mining rewards", async function () {
      const blocks = 100;
      const expectedReward = await hskToken.calculateMiningReward(blocks);
      
      const initialSupply = await hskToken.totalSupply();
      await hskToken.connect(dao).mintMiningReward(freelancer.address, blocks);
      const finalSupply = await hskToken.totalSupply();

      expect(finalSupply - initialSupply).to.equal(expectedReward);
    });

    it("Should not exceed mining cap", async function () {
      const miningCap = await hskToken.miningCap();
      const rate = await hskToken.MINING_EMISSION_RATE();
      const maxBlocks = Number(miningCap / rate);

      await expect(
        hskToken.connect(dao).mintMiningReward(freelancer.address, maxBlocks + 1000)
      ).to.be.revertedWith("HSKToken: mining cap exceeded");
    });

    it("Should allow releasing vested tokens after cliff", async function () {
      const amount = ethers.parseEther("1000");
      const latestBlock = await ethers.provider.getBlock("latest");
      const startTime = latestBlock.timestamp;
      const duration = 100; // short for testing
      const cliff = 10;

      await hskToken.connect(dao).approve(await hskToken.getAddress(), amount);
      await hskToken.connect(dao).createVestingSchedule(
        freelancer.address,
        amount,
        startTime,
        duration,
        cliff,
        true
      );

      // Before cliff - nothing to release
      await expect(
        hskToken.releaseVestedTokens(freelancer.address)
      ).to.be.revertedWith("HSKToken: no tokens to release");

      // After vesting period
      await ethers.provider.send("evm_increaseTime", [150]);
      await ethers.provider.send("evm_mine", []);

      const vested = await hskToken.releasableAmount(freelancer.address);
      expect(vested).to.be.gt(0);

      await hskToken.releaseVestedTokens(freelancer.address);
      const newBalance = await hskToken.balanceOf(freelancer.address);
      expect(newBalance).to.be.gt(ethers.parseEther("5000"));
    });

    it("Should allow DAO to revoke vesting", async function () {
      const amount = ethers.parseEther("1000");
      const latestBlock = await ethers.provider.getBlock("latest");
      const startTime = latestBlock.timestamp;

      await hskToken.connect(dao).approve(await hskToken.getAddress(), amount);
      await hskToken.connect(dao).createVestingSchedule(
        freelancer.address,
        amount,
        startTime,
        1000,
        0,
        true
      );

      await hskToken.connect(dao).revokeVesting(freelancer.address);
      
      const schedule = await hskToken.vestingSchedules(freelancer.address);
      expect(schedule.revoked).to.be.true;
    });

    it("Should allow DAO transfer", async function () {
      await hskToken.connect(dao).transferDAORole(other.address);
      
      const DAO_ROLE = await hskToken.DAO_ROLE();
      expect(await hskToken.hasRole(DAO_ROLE, other.address)).to.be.true;
      expect(await hskToken.hasRole(DAO_ROLE, dao.address)).to.be.false;
    });
  });

  describe("TreasuryDAO", function () {
    it("Should create and execute proposal", async function () {
      const transferAmount = ethers.parseEther("100");
      
      // Fund treasury
      await hskToken.connect(dao).transfer(await treasuryDAO.getAddress(), ethers.parseEther("1000"));

      // Create proposal to transfer funds
      const targets = [await hskToken.getAddress()];
      const values = [0];
      const calldata = hskToken.interface.encodeFunctionData("transfer", [client.address, transferAmount]);
      const calldatas = [calldata];
      
      await treasuryDAO.connect(dao).propose(targets, values, calldatas, "Test proposal");

      const proposalId = 1;
      expect(await treasuryDAO.proposalCount()).to.equal(1);

      // Vote
      await treasuryDAO.connect(dao).castVote(proposalId, 1); // For
      await treasuryDAO.connect(client).castVote(proposalId, 1); // For
      
      // Check votes
      const proposal = await treasuryDAO.proposals(proposalId);
      expect(proposal.forVotes).to.be.gt(0);

      // Advance time past voting period
      await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      // Execute
      const initialBalance = await hskToken.balanceOf(client.address);
      await treasuryDAO.execute(proposalId);
      
      expect(await hskToken.balanceOf(client.address)).to.equal(initialBalance + transferAmount);
    });

    it("Should handle ETH deposits", async function () {
      const depositAmount = ethers.parseEther("1");
      
      await deployer.sendTransaction({
        to: await treasuryDAO.getAddress(),
        value: depositAmount
      });

      expect(await treasuryDAO.getETHBalance()).to.equal(depositAmount);
    });

    it("Should not allow non-token holders to propose", async function () {
      await expect(
        treasuryDAO.connect(other).propose([], [], [], "Test")
      ).to.be.revertedWith("TreasuryDAO: must hold tokens");
    });
  });

  describe("JobRegistry", function () {
    beforeEach(async function () {
      await hskToken.connect(client).approve(await jobRegistry.getAddress(), ethers.parseEther("1000"));
    });

    it("Should create and fund a job", async function () {
      const budget = ethers.parseEther("100");
      const latestBlock = await ethers.provider.getBlock("latest");
      const deadline = latestBlock.timestamp + 30 * 24 * 60 * 60;

      await jobRegistry.connect(client).createJob(
        budget,
        await hskToken.getAddress(),
        deadline,
        "ipfs://QmTest"
      );

      expect(await jobRegistry.jobCount()).to.equal(1);

      const job = await jobRegistry.jobs(1);
      expect(job.client).to.equal(client.address);
      expect(job.totalBudget).to.equal(budget);

      // Fund the job
      await jobRegistry.connect(client).fundJob(1);
      
      const fundedJob = await jobRegistry.jobs(1);
      expect(fundedJob.status).to.equal(1); // Funded
      expect(fundedJob.hasEscrow).to.be.true;
    });

    it("Should complete job workflow with milestones", async function () {
      const budget = ethers.parseEther("100");
      const latestBlock = await ethers.provider.getBlock("latest");
      const deadline = latestBlock.timestamp + 30 * 24 * 60 * 60;

      // Create and fund job
      await jobRegistry.connect(client).createJob(budget, await hskToken.getAddress(), deadline, "ipfs://QmTest");
      await jobRegistry.connect(client).fundJob(1);

      // Assign freelancer
      await jobRegistry.connect(client).assignFreelancer(1, freelancer.address);

      // Add milestone
      const milestoneAmount = ethers.parseEther("50");
      await jobRegistry.connect(client).addMilestone(1, "First milestone", milestoneAmount, deadline);

      // Start and submit milestone
      await jobRegistry.connect(freelancer).startMilestone(1, 0);
      await jobRegistry.connect(freelancer).submitMilestone(1, 0, "ipfs://QmDeliverable");

      // Approve milestone
      const freelancerBalanceBefore = await hskToken.balanceOf(freelancer.address);
      await jobRegistry.connect(client).approveMilestone(1, 0);
      const freelancerBalanceAfter = await hskToken.balanceOf(freelancer.address);

      // Check payment received (minus fee)
      expect(freelancerBalanceAfter).to.be.gt(freelancerBalanceBefore);

      // Check job status
      const job = await jobRegistry.jobs(1);
      expect(job.status).to.equal(4); // Completed

      // Check reputation updated
      const reputation = await jobRegistry.reputations(freelancer.address);
      expect(reputation.completedJobs).to.equal(1);
      expect(reputation.totalEarned).to.be.gt(0);
    });

    it("Should allow rating after completion", async function () {
      // Setup and complete job
      const latestBlock = await ethers.provider.getBlock("latest");
      const deadline = latestBlock.timestamp + 30 * 24 * 60 * 60;

      await jobRegistry.connect(client).createJob(
        ethers.parseEther("100"),
        await hskToken.getAddress(),
        deadline,
        "ipfs://QmTest"
      );
      await jobRegistry.connect(client).fundJob(1);
      await jobRegistry.connect(client).assignFreelancer(1, freelancer.address);
      await jobRegistry.connect(client).addMilestone(1, "Milestone", ethers.parseEther("100"), deadline);
      await jobRegistry.connect(freelancer).startMilestone(1, 0);
      await jobRegistry.connect(freelancer).submitMilestone(1, 0, "ipfs://QmDeliverable");
      await jobRegistry.connect(client).approveMilestone(1, 0);

      // Rate freelancer
      await jobRegistry.connect(client).rateParty(1, 5);

      const [rating, count] = await jobRegistry.getAverageRating(freelancer.address);
      expect(rating).to.equal(500); // 5.00
      expect(count).to.equal(1);
    });

    it("Should handle dispute resolution", async function () {
      // Setup job
      const latestBlock = await ethers.provider.getBlock("latest");
      const deadline = latestBlock.timestamp + 30 * 24 * 60 * 60;

      await jobRegistry.connect(client).createJob(
        ethers.parseEther("100"),
        await hskToken.getAddress(),
        deadline,
        "ipfs://QmTest"
      );
      await jobRegistry.connect(client).fundJob(1);
      await jobRegistry.connect(client).assignFreelancer(1, freelancer.address);

      // Open dispute
      await jobRegistry.connect(client).openDispute(1, 1);

      const job = await jobRegistry.jobs(1);
      expect(job.status).to.equal(5); // Disputed

      // Resolve dispute (50/50 split)
      const clientBalanceBefore = await hskToken.balanceOf(client.address);
      await jobRegistry.connect(disputeResolver).resolveDispute(1, 5000, 5000);
      const clientBalanceAfter = await hskToken.balanceOf(client.address);

      expect(clientBalanceAfter).to.be.gt(clientBalanceBefore);
    });
  });

  describe("DisputeResolver", function () {
    beforeEach(async function () {
      await hskToken.connect(client).approve(await jobRegistry.getAddress(), ethers.parseEther("100"));
      const latestBlock = await ethers.provider.getBlock("latest");
      const deadline = latestBlock.timestamp + 30 * 24 * 60 * 60;

      await jobRegistry.connect(client).createJob(
        ethers.parseEther("100"),
        await hskToken.getAddress(),
        deadline,
        "ipfs://QmTest"
      );
      await jobRegistry.connect(client).fundJob(1);
      await jobRegistry.connect(client).assignFreelancer(1, freelancer.address);
    });

    it("Should create and resolve dispute", async function () {
      await disputeResolver.connect(client).createDispute(
        1, // jobId
        client.address,
        freelancer.address,
        ethers.parseEther("100"),
        await hskToken.getAddress(),
        "ipfs://QmEvidence",
        arbitrator.address
      );

      expect(await disputeResolver.disputeCount()).to.equal(1);

      const dispute = await disputeResolver.disputes(1);
      expect(dispute.client).to.equal(client.address);
      expect(dispute.status).to.equal(1); // Open

      // Start voting
      await disputeResolver.connect(arbitrator).startVoting(1);

      // Cast vote
      await disputeResolver.connect(arbitrator).castVote(1, 2); // Freelancer wins

      // Advance time
      await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      // Resolve
      await disputeResolver.connect(arbitrator).resolveDispute(1, 2, 0, 10000);

      const resolved = await disputeResolver.disputes(1);
      expect(resolved.status).to.equal(5); // Resolved
      expect(resolved.ruling).to.equal(2); // Freelancer wins
    });

    it("Should allow appeals", async function () {
      // Create dispute
      await disputeResolver.connect(client).createDispute(
        1, client.address, freelancer.address,
        ethers.parseEther("100"), await hskToken.getAddress(),
        "ipfs://QmEvidence", arbitrator.address
      );

      // Resolve quickly
      await disputeResolver.connect(arbitrator).startVoting(1);
      await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await disputeResolver.connect(arbitrator).resolveDispute(1, 1, 10000, 0); // Client wins

      // Appeal
      await disputeResolver.connect(freelancer).fileAppeal(1, 0, "ipfs://QmAppeal");
      
      expect(await disputeResolver.disputeCount()).to.equal(2);
    });
  });

  describe("PriceOracle", function () {
    it("Should add and read price feed", async function () {
      // Deploy mock Chainlink aggregator
      const MockAggregator = await ethers.getContractFactory("MockAggregator");
      const mockAggregator = await MockAggregator.deploy();
      await mockAggregator.waitForDeployment();

      await mockAggregator.setPrice(2000 * 10**8); // $2000

      await priceOracle.connect(dao).addPriceFeed(
        ethers.encodeBytes32String("ETH"),
        await mockAggregator.getAddress(),
        3600 // 1 hour heartbeat
      );

      const [price, decimals, timestamp] = await priceOracle.getLatestPrice(ethers.encodeBytes32String("ETH"));
      expect(price).to.equal(2000 * 10**8);
      expect(decimals).to.equal(8);
    });

    it("Should convert between assets", async function () {
      // Deploy two mock aggregators
      const MockAggregator = await ethers.getContractFactory("MockAggregator");
      
      const ethFeed = await MockAggregator.deploy();
      await ethFeed.waitForDeployment();
      await ethFeed.setPrice(2000 * 10**8);

      const hskFeed = await MockAggregator.deploy();
      await hskFeed.waitForDeployment();
      await hskFeed.setPrice(10 * 10**8); // $10

      await priceOracle.connect(dao).addPriceFeed(
        ethers.encodeBytes32String("ETH"),
        await ethFeed.getAddress(),
        3600
      );
      await priceOracle.connect(dao).addPriceFeed(
        ethers.encodeBytes32String("HSK"),
        await hskFeed.getAddress(),
        3600
      );

      // Convert 1 ETH to HSK (200 HSK = 1 ETH)
      const converted = await priceOracle.convert(
        ethers.encodeBytes32String("ETH"),
        ethers.encodeBytes32String("HSK"),
        ethers.parseEther("1")
      );

      expect(converted).to.be.closeTo(ethers.parseEther("200"), ethers.parseEther("1"));
    });

    it("Should detect stale prices", async function () {
      const MockAggregator = await ethers.getContractFactory("MockAggregator");
      const mockAggregator = await MockAggregator.deploy();
      await mockAggregator.waitForDeployment();
      await mockAggregator.setPrice(2000 * 10**8);

      await priceOracle.connect(dao).addPriceFeed(
        ethers.encodeBytes32String("ETH"),
        await mockAggregator.getAddress(),
        1 // Very short heartbeat
      );

      // Initially healthy
      expect(await priceOracle.isFeedHealthy(ethers.encodeBytes32String("ETH"))).to.be.true;

      // Advance time
      await ethers.provider.send("evm_increaseTime", [7200]); // 2 hours
      await ethers.provider.send("evm_mine", []);

      // Now stale
      expect(await priceOracle.isFeedHealthy(ethers.encodeBytes32String("ETH"))).to.be.false;
    });
  });

  describe("StreamingPayments", function () {
    beforeEach(async function () {
      await hskToken.connect(client).approve(await streamingPayments.getAddress(), ethers.parseEther("1000"));
    });

    it("Should create and withdraw from stream", async function () {
      const rate = ethers.parseEther("0.001"); // 0.001 HSK per second
      const duration = 3600; // 1 hour
      const deposit = rate * BigInt(duration);

      await streamingPayments.connect(client).createStream(
        freelancer.address,
        await hskToken.getAddress(),
        rate,
        deposit,
        duration
      );

      expect(await streamingPayments.streamCount()).to.equal(1);

      const stream = await streamingPayments.streams(1);
      expect(stream.sender).to.equal(client.address);
      expect(stream.recipient).to.equal(freelancer.address);
      expect(stream.ratePerSecond).to.equal(rate);

      // Advance time
      await ethers.provider.send("evm_increaseTime", [1800]); // 30 minutes
      await ethers.provider.send("evm_mine", []);

      const withdrawable = await streamingPayments.calculateWithdrawableAmount(1);
      expect(withdrawable).to.be.closeTo(rate * BigInt(1800), ethers.parseEther("0.1"));

      // Withdraw
      const balanceBefore = await hskToken.balanceOf(freelancer.address);
      await streamingPayments.connect(freelancer).withdrawFromStream(1);
      const balanceAfter = await hskToken.balanceOf(freelancer.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should allow sender to cancel stream", async function () {
      const rate = ethers.parseEther("0.001");
      const duration = 3600;
      const deposit = rate * BigInt(duration);

      await streamingPayments.connect(client).createStream(
        freelancer.address,
        await hskToken.getAddress(),
        rate,
        deposit,
        duration
      );

      // Advance time partially
      await ethers.provider.send("evm_increaseTime", [1800]);
      await ethers.provider.send("evm_mine", []);

      const clientBalanceBefore = await hskToken.balanceOf(client.address);
      
      // Cancel
      await streamingPayments.connect(client).cancelStream(1);

      const clientBalanceAfter = await hskToken.balanceOf(client.address);
      
      // Should have received refund
      expect(clientBalanceAfter).to.be.gt(clientBalanceBefore);

      const stream = await streamingPayments.streams(1);
      expect(stream.isActive).to.be.false;
    });

    it("Should not allow non-recipient to withdraw", async function () {
      const rate = ethers.parseEther("0.001");
      const duration = 3600;
      const deposit = rate * BigInt(duration);

      await streamingPayments.connect(client).createStream(
        freelancer.address,
        await hskToken.getAddress(),
        rate,
        deposit,
        duration
      );

      await expect(
        streamingPayments.connect(other).withdrawFromStream(1)
      ).to.be.revertedWith("StreamingPayments: not recipient");
    });
  });
});
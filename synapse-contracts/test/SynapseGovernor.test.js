const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SynapseGovernor", function () {
  let governor;
  let timelock;
  let governanceToken;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  const VOTING_PERIOD = 3 * 24 * 60 * 60; // 3 days
  const QUORUM = ethers.parseUnits("1000", 18);
  const PROPOSAL_THRESHOLD = ethers.parseUnits("100", 18);

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Deploy mock governance token
    const MockToken = await ethers.getContractFactory("MockERC20");
    governanceToken = await MockToken.deploy("Governance Token", "GOV", 18);
    await governanceToken.waitForDeployment();

    // Mint tokens to users
    await governanceToken.mint(owner.address, ethers.parseUnits("10000", 18));
    await governanceToken.mint(addr1.address, ethers.parseUnits("5000", 18));
    await governanceToken.mint(addr2.address, ethers.parseUnits("5000", 18));

    // Deploy timelock
    const Timelock = await ethers.getContractFactory("SynapseTimelock");
    timelock = await Timelock.deploy(
      2 * 24 * 60 * 60, // 2 days min delay
      30 * 24 * 60 * 60, // 30 days max delay
      14 * 24 * 60 * 60, // 14 days grace period
      owner.address
    );
    await timelock.waitForDeployment();

    // Deploy governor
    const Governor = await ethers.getContractFactory("SynapseGovernor");
    governor = await Governor.deploy(
      await governanceToken.getAddress(),
      await timelock.getAddress(),
      QUORUM,
      VOTING_PERIOD
    );
    await governor.waitForDeployment();

    // Setup roles
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    await timelock.grantRole(PROPOSER_ROLE, await governor.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the correct governance token", async function () {
      expect(await governor.governanceToken()).to.equal(await governanceToken.getAddress());
    });

    it("Should set the correct timelock", async function () {
      expect(await governor.timelock()).to.equal(await timelock.getAddress());
    });

    it("Should set the correct quorum", async function () {
      expect(await governor.quorum()).to.equal(QUORUM);
    });

    it("Should set the correct voting period", async function () {
      expect(await governor.votingPeriod()).to.equal(VOTING_PERIOD);
    });
  });

  describe("Proposal Creation", function () {
    it("Should allow token holders to create proposals", async function () {
      const targets = [addr1.address];
      const values = [0];
      const calldatas = ["0x"];
      const title = "Test Proposal";
      const description = "This is a test proposal";

      await expect(
        governor.propose(targets, values, calldatas, title, description, 0, false)
      ).to.emit(governor, "ProposalCreated");

      expect(await governor.proposalCount()).to.equal(1);
    });

    it("Should reject proposals from users without enough tokens", async function () {
      const targets = [addr1.address];
      const values = [0];
      const calldatas = ["0x"];

      await expect(
        governor.connect(addrs[3]).propose(targets, values, calldatas, "Test", "Desc", 0, false)
      ).to.be.revertedWith("Governor: below threshold");
    });

    it("Should reject empty proposals", async function () {
      await expect(
        governor.propose([], [], [], "Test", "Desc", 0, false)
      ).to.be.revertedWith("Governor: empty proposal");
    });

    it("Should reject proposals with mismatched array lengths", async function () {
      await expect(
        governor.propose([addr1.address], [0, 0], ["0x"], "Test", "Desc", 0, false)
      ).to.be.revertedWith("Governor: length mismatch");
    });
  });

  describe("Voting", function () {
    let proposalId;

    beforeEach(async function () {
      const targets = [addr1.address];
      const values = [0];
      const calldatas = ["0x"];
      
      const tx = await governor.propose(targets, values, calldatas, "Test", "Desc", 0, false);
      const receipt = await tx.wait();
      
      // Get proposal ID from event
      const event = receipt.logs.find(l => l.fragment?.name === "ProposalCreated");
      proposalId = event.args[0];

      // Move time forward to active state
      await ethers.provider.send("evm_increaseTime", [1]);
      await ethers.provider.send("evm_mine");
    });

    it("Should allow token holders to vote", async function () {
      await expect(governor.castVote(proposalId, 1, ""))
        .to.emit(governor, "VoteCast");
    });

    it("Should track votes correctly", async function () {
      await governor.castVote(proposalId, 1, "");
      
      const proposal = await governor.getProposal(proposalId);
      expect(proposal.forVotes).to.equal(ethers.parseUnits("10000", 18));
    });

    it("Should not allow double voting", async function () {
      await governor.castVote(proposalId, 1, "");
      
      await expect(
        governor.castVote(proposalId, 1, "")
      ).to.be.revertedWith("Governor: already voted");
    });

    it("Should calculate quadratic votes correctly", async function () {
      // Enable quadratic voting for this proposal type
      await governor.setQuadraticVotingEnabled(true);
      
      const targets = [addr1.address];
      const values = [0];
      const calldatas = ["0x"];
      
      await governor.propose(targets, values, calldatas, "QV Test", "Desc", 0, true);
      
      // Quadratic vote for 10000 tokens should be sqrt(10000) = 100
      const qv = await governor.calculateQuadraticVotes(ethers.parseUnits("10000", 18));
      expect(qv).to.be.closeTo(ethers.parseUnits("100", 9), ethers.parseUnits("1", 9));
    });
  });

  describe("Delegation", function () {
    it("Should allow delegation", async function () {
      await expect(governor.delegate(addr1.address, ethers.parseUnits("5000", 18)))
        .to.emit(governor, "VoteDelegated");
    });

    it("Should track delegation correctly", async function () {
      await governor.delegate(addr1.address, ethers.parseUnits("5000", 18));
      
      const delegation = await governor.delegates(owner.address);
      expect(delegation.delegate).to.equal(addr1.address);
      expect(delegation.delegatedAmount).to.equal(ethers.parseUnits("5000", 18));
      expect(delegation.isActive).to.be.true;
    });

    it("Should allow revoking delegation", async function () {
      await governor.delegate(addr1.address, ethers.parseUnits("5000", 18));
      await expect(governor.revokeDelegation())
        .to.emit(governor, "DelegationRevoked");
      
      const delegation = await governor.delegates(owner.address);
      expect(delegation.isActive).to.be.false;
    });

    it("Should not allow self-delegation", async function () {
      await expect(
        governor.delegate(owner.address, ethers.parseUnits("5000", 18))
      ).to.be.revertedWith("Governor: self delegation");
    });

    it("Should not allow delegation with insufficient balance", async function () {
      await expect(
        governor.delegate(addr1.address, ethers.parseUnits("20000", 18))
      ).to.be.revertedWith("Governor: insufficient balance");
    });
  });

  describe("Proposal Execution", function () {
    it("Should queue successful proposals", async function () {
      // Create and pass proposal
      const targets = [addr1.address];
      const values = [0];
      const calldatas = ["0x"];
      
      await governor.propose(targets, values, calldatas, "Test", "Desc", 0, false);
      const proposalId = await governor.proposalCount();

      // Move to active
      await ethers.provider.send("evm_increaseTime", [1]);
      await ethers.provider.send("evm_mine");

      // Vote
      await governor.castVote(proposalId, 1, "");

      // Move past voting period
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine");

      await expect(governor.queue(proposalId))
        .to.emit(governor, "ProposalQueued");
    });
  });
});
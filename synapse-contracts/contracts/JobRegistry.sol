// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title JobRegistry
 * @notice Decentralized job marketplace with escrow, reputation, and slashing
 * @dev UUPS Upgradeable, DAO-controlled, timelocked critical functions
 */
contract JobRegistry is Initializable, AccessControl, ReentrancyGuard, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // ============ Roles ============
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant DISPUTE_RESOLVER_ROLE = keccak256("DISPUTE_RESOLVER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ============ Enums ============
    enum JobStatus {
        Created,
        Funded,
        InProgress,
        UnderReview,
        Completed,
        Disputed,
        Cancelled,
        Refunded
    }

    enum MilestoneStatus {
        Pending,
        InProgress,
        Submitted,
        Approved,
        Rejected,
        Disputed
    }

    // ============ Structs ============
    struct Job {
        uint256 id;
        address client;
        address freelancer;
        uint256 totalBudget;
        address token;
        JobStatus status;
        uint256 createdAt;
        uint256 deadline;
        uint256 disputeId;
        string metadataURI; // IPFS hash with job details
        bool hasEscrow;
        uint256 escrowAmount;
        uint256 platformFeeRate; // In basis points
    }

    struct Milestone {
        uint256 id;
        uint256 jobId;
        string description;
        uint256 amount;
        MilestoneStatus status;
        uint256 deadline;
        string deliverableHash; // IPFS hash
        uint256 completedAt;
    }

    struct Reputation {
        uint256 totalJobs;
        uint256 completedJobs;
        uint256 disputedJobs;
        uint256 totalEarned;
        uint256 totalSpent;
        uint256 ratingSum; // Sum of all ratings (1-5 scale)
        uint256 ratingCount;
        uint256 stakedAmount;
        bool isSlashed;
        uint256 slashCount;
        uint256 lastActivity;
    }

    // ============ Storage ============
    mapping(uint256 => Job) public jobs;
    mapping(uint256 => Milestone[]) public jobMilestones;
    mapping(address => Reputation) public reputations;
    mapping(uint256 => mapping(address => bool)) public hasRated;
    mapping(address => bool) public verifiedFreelancers;
    mapping(address => mapping(address => uint256)) public slashableStake; // user => token => amount
    
    uint256 public jobCount;
    uint256 public milestoneCount;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public platformFeeRate; // 2.5% default
    uint256 public minStakeAmount; // 1000 HSK default
    uint256 public slashPercentage; // 10% of stake per slash
    uint256 public maxSlashes; // Max slashes before permanent ban

    address public treasury;
    address public disputeResolver;
    TimelockController public timelock;

    // ============ Events ============
    event JobCreated(
        uint256 indexed jobId,
        address indexed client,
        uint256 totalBudget,
        address token
    );
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event FreelancerAssigned(uint256 indexed jobId, address indexed freelancer);
    event MilestoneCreated(uint256 indexed jobId, uint256 indexed milestoneId, uint256 amount);
    event MilestoneSubmitted(uint256 indexed jobId, uint256 indexed milestoneId, string deliverableHash);
    event MilestoneApproved(uint256 indexed jobId, uint256 indexed milestoneId, uint256 amount);
    event MilestoneRejected(uint256 indexed jobId, uint256 indexed milestoneId);
    event JobCompleted(uint256 indexed jobId);
    event JobCancelled(uint256 indexed jobId);
    event PaymentReleased(uint256 indexed jobId, address indexed to, uint256 amount);
    event DisputeOpened(uint256 indexed jobId, uint256 indexed disputeId);
    event ReputationUpdated(address indexed user, uint256 newRating);
    event FreelancerVerified(address indexed freelancer);
    event StakeDeposited(address indexed user, address indexed token, uint256 amount);
    event StakeWithdrawn(address indexed user, address indexed token, uint256 amount);
    event UserSlashed(address indexed user, address indexed token, uint256 amount, string reason);
    event PlatformFeeRateUpdated(uint256 newRate);
    event MinStakeAmountUpdated(uint256 newAmount);

    // ============ Modifiers ============
    modifier onlyClient(uint256 jobId) {
        require(jobs[jobId].client == msg.sender, "JobRegistry: not client");
        _;
    }

    modifier onlyFreelancer(uint256 jobId) {
        require(jobs[jobId].freelancer == msg.sender, "JobRegistry: not freelancer");
        _;
    }

    modifier validJob(uint256 jobId) {
        require(jobId > 0 && jobId <= jobCount, "JobRegistry: invalid job");
        _;
    }

    // ============ Constructor ============
    constructor() {
        _disableInitializers();
    }

    // ============ Initializer ============
    function initialize(
        address _treasury, 
        address _dao,
        TimelockController _timelock
    ) public initializer {
        require(_treasury != address(0), "JobRegistry: zero treasury");
        require(_dao != address(0), "JobRegistry: zero dao");
        require(address(_timelock) != address(0), "JobRegistry: zero timelock");
        
        treasury = _treasury;
        timelock = _timelock;
        
        // Initialize default values
        platformFeeRate = 250; // 2.5%
        minStakeAmount = 1000 * 10**18; // 1000 HSK
        slashPercentage = 1000; // 10%
        maxSlashes = 3;
        
        _grantRole(DEFAULT_ADMIN_ROLE, address(_timelock));
        _grantRole(DAO_ROLE, _dao);
        _grantRole(UPGRADER_ROLE, address(_timelock));
    }

    // ============ Upgrade Authorization ============
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // ============ Job Creation ============
    function createJob(
        uint256 totalBudget,
        address token,
        uint256 deadline,
        string calldata metadataURI
    ) external returns (uint256 jobId) {
        require(totalBudget > 0, "JobRegistry: zero budget");
        require(deadline > block.timestamp, "JobRegistry: invalid deadline");
        require(bytes(metadataURI).length > 0, "JobRegistry: empty metadata");

        jobCount++;
        jobId = jobCount;

        jobs[jobId] = Job({
            id: jobId,
            client: msg.sender,
            freelancer: address(0),
            totalBudget: totalBudget,
            token: token,
            status: JobStatus.Created,
            createdAt: block.timestamp,
            deadline: deadline,
            disputeId: 0,
            metadataURI: metadataURI,
            hasEscrow: false,
            escrowAmount: 0,
            platformFeeRate: platformFeeRate
        });

        reputations[msg.sender].totalJobs++;

        emit JobCreated(jobId, msg.sender, totalBudget, token);
    }

    function fundJob(uint256 jobId) external validJob(jobId) onlyClient(jobId) nonReentrant {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Created, "JobRegistry: wrong status");
        require(!job.hasEscrow, "JobRegistry: already funded");

        job.hasEscrow = true;
        job.status = JobStatus.Funded;
        job.escrowAmount = job.totalBudget;

        IERC20(job.token).safeTransferFrom(msg.sender, address(this), job.totalBudget);

        emit JobFunded(jobId, job.totalBudget);
    }

    function assignFreelancer(
        uint256 jobId,
        address freelancer
    ) external validJob(jobId) onlyClient(jobId) {
        require(freelancer != address(0), "JobRegistry: zero address");
        require(freelancer != msg.sender, "JobRegistry: cannot assign self");
        
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Funded, "JobRegistry: not funded");
        require(job.freelancer == address(0), "JobRegistry: already assigned");

        job.freelancer = freelancer;
        job.status = JobStatus.InProgress;

        reputations[freelancer].totalJobs++;

        emit FreelancerAssigned(jobId, freelancer);
    }

    // ============ Milestone Management ============
    function addMilestone(
        uint256 jobId,
        string calldata description,
        uint256 amount,
        uint256 milestoneDeadline
    ) external validJob(jobId) onlyClient(jobId) returns (uint256 milestoneId) {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.InProgress || job.status == JobStatus.Funded, 
            "JobRegistry: invalid status");
        require(milestoneDeadline <= job.deadline, "JobRegistry: exceeds job deadline");
        require(amount > 0, "JobRegistry: zero amount");

        milestoneCount++;
        milestoneId = milestoneCount;

        Milestone memory milestone = Milestone({
            id: milestoneId,
            jobId: jobId,
            description: description,
            amount: amount,
            status: MilestoneStatus.Pending,
            deadline: milestoneDeadline,
            deliverableHash: "",
            completedAt: 0
        });

        jobMilestones[jobId].push(milestone);

        emit MilestoneCreated(jobId, milestoneId, amount);
    }

    function startMilestone(
        uint256 jobId,
        uint256 milestoneIndex
    ) external validJob(jobId) onlyFreelancer(jobId) {
        Milestone storage milestone = jobMilestones[jobId][milestoneIndex];
        require(milestone.status == MilestoneStatus.Pending, "JobRegistry: not pending");
        
        milestone.status = MilestoneStatus.InProgress;
    }

    function submitMilestone(
        uint256 jobId,
        uint256 milestoneIndex,
        string calldata deliverableHash
    ) external validJob(jobId) onlyFreelancer(jobId) {
        Milestone storage milestone = jobMilestones[jobId][milestoneIndex];
        require(milestone.status == MilestoneStatus.InProgress, "JobRegistry: not in progress");
        require(block.timestamp <= milestone.deadline, "JobRegistry: deadline passed");
        require(bytes(deliverableHash).length > 0, "JobRegistry: empty deliverable");

        milestone.status = MilestoneStatus.Submitted;
        milestone.deliverableHash = deliverableHash;

        Job storage job = jobs[jobId];
        job.status = JobStatus.UnderReview;

        emit MilestoneSubmitted(jobId, milestone.id, deliverableHash);
    }

    function approveMilestone(
        uint256 jobId,
        uint256 milestoneIndex
    ) external validJob(jobId) onlyClient(jobId) nonReentrant {
        Milestone storage milestone = jobMilestones[jobId][milestoneIndex];
        require(milestone.status == MilestoneStatus.Submitted, "JobRegistry: not submitted");

        milestone.status = MilestoneStatus.Approved;
        milestone.completedAt = block.timestamp;

        Job storage job = jobs[jobId];
        
        uint256 platformFee = (milestone.amount * job.platformFeeRate) / BASIS_POINTS;
        uint256 freelancerPayment = milestone.amount - platformFee;

        job.escrowAmount -= milestone.amount;

        if (platformFee > 0) {
            IERC20(job.token).safeTransfer(treasury, platformFee);
        }
        IERC20(job.token).safeTransfer(job.freelancer, freelancerPayment);

        reputations[job.freelancer].totalEarned += freelancerPayment;
        reputations[job.client].totalSpent += milestone.amount;
        reputations[job.freelancer].completedJobs++;

        if (_allMilestonesComplete(jobId)) {
            job.status = JobStatus.Completed;
            emit JobCompleted(jobId);
        } else {
            job.status = JobStatus.InProgress;
        }

        emit MilestoneApproved(jobId, milestone.id, milestone.amount);
        emit PaymentReleased(jobId, job.freelancer, freelancerPayment);
    }

    function rejectMilestone(
        uint256 jobId,
        uint256 milestoneIndex
    ) external validJob(jobId) onlyClient(jobId) {
        Milestone storage milestone = jobMilestones[jobId][milestoneIndex];
        require(milestone.status == MilestoneStatus.Submitted, "JobRegistry: not submitted");

        milestone.status = MilestoneStatus.Rejected;

        Job storage job = jobs[jobId];
        job.status = JobStatus.InProgress;

        emit MilestoneRejected(jobId, milestone.id);
    }

    // ============ Dispute ============
    function openDispute(
        uint256 jobId,
        uint256 disputeId
    ) external validJob(jobId) {
        Job storage job = jobs[jobId];
        require(
            msg.sender == job.client || msg.sender == job.freelancer,
            "JobRegistry: not a party"
        );
        require(
            job.status == JobStatus.InProgress || 
            job.status == JobStatus.UnderReview,
            "JobRegistry: invalid status"
        );
        require(job.disputeId == 0, "JobRegistry: dispute exists");

        job.status = JobStatus.Disputed;
        job.disputeId = disputeId;

        reputations[job.client].disputedJobs++;
        reputations[job.freelancer].disputedJobs++;

        emit DisputeOpened(jobId, disputeId);
    }

    function resolveDispute(
        uint256 jobId,
        uint256 clientShare,
        uint256 freelancerShare
    ) external validJob(jobId) onlyRole(DISPUTE_RESOLVER_ROLE) nonReentrant {
        require(clientShare + freelancerShare == BASIS_POINTS, "JobRegistry: invalid shares");
        
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Disputed, "JobRegistry: not disputed");

        job.status = JobStatus.Completed;

        uint256 clientAmount = (job.escrowAmount * clientShare) / BASIS_POINTS;
        uint256 freelancerAmount = (job.escrowAmount * freelancerShare) / BASIS_POINTS;

        job.escrowAmount = 0;

        if (clientAmount > 0) {
            IERC20(job.token).safeTransfer(job.client, clientAmount);
        }
        if (freelancerAmount > 0) {
            IERC20(job.token).safeTransfer(job.freelancer, freelancerAmount);
            reputations[job.freelancer].totalEarned += freelancerAmount;
        }

        reputations[job.client].totalSpent += clientAmount;
    }

    // ============ Cancellation ============
    function cancelJob(uint256 jobId) external validJob(jobId) onlyClient(jobId) {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Created, "JobRegistry: not created");

        job.status = JobStatus.Cancelled;

        emit JobCancelled(jobId);
    }

    function requestRefund(uint256 jobId) external validJob(jobId) onlyClient(jobId) nonReentrant {
        Job storage job = jobs[jobId];
        require(block.timestamp > job.deadline, "JobRegistry: not expired");
        require(
            job.status == JobStatus.Funded || job.status == JobStatus.InProgress,
            "JobRegistry: invalid status"
        );
        require(job.disputeId == 0, "JobRegistry: has dispute");

        job.status = JobStatus.Refunded;
        
        uint256 refundAmount = job.escrowAmount;
        job.escrowAmount = 0;

        IERC20(job.token).safeTransfer(job.client, refundAmount);

        emit PaymentReleased(jobId, job.client, refundAmount);
    }

    // ============ Reputation & Rating ============
    function rateParty(uint256 jobId, uint256 rating) external validJob(jobId) {
        require(rating >= 1 && rating <= 5, "JobRegistry: invalid rating");
        
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Completed, "JobRegistry: not completed");
        require(
            msg.sender == job.client || msg.sender == job.freelancer,
            "JobRegistry: not a party"
        );
        require(!hasRated[jobId][msg.sender], "JobRegistry: already rated");

        address ratedParty = (msg.sender == job.client) ? job.freelancer : job.client;
        require(ratedParty != address(0), "JobRegistry: no party to rate");

        hasRated[jobId][msg.sender] = true;
        reputations[ratedParty].ratingSum += rating;
        reputations[ratedParty].ratingCount++;
        reputations[ratedParty].lastActivity = block.timestamp;

        emit ReputationUpdated(ratedParty, rating);
    }

    function getRating(address user) external view returns (uint256) {
        Reputation storage rep = reputations[user];
        if (rep.ratingCount == 0) return 0;
        return (rep.ratingSum * 100) / rep.ratingCount;
    }

    function verifyFreelancer(address freelancer) external onlyRole(DAO_ROLE) {
        require(freelancer != address(0), "JobRegistry: zero address");
        verifiedFreelancers[freelancer] = true;
        emit FreelancerVerified(freelancer);
    }

    // ============ Staking & Slashing ============
    function depositStake(address token, uint256 amount) external nonReentrant {
        require(amount >= minStakeAmount, "JobRegistry: below minimum");
        require(!reputations[msg.sender].isSlashed, "JobRegistry: permanently slashed");

        reputations[msg.sender].stakedAmount += amount;
        slashableStake[msg.sender][token] += amount;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit StakeDeposited(msg.sender, token, amount);
    }

    function withdrawStake(address token, uint256 amount) external nonReentrant {
        Reputation storage rep = reputations[msg.sender];
        require(rep.stakedAmount >= amount, "JobRegistry: insufficient stake");
        require(slashableStake[msg.sender][token] >= amount, "JobRegistry: stake locked");

        rep.stakedAmount -= amount;
        slashableStake[msg.sender][token] -= amount;

        IERC20(token).safeTransfer(msg.sender, amount);

        emit StakeWithdrawn(msg.sender, token, amount);
    }

    /**
     * @notice Slash a user for misconduct (DAO only via timelock)
     * @param user Address to slash
     * @param token Token to slash from
     * @param amount Amount to slash
     * @param reason Reason for slashing
     */
    function slashUser(
        address user,
        address token,
        uint256 amount,
        string calldata reason
    ) external onlyRole(DAO_ROLE) nonReentrant {
        Reputation storage rep = reputations[user];
        require(rep.stakedAmount > 0, "JobRegistry: no stake");
        require(amount <= slashableStake[user][token], "JobRegistry: amount exceeds slashable stake");

        rep.slashCount++;
        
        if (rep.slashCount >= maxSlashes) {
            rep.isSlashed = true;
            amount = slashableStake[user][token]; // Slash all
        }

        rep.stakedAmount -= amount;
        slashableStake[user][token] -= amount;

        // Transfer slashed amount to treasury
        IERC20(token).safeTransfer(treasury, amount);
        
        emit UserSlashed(user, token, amount, reason);
    }

    // ============ Timelocked DAO Updates ============
    /**
     * @notice Queue platform fee rate update (requires timelock)
     */
    function setPlatformFeeRate(uint256 newRate) external onlyRole(DAO_ROLE) {
        require(newRate <= 1000, "JobRegistry: max 10%");
        platformFeeRate = newRate;
        emit PlatformFeeRateUpdated(newRate);
    }

    function setMinStakeAmount(uint256 newAmount) external onlyRole(DAO_ROLE) {
        minStakeAmount = newAmount;
        emit MinStakeAmountUpdated(newAmount);
    }

    function setDisputeResolver(address _disputeResolver) external onlyRole(DAO_ROLE) {
        disputeResolver = _disputeResolver;
        _grantRole(DISPUTE_RESOLVER_ROLE, _disputeResolver);
    }

    // ============ Internal Functions ============
    function _allMilestonesComplete(uint256 jobId) internal view returns (bool) {
        Milestone[] storage milestones = jobMilestones[jobId];
        if (milestones.length == 0) return true;
        
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestones[i].status != MilestoneStatus.Approved) {
                return false;
            }
        }
        return true;
    }

    // ============ View Functions ============
    function getJobMilestones(uint256 jobId) external view returns (Milestone[] memory) {
        return jobMilestones[jobId];
    }

    function getReputation(address user) external view returns (Reputation memory) {
        return reputations[user];
    }

    function getAverageRating(address user) external view returns (uint256 average, uint256 count) {
        Reputation storage rep = reputations[user];
        if (rep.ratingCount == 0) return (0, 0);
        return ((rep.ratingSum * 100) / rep.ratingCount, rep.ratingCount);
    }

    function getSlashableStake(address user, address token) external view returns (uint256) {
        return slashableStake[user][token];
    }
}

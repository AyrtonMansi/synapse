// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title JobRegistryUpgradeable
 * @notice Upgradeable version of JobRegistry with UUPS pattern
 * @dev All upgrades must be authorized by DAO
 */
contract JobRegistryUpgradeable is 
    Initializable, 
    AccessControl, 
    ReentrancyGuard,
    UUPSUpgradeable 
{
    using SafeERC20 for IERC20;

    // ============ Roles ============
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant DISPUTE_RESOLVER_ROLE = keccak256("DISPUTE_RESOLVER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ============ Storage ============
    // NOTE: Storage layout must NEVER change between upgrades
    // Add new variables at the end only
    
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
        string metadataURI;
        bool hasEscrow;
        uint256 escrowAmount;
        uint256 platformFeeRate;
    }

    struct Milestone {
        uint256 id;
        uint256 jobId;
        string description;
        uint256 amount;
        MilestoneStatus status;
        uint256 deadline;
        string deliverableHash;
        uint256 completedAt;
    }

    struct Reputation {
        uint256 totalJobs;
        uint256 completedJobs;
        uint256 disputedJobs;
        uint256 totalEarned;
        uint256 totalSpent;
        uint256 ratingSum;
        uint256 ratingCount;
        uint256 stakedAmount;
        bool isSlashed;
        uint256 slashCount;
        uint256 lastActivity;
    }

    // Mappings
    mapping(uint256 => Job) public jobs;
    mapping(uint256 => Milestone[]) public jobMilestones;
    mapping(address => Reputation) public reputations;
    mapping(uint256 => mapping(address => bool)) public hasRated;
    mapping(address => bool) public verifiedFreelancers;
    mapping(address => uint256) public slashableStake;
    
    // Counters
    uint256 public jobCount;
    uint256 public milestoneCount;
    
    // Configuration
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public platformFeeRate;
    uint256 public minStakeAmount;
    uint256 public slashPercentage;
    uint256 public maxSlashes;

    // Addresses
    address public treasury;
    address public disputeResolver;
    
    // ============ NEW STORAGE (added in v2) ============
    uint256 public version; // Track contract version
    mapping(address => bool) public bannedUsers; // New feature
    uint256 public maxPlatformFee; // Safety limit

    // ============ Events ============
    event JobCreated(uint256 indexed jobId, address indexed client, uint256 totalBudget, address token);
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event FreelancerAssigned(uint256 indexed jobId, address indexed freelancer);
    event MilestoneCreated(uint256 indexed jobId, uint256 indexed milestoneId, uint256 amount);
    event MilestoneSubmitted(uint256 indexed jobId, uint256 indexed milestoneId, string deliverableHash);
    event MilestoneApproved(uint256 indexed jobId, uint256 indexed milestoneId, uint256 amount);
    event PaymentReleased(uint256 indexed jobId, address indexed to, uint256 amount);
    event ReputationUpdated(address indexed user, uint256 newRating);
    event UserSlashed(address indexed user, uint256 amount, string reason);
    event ContractUpgraded(uint256 newVersion, address indexed upgrader);

    // ============ Modifiers ============
    modifier onlyClient(uint256 jobId) {
        require(jobs[jobId].client == msg.sender, "JobRegistry: not client");
        _;
    }

    modifier validJob(uint256 jobId) {
        require(jobId > 0 && jobId <= jobCount, "JobRegistry: invalid job");
        _;
    }

    modifier notBanned() {
        require(!bannedUsers[msg.sender], "JobRegistry: user banned");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (replaces constructor for upgradeable)
     */
    function initialize(
        address _treasury, 
        address _dao
    ) public initializer {
        require(_treasury != address(0), "JobRegistry: zero treasury");
        require(_dao != address(0), "JobRegistry: zero dao");
        
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, _dao);
        _grantRole(DAO_ROLE, _dao);
        _grantRole(UPGRADER_ROLE, _dao);
        
        // Initialize defaults
        platformFeeRate = 250; // 2.5%
        minStakeAmount = 1000 * 10**18;
        slashPercentage = 1000;
        maxSlashes = 3;
        maxPlatformFee = 1000; // 10% max
        version = 1;
    }

    /**
     * @notice Create a new job posting
     */
    function createJob(
        uint256 totalBudget,
        address token,
        uint256 deadline,
        string calldata metadataURI
    ) external notBanned returns (uint256 jobId) {
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

    /**
     * @notice Fund a job with escrow
     */
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

    /**
     * @notice Slash a user for misconduct (DAO only)
     */
    function slashUser(
        address user,
        uint256 amount,
        string calldata reason
    ) external onlyRole(DAO_ROLE) nonReentrant {
        Reputation storage rep = reputations[user];
        require(rep.stakedAmount > 0, "JobRegistry: no stake");
        require(amount <= rep.stakedAmount, "JobRegistry: amount exceeds stake");

        rep.slashCount++;
        
        if (rep.slashCount >= maxSlashes) {
            rep.isSlashed = true;
            bannedUsers[user] = true;
            amount = rep.stakedAmount; // Slash all
        }

        rep.stakedAmount -= amount;
        slashableStake[user] = rep.stakedAmount;

        // Send slashed amount to treasury
        IERC20(jobs[1].token).safeTransfer(treasury, amount);

        emit UserSlashed(user, amount, reason);
    }

    /**
     * @notice Update platform fee rate (via DAO)
     */
    function setPlatformFeeRate(uint256 newRate) external onlyRole(DAO_ROLE) {
        require(newRate <= maxPlatformFee, "JobRegistry: exceeds max fee");
        platformFeeRate = newRate;
    }

    /**
     * @notice Upgrade authorization - only DAO can upgrade
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {
        version++;
        emit ContractUpgraded(version, msg.sender);
    }

    /**
     * @notice Get contract implementation address
     */
    function implementation() external view returns (address) {
        return _getImplementation();
    }

    // ... (remaining functions same as original)
    // View functions omitted for brevity - include all from original
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

// Chainlink VRF interface for secure randomness
interface VRFCoordinatorV2Interface {
    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256 requestId);
}

/**
 * @title DisputeResolver
 * @notice Decentralized dispute resolution with multi-juror pools
 * @dev Uses Chainlink VRF for secure random juror selection
 * @dev Implements commit-reveal voting and Schelling-point mechanism
 * @dev Added: Reentrancy protection, pause mechanism, secure randomness
 */
contract DisputeResolver is Initializable, AccessControl, ReentrancyGuard, UUPSUpgradeable, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant JUROR_ROLE = keccak256("JUROR_ROLE");
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    enum DisputeStatus {
        None,
        Open,
        Evidence,
        Voting,
        Reveal,
        Resolved,
        Executed
    }

    enum Ruling {
        RefusedToArbitrate,
        ClientWins,
        FreelancerWins,
        SplitPayment
    }

    struct Dispute {
        uint256 id;
        uint256 jobId;
        address client;
        address freelancer;
        uint256 escrowAmount;
        address token;
        DisputeStatus status;
        Ruling ruling;
        uint256 createdAt;
        uint256 resolvedAt;
        uint256 deadline;
        bytes32 evidenceHash;
        uint256 clientShare;
        uint256 freelancerShare;
        uint256 jurorCount;
        uint256 requiredJurors;
        uint256 totalStake;
        mapping(address => JurorVote) votes;
        address[] jurorList;
        uint256 randomnessRequestId; // Track VRF request
        uint256 randomSeed; // Secure random seed from VRF
    }

    struct JurorVote {
        bytes32 commitment; // Hash of (ruling + salt)
        Ruling ruling;
        bool revealed;
        uint256 stake;
        bool rewarded;
    }

    struct JurorInfo {
        bool isActive;
        uint256 totalCases;
        uint256 correctVotes;
        uint256 stakedAmount;
        uint256 reputation;
    }

    // ============ Security: Overflow/Underflow Protection ============
    // Using Solidity 0.8.x built-in overflow protection
    // Additional bounds checking for calculations

    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => bool) public jobHasDispute;
    mapping(address => JurorInfo) public jurors;
    address[] public jurorPool;
    
    // VRF request tracking
    mapping(uint256 => uint256) public vrfRequestToDispute;
    
    uint256 public disputeCount;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_JURORS = 5;
    uint256 public constant MAX_JURORS = 21;
    uint256 public constant EVIDENCE_PERIOD = 3 days;
    uint256 public constant VOTING_PERIOD = 2 days;
    uint256 public constant REVEAL_PERIOD = 1 days;
    uint256 public constant MIN_JUROR_STAKE = 1000 * 10**18;
    uint256 public constant JUROR_REWARD_PERCENT = 2000; // 20% of fees
    
    // Security limits
    uint256 public constant MAX_ESCROW_AMOUNT = 1000000 * 10**18; // 1M tokens max
    uint256 public constant MAX_SINGLE_JUROR_STAKE = 100000 * 10**18; // 100K max stake

    address public treasury;
    VRFCoordinatorV2Interface public vrfCoordinator;
    bytes32 public vrfKeyHash;
    uint64 public vrfSubscriptionId;

    // ============ Events ============
    event DisputeCreated(uint256 indexed disputeId, uint256 indexed jobId, address indexed client, address freelancer, uint256 amount);
    event EvidenceSubmitted(uint256 indexed disputeId, address submitter, bytes32 evidenceHash);
    event VoteCommitted(uint256 indexed disputeId, address juror, bytes32 commitment);
    event VoteRevealed(uint256 indexed disputeId, address juror, Ruling ruling);
    event DisputeResolved(uint256 indexed disputeId, Ruling ruling);
    event DisputeExecuted(uint256 indexed disputeId, uint256 clientAmount, uint256 freelancerAmount);
    event JurorRegistered(address juror, uint256 stake);
    event JurorDeregistered(address juror);
    event JurorRewarded(uint256 indexed disputeId, address juror, uint256 amount);
    event JurorPenalized(uint256 indexed disputeId, address juror, uint256 amount);
    event RandomnessRequested(uint256 indexed disputeId, uint256 requestId);
    event RandomnessFulfilled(uint256 indexed disputeId, uint256 randomSeed);
    event EmergencyPauseActivated(address indexed caller);
    event EmergencyPauseDeactivated(address indexed caller);

    // ============ Modifiers ============
    modifier onlyParties(uint256 disputeId) {
        Dispute storage d = disputes[disputeId];
        require(msg.sender == d.client || msg.sender == d.freelancer, "DisputeResolver: not a party");
        _;
    }

    modifier validDispute(uint256 disputeId) {
        require(disputeId > 0 && disputeId <= disputeCount, "DisputeResolver: invalid dispute");
        _;
    }

    modifier nonZeroAddress(address addr) {
        require(addr != address(0), "DisputeResolver: zero address");
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address daoAddress, 
        address _treasury,
        address _vrfCoordinator,
        bytes32 _vrfKeyHash,
        uint64 _vrfSubscriptionId
    ) public initializer nonZeroAddress(daoAddress) nonZeroAddress(_treasury) nonZeroAddress(_vrfCoordinator) {
        require(_vrfSubscriptionId > 0, "DisputeResolver: invalid subscription");
        
        treasury = _treasury;
        vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        vrfKeyHash = _vrfKeyHash;
        vrfSubscriptionId = _vrfSubscriptionId;
        
        _grantRole(DEFAULT_ADMIN_ROLE, daoAddress);
        _grantRole(DAO_ROLE, daoAddress);
        _grantRole(UPGRADER_ROLE, daoAddress);
        _grantRole(PAUSER_ROLE, daoAddress);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // ============ Emergency Pause ============
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyPauseActivated(msg.sender);
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit EmergencyPauseDeactivated(msg.sender);
    }

    // ============ Juror Management ============
    function registerJuror(uint256 stakeAmount, address token) external whenNotPaused nonReentrant {
        // Security: Bounds checking
        require(stakeAmount >= MIN_JUROR_STAKE, "DisputeResolver: insufficient stake");
        require(stakeAmount <= MAX_SINGLE_JUROR_STAKE, "DisputeResolver: stake exceeds maximum");
        require(!jurors[msg.sender].isActive, "DisputeResolver: already registered");
        require(token != address(0), "DisputeResolver: invalid token");

        // Security: Safe ERC20 transfer with reentrancy protection
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), stakeAmount);
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        
        // Verify actual amount received (handles fee-on-transfer tokens)
        uint256 actualAmount = balanceAfter - balanceBefore;
        require(actualAmount >= MIN_JUROR_STAKE, "DisputeResolver: insufficient amount received");

        jurors[msg.sender] = JurorInfo({
            isActive: true,
            totalCases: 0,
            correctVotes: 0,
            stakedAmount: actualAmount,
            reputation: 100 // Base reputation
        });

        _grantRole(JUROR_ROLE, msg.sender);
        jurorPool.push(msg.sender);

        emit JurorRegistered(msg.sender, actualAmount);
    }

    function deregisterJuror(address token) external onlyRole(JUROR_ROLE) nonReentrant {
        JurorInfo storage j = jurors[msg.sender];
        require(j.isActive, "DisputeResolver: not active");
        require(token != address(0), "DisputeResolver: invalid token");
        
        // Security: Check for active disputes before deregistering
        require(_canDeregister(msg.sender), "DisputeResolver: active dispute participation");
        
        j.isActive = false;
        
        // Security: Safe transfer with reentrancy protection
        uint256 amountToReturn = j.stakedAmount;
        j.stakedAmount = 0;
        
        IERC20(token).safeTransfer(msg.sender, amountToReturn);

        _revokeRole(JUROR_ROLE, msg.sender);

        // Remove from pool
        _removeFromJurorPool(msg.sender);

        emit JurorDeregistered(msg.sender);
    }

    function _canDeregister(address juror) internal view returns (bool) {
        // Check if juror is participating in any active disputes
        for (uint256 i = 1; i <= disputeCount; i++) {
            Dispute storage d = disputes[i];
            if (d.status == DisputeStatus.Voting || d.status == DisputeStatus.Reveal) {
                for (uint256 j = 0; j < d.jurorList.length; j++) {
                    if (d.jurorList[j] == juror) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    function _removeFromJurorPool(address juror) internal {
        for (uint256 i = 0; i < jurorPool.length; i++) {
            if (jurorPool[i] == juror) {
                jurorPool[i] = jurorPool[jurorPool.length - 1];
                jurorPool.pop();
                break;
            }
        }
    }

    // ============ Dispute Creation ============
    function createDispute(
        uint256 jobId,
        address client,
        address freelancer,
        uint256 escrowAmount,
        address token,
        bytes32 evidenceHash
    ) external whenNotPaused nonReentrant returns (uint256 disputeId) {
        // Security: Comprehensive input validation
        require(!jobHasDispute[jobId], "DisputeResolver: dispute exists");
        require(client != address(0) && freelancer != address(0), "DisputeResolver: zero address");
        require(client != freelancer, "DisputeResolver: same party");
        require(escrowAmount > 0, "DisputeResolver: zero amount");
        require(escrowAmount <= MAX_ESCROW_AMOUNT, "DisputeResolver: amount exceeds maximum");
        require(token != address(0), "DisputeResolver: invalid token");
        require(jurorPool.length >= MIN_JURORS, "DisputeResolver: insufficient jurors");
        require(evidenceHash != bytes32(0), "DisputeResolver: empty evidence");

        disputeCount++;
        disputeId = disputeCount;

        Dispute storage d = disputes[disputeId];
        d.id = disputeId;
        d.jobId = jobId;
        d.client = client;
        d.freelancer = freelancer;
        d.escrowAmount = escrowAmount;
        d.token = token;
        d.status = DisputeStatus.Evidence;
        d.ruling = Ruling.RefusedToArbitrate;
        d.createdAt = block.timestamp;
        d.deadline = block.timestamp + EVIDENCE_PERIOD;
        d.evidenceHash = evidenceHash;
        d.requiredJurors = _calculateJurorCount();

        jobHasDispute[jobId] = true;

        emit DisputeCreated(disputeId, jobId, client, freelancer, escrowAmount);
        emit EvidenceSubmitted(disputeId, msg.sender, evidenceHash);

        return disputeId;
    }

    function _calculateJurorCount() internal view returns (uint256) {
        // Use square root of pool size for juror count with bounds
        uint256 count = 1;
        while (count * count < jurorPool.length && count < MAX_JURORS) {
            count++;
        }
        return count < MIN_JURORS ? MIN_JURORS : count;
    }

    // ============ Evidence ============
    function submitEvidence(uint256 disputeId, bytes32 evidenceHash) external validDispute(disputeId) onlyParties(disputeId) whenNotPaused {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Evidence, "DisputeResolver: not evidence phase");
        require(block.timestamp < d.deadline, "DisputeResolver: evidence period ended");
        require(evidenceHash != bytes32(0), "DisputeResolver: empty evidence");

        emit EvidenceSubmitted(disputeId, msg.sender, evidenceHash);
    }

    function startVoting(uint256 disputeId) external validDispute(disputeId) onlyRole(DAO_ROLE) whenNotPaused {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Evidence, "DisputeResolver: not evidence phase");
        require(block.timestamp >= d.deadline, "DisputeResolver: evidence ongoing");
        require(d.randomSeed == 0, "DisputeResolver: already started");

        d.status = DisputeStatus.Voting;
        d.deadline = block.timestamp + VOTING_PERIOD;

        // Security: Request secure randomness from Chainlink VRF
        uint256 requestId = vrfCoordinator.requestRandomWords(
            vrfKeyHash,
            vrfSubscriptionId,
            3, // Minimum 3 block confirmations
            100000, // Callback gas limit
            1 // Request 1 random word
        );
        
        d.randomnessRequestId = requestId;
        vrfRequestToDispute[requestId] = disputeId;

        emit RandomnessRequested(disputeId, requestId);
    }

    // ============ VRF Callback ============
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        require(msg.sender == address(vrfCoordinator), "DisputeResolver: only VRF coordinator");
        require(randomWords.length > 0, "DisputeResolver: no random words");
        
        uint256 disputeId = vrfRequestToDispute[requestId];
        require(disputeId > 0, "DisputeResolver: invalid request");
        
        Dispute storage d = disputes[disputeId];
        require(d.randomSeed == 0, "DisputeResolver: randomness already set");
        
        d.randomSeed = randomWords[0];
        
        // Select jurors using secure randomness
        _selectJurors(disputeId, randomWords[0]);
        
        emit RandomnessFulfilled(disputeId, randomWords[0]);
    }

    function _selectJurors(uint256 disputeId, uint256 randomSeed) internal {
        Dispute storage d = disputes[disputeId];
        require(d.jurorList.length == 0, "DisputeResolver: already selected");

        uint256 poolSize = jurorPool.length;
        require(poolSize >= d.requiredJurors, "DisputeResolver: insufficient pool");

        // Use Fisher-Yates shuffle with secure randomness
        address[] memory tempPool = new address[](poolSize);
        for (uint256 i = 0; i < poolSize; i++) {
            tempPool[i] = jurorPool[i];
        }

        for (uint256 i = 0; i < d.requiredJurors && i < poolSize; i++) {
            // Generate random index
            uint256 randomIndex = i + (uint256(keccak256(abi.encode(randomSeed, i))) % (poolSize - i));
            
            // Swap
            address temp = tempPool[i];
            tempPool[i] = tempPool[randomIndex];
            tempPool[randomIndex] = temp;
            
            // Select if active
            if (jurors[tempPool[i]].isActive) {
                d.jurorList.push(tempPool[i]);
            }
        }

        // Ensure we have enough jurors
        require(d.jurorList.length >= MIN_JURORS, "DisputeResolver: insufficient jurors selected");
    }

    // ============ Commit-Reveal Voting ============
    function commitVote(uint256 disputeId, bytes32 commitment) external validDispute(disputeId) onlyRole(JUROR_ROLE) whenNotPaused {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Voting, "DisputeResolver: not voting");
        require(block.timestamp < d.deadline, "DisputeResolver: voting ended");
        require(_isSelectedJuror(disputeId, msg.sender), "DisputeResolver: not selected");
        require(d.votes[msg.sender].commitment == bytes32(0), "DisputeResolver: already committed");
        require(commitment != bytes32(0), "DisputeResolver: empty commitment");
        require(d.randomSeed != 0, "DisputeResolver: randomness not ready");

        // Require stake
        uint256 stake = jurors[msg.sender].stakedAmount / 10; // 10% of stake
        require(stake > 0, "DisputeResolver: no stake available");
        
        d.votes[msg.sender] = JurorVote({
            commitment: commitment,
            ruling: Ruling.RefusedToArbitrate,
            revealed: false,
            stake: stake,
            rewarded: false
        });
        d.totalStake += stake;

        emit VoteCommitted(disputeId, msg.sender, commitment);
    }

    function _isSelectedJuror(uint256 disputeId, address account) internal view returns (bool) {
        Dispute storage d = disputes[disputeId];
        for (uint256 i = 0; i < d.jurorList.length; i++) {
            if (d.jurorList[i] == account) return true;
        }
        return false;
    }

    function revealVote(uint256 disputeId, Ruling ruling, uint256 salt) external validDispute(disputeId) onlyRole(JUROR_ROLE) whenNotPaused {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Reveal, "DisputeResolver: not reveal phase");
        require(block.timestamp < d.deadline, "DisputeResolver: reveal ended");
        require(ruling != Ruling.RefusedToArbitrate, "DisputeResolver: invalid ruling");
        
        JurorVote storage vote = d.votes[msg.sender];
        require(vote.commitment != bytes32(0), "DisputeResolver: not committed");
        require(!vote.revealed, "DisputeResolver: already revealed");

        // Security: Verify commitment with hash
        bytes32 expectedCommitment = keccak256(abi.encodePacked(disputeId, ruling, salt));
        require(vote.commitment == expectedCommitment, "DisputeResolver: invalid reveal");

        vote.ruling = ruling;
        vote.revealed = true;
        d.jurorCount++;

        emit VoteRevealed(disputeId, msg.sender, ruling);

        // If all jurors revealed, resolve immediately
        if (d.jurorCount == d.jurorList.length) {
            _resolveDispute(disputeId);
        }
    }

    function startReveal(uint256 disputeId) external validDispute(disputeId) onlyRole(DAO_ROLE) whenNotPaused {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Voting, "DisputeResolver: not voting");
        require(block.timestamp >= d.deadline, "DisputeResolver: voting ongoing");

        d.status = DisputeStatus.Reveal;
        d.deadline = block.timestamp + REVEAL_PERIOD;
    }

    // ============ Resolution ============
    function resolveDispute(uint256 disputeId) external validDispute(disputeId) whenNotPaused {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Reveal, "DisputeResolver: not reveal");
        require(block.timestamp >= d.deadline, "DisputeResolver: reveal ongoing");

        _resolveDispute(disputeId);
    }

    function _resolveDispute(uint256 disputeId) internal {
        Dispute storage d = disputes[disputeId];
        
        // Count votes
        uint256[4] memory voteCounts; // Index by Ruling enum
        for (uint256 i = 0; i < d.jurorList.length; i++) {
            JurorVote storage vote = d.votes[d.jurorList[i]];
            if (vote.revealed) {
                voteCounts[uint256(vote.ruling)]++;
            }
        }

        // Find majority
        uint256 maxVotes = 0;
        Ruling winningRuling = Ruling.RefusedToArbitrate;
        for (uint256 i = 1; i < 4; i++) {
            if (voteCounts[i] > maxVotes) {
                maxVotes = voteCounts[i];
                winningRuling = Ruling(i);
            }
        }

        require(winningRuling != Ruling.RefusedToArbitrate, "DisputeResolver: no majority");

        d.status = DisputeStatus.Resolved;
        d.ruling = winningRuling;
        d.resolvedAt = block.timestamp;

        // Calculate shares based on ruling
        if (winningRuling == Ruling.ClientWins) {
            d.clientShare = BASIS_POINTS;
            d.freelancerShare = 0;
        } else if (winningRuling == Ruling.FreelancerWins) {
            d.clientShare = 0;
            d.freelancerShare = BASIS_POINTS;
        } else if (winningRuling == Ruling.SplitPayment) {
            d.clientShare = BASIS_POINTS / 2;
            d.freelancerShare = BASIS_POINTS / 2;
        }

        // Distribute rewards/penalties
        _distributeJurorRewards(disputeId, winningRuling);

        emit DisputeResolved(disputeId, winningRuling);
    }

    function _distributeJurorRewards(uint256 disputeId, Ruling winningRuling) internal {
        Dispute storage d = disputes[disputeId];
        
        // Security: Check for potential overflow in reward calculation
        require(d.escrowAmount <= type(uint256).max / JUROR_REWARD_PERCENT, "DisputeResolver: reward calculation overflow");
        
        uint256 totalReward = (d.escrowAmount * JUROR_REWARD_PERCENT) / BASIS_POINTS;
        uint256 correctVotes = 0;

        // Count correct votes
        for (uint256 i = 0; i < d.jurorList.length; i++) {
            JurorVote storage vote = d.votes[d.jurorList[i]];
            if (vote.revealed && vote.ruling == winningRuling) {
                correctVotes++;
            }
        }

        if (correctVotes == 0) {
            // Send reward to treasury if no correct votes
            if (totalReward > 0) {
                IERC20(d.token).safeTransfer(treasury, totalReward);
            }
            return;
        }

        // Security: Safe division
        uint256 rewardPerCorrect = totalReward / correctVotes;

        // Distribute rewards and penalties
        for (uint256 i = 0; i < d.jurorList.length; i++) {
            address juror = d.jurorList[i];
            JurorVote storage vote = d.votes[juror];
            JurorInfo storage jurorInfo = jurors[juror];
            
            if (!vote.revealed) {
                // Penalize no-shows
                uint256 penalty = vote.stake;
                jurorInfo.stakedAmount = jurorInfo.stakedAmount > penalty ? jurorInfo.stakedAmount - penalty : 0;
                emit JurorPenalized(disputeId, juror, penalty);
            } else if (vote.ruling == winningRuling) {
                // Reward correct votes
                vote.rewarded = true;
                jurorInfo.correctVotes++;
                
                // Security: Check contract balance before transfer
                if (rewardPerCorrect > 0 && IERC20(d.token).balanceOf(address(this)) >= rewardPerCorrect) {
                    IERC20(d.token).safeTransfer(juror, rewardPerCorrect);
                    emit JurorRewarded(disputeId, juror, rewardPerCorrect);
                }
            } else {
                // Penalize incorrect votes
                uint256 penalty = vote.stake / 2;
                jurorInfo.stakedAmount = jurorInfo.stakedAmount > penalty ? jurorInfo.stakedAmount - penalty : 0;
                emit JurorPenalized(disputeId, juror, penalty);
            }
            
            jurorInfo.totalCases++;
        }
    }

    // ============ Execution ============
    function executeResolution(uint256 disputeId) external validDispute(disputeId) nonReentrant whenNotPaused {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Resolved, "DisputeResolver: not resolved");

        d.status = DisputeStatus.Executed;

        // Security: Safe math with overflow checks
        uint256 clientAmount = (d.escrowAmount * d.clientShare) / BASIS_POINTS;
        uint256 freelancerAmount = (d.escrowAmount * d.freelancerShare) / BASIS_POINTS;
        
        // Verify total doesn't exceed escrow (safety check)
        require(clientAmount + freelancerAmount <= d.escrowAmount, "DisputeResolver: amount overflow");

        // Security: Reentrancy-protected transfers
        if (clientAmount > 0) {
            IERC20(d.token).safeTransfer(d.client, clientAmount);
        }
        if (freelancerAmount > 0) {
            IERC20(d.token).safeTransfer(d.freelancer, freelancerAmount);
        }

        emit DisputeExecuted(disputeId, clientAmount, freelancerAmount);
    }

    // ============ View Functions ============
    function getJurorCount() external view returns (uint256) {
        return jurorPool.length;
    }

    function getSelectedJurors(uint256 disputeId) external view returns (address[] memory) {
        return disputes[disputeId].jurorList;
    }

    function getJurorVote(uint256 disputeId, address juror) external view returns (JurorVote memory) {
        return disputes[disputeId].votes[juror];
    }

    function hashVote(uint256 disputeId, Ruling ruling, uint256 salt) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(disputeId, ruling, salt));
    }

    function isJurorActive(address juror) external view returns (bool) {
        return jurors[juror].isActive;
    }

    receive() external payable {
        revert("DisputeResolver: no ETH accepted");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title DisputeResolver
 * @notice Decentralized dispute resolution with multi-juror pools
 * @dev Replaces single arbitrator model with decentralized juror pools
 * @dev Uses commit-reveal voting and Schelling-point mechanism
 */
contract DisputeResolver is Initializable, AccessControl, ReentrancyGuard, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant JUROR_ROLE = keccak256("JUROR_ROLE");
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

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

    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => bool) public jobHasDispute;
    mapping(address => JurorInfo) public jurors;
    address[] public jurorPool;
    
    uint256 public disputeCount;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_JURORS = 5;
    uint256 public constant MAX_JURORS = 21;
    uint256 public constant EVIDENCE_PERIOD = 3 days;
    uint256 public constant VOTING_PERIOD = 2 days;
    uint256 public constant REVEAL_PERIOD = 1 days;
    uint256 public constant MIN_JUROR_STAKE = 1000 * 10**18;
    uint256 public constant JUROR_REWARD_PERCENT = 2000; // 20% of fees

    address public treasury;

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

    modifier onlyParties(uint256 disputeId) {
        Dispute storage d = disputes[disputeId];
        require(msg.sender == d.client || msg.sender == d.freelancer, "DisputeResolver: not a party");
        _;
    }

    modifier validDispute(uint256 disputeId) {
        require(disputeId > 0 && disputeId <= disputeCount, "DisputeResolver: invalid dispute");
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address daoAddress, address _treasury) public initializer {
        require(daoAddress != address(0), "DisputeResolver: zero DAO");
        require(_treasury != address(0), "DisputeResolver: zero treasury");
        
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, daoAddress);
        _grantRole(DAO_ROLE, daoAddress);
        _grantRole(UPGRADER_ROLE, daoAddress);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // ============ Juror Management ============
    function registerJuror(uint256 stakeAmount, address token) external {
        require(stakeAmount >= MIN_JUROR_STAKE, "DisputeResolver: insufficient stake");
        require(!jurors[msg.sender].isActive, "DisputeResolver: already registered");

        IERC20(token).safeTransferFrom(msg.sender, address(this), stakeAmount);

        jurors[msg.sender] = JurorInfo({
            isActive: true,
            totalCases: 0,
            correctVotes: 0,
            stakedAmount: stakeAmount,
            reputation: 100 // Base reputation
        });

        _grantRole(JUROR_ROLE, msg.sender);
        jurorPool.push(msg.sender);

        emit JurorRegistered(msg.sender, stakeAmount);
    }

    function deregisterJuror(address token) external onlyRole(JUROR_ROLE) {
        JurorInfo storage j = jurors[msg.sender];
        require(j.isActive, "DisputeResolver: not active");
        
        // Cannot deregister if participating in active dispute
        j.isActive = false;
        
        // Return stake
        IERC20(token).safeTransfer(msg.sender, j.stakedAmount);
        j.stakedAmount = 0;

        _revokeRole(JUROR_ROLE, msg.sender);

        // Remove from pool
        for (uint256 i = 0; i < jurorPool.length; i++) {
            if (jurorPool[i] == msg.sender) {
                jurorPool[i] = jurorPool[jurorPool.length - 1];
                jurorPool.pop();
                break;
            }
        }

        emit JurorDeregistered(msg.sender);
    }

    // ============ Dispute Creation ============
    function createDispute(
        uint256 jobId,
        address client,
        address freelancer,
        uint256 escrowAmount,
        address token,
        bytes32 evidenceHash
    ) external returns (uint256 disputeId) {
        require(!jobHasDispute[jobId], "DisputeResolver: dispute exists");
        require(client != address(0) && freelancer != address(0), "DisputeResolver: zero address");
        require(client != freelancer, "DisputeResolver: same party");
        require(escrowAmount > 0, "DisputeResolver: zero amount");
        require(jurorPool.length >= MIN_JURORS, "DisputeResolver: insufficient jurors");

        disputeCount++;
        disputeId = disputeCount;

        Dispute storage d = disputes[disputeId];
        d.id = disputeId;
        d.jobId = jobId;
        d.client = client;
        d.freelancer = freelancer;
        d.escrowAmount = escrowAmount;
        d.token = token;
        d.status = DisputeStatus.Open;
        d.ruling = Ruling.RefusedToArbitrate;
        d.createdAt = block.timestamp;
        d.deadline = block.timestamp + EVIDENCE_PERIOD;
        d.evidenceHash = evidenceHash;
        d.requiredJurors = _calculateJurorCount();

        jobHasDispute[jobId] = true;

        emit DisputeCreated(disputeId, jobId, client, freelancer, escrowAmount);

        if (evidenceHash != bytes32(0)) {
            emit EvidenceSubmitted(disputeId, msg.sender, evidenceHash);
        }

        // Start evidence period
        d.status = DisputeStatus.Evidence;

        return disputeId;
    }

    function _calculateJurorCount() internal view returns (uint256) {
        // Use square root of pool size for juror count
        uint256 count = 1;
        while (count * count < jurorPool.length && count < MAX_JURORS) {
            count++;
        }
        return count < MIN_JURORS ? MIN_JURORS : count;
    }

    // ============ Evidence ============
    function submitEvidence(uint256 disputeId, bytes32 evidenceHash) external validDispute(disputeId) onlyParties(disputeId) {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Evidence, "DisputeResolver: not evidence phase");
        require(block.timestamp < d.deadline, "DisputeResolver: evidence period ended");
        require(evidenceHash != bytes32(0), "DisputeResolver: empty evidence");

        emit EvidenceSubmitted(disputeId, msg.sender, evidenceHash);
    }

    function startVoting(uint256 disputeId) external validDispute(disputeId) onlyRole(DAO_ROLE) {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Evidence, "DisputeResolver: not evidence phase");
        require(block.timestamp >= d.deadline, "DisputeResolver: evidence ongoing");

        d.status = DisputeStatus.Voting;
        d.deadline = block.timestamp + VOTING_PERIOD;

        // Select jurors randomly
        _selectJurors(disputeId);
    }

    function _selectJurors(uint256 disputeId) internal {
        Dispute storage d = disputes[disputeId];
        require(d.jurorList.length == 0, "DisputeResolver: already selected");

        uint256 poolSize = jurorPool.length;
        require(poolSize >= d.requiredJurors, "DisputeResolver: insufficient pool");

        // Use block hash for randomness (in production, use Chainlink VRF)
        uint256 seed = uint256(blockhash(block.number - 1));

        for (uint256 i = 0; i < d.requiredJurors; i++) {
            uint256 index = uint256(keccak256(abi.encode(seed, i))) % poolSize;
            address juror = jurorPool[index];
            
            // Avoid duplicates
            bool alreadySelected = false;
            for (uint256 j = 0; j < d.jurorList.length; j++) {
                if (d.jurorList[j] == juror) {
                    alreadySelected = true;
                    break;
                }
            }

            if (!alreadySelected && jurors[juror].isActive) {
                d.jurorList.push(juror);
            } else if (d.jurorList.length < d.requiredJurors) {
                // Try next index
                d.requiredJurors++;
            }
        }
    }

    // ============ Commit-Reveal Voting ============
    function commitVote(uint256 disputeId, bytes32 commitment) external validDispute(disputeId) onlyRole(JUROR_ROLE) {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Voting, "DisputeResolver: not voting");
        require(block.timestamp < d.deadline, "DisputeResolver: voting ended");
        require(_isSelectedJuror(disputeId, msg.sender), "DisputeResolver: not selected");
        require(d.votes[msg.sender].commitment == bytes32(0), "DisputeResolver: already committed");

        // Require stake
        uint256 stake = jurors[msg.sender].stakedAmount / 10; // 10% of stake
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

    function revealVote(uint256 disputeId, Ruling ruling, uint256 salt) external validDispute(disputeId) onlyRole(JUROR_ROLE) {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Reveal, "DisputeResolver: not reveal phase");
        require(block.timestamp < d.deadline, "DisputeResolver: reveal ended");
        
        JurorVote storage vote = d.votes[msg.sender];
        require(vote.commitment != bytes32(0), "DisputeResolver: not committed");
        require(!vote.revealed, "DisputeResolver: already revealed");
        require(ruling != Ruling.RefusedToArbitrate, "DisputeResolver: invalid ruling");

        // Verify commitment
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

    function startReveal(uint256 disputeId) external validDispute(disputeId) onlyRole(DAO_ROLE) {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Voting, "DisputeResolver: not voting");
        require(block.timestamp >= d.deadline, "DisputeResolver: voting ongoing");

        d.status = DisputeStatus.Reveal;
        d.deadline = block.timestamp + REVEAL_PERIOD;
    }

    // ============ Resolution ============
    function resolveDispute(uint256 disputeId) external validDispute(disputeId) {
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
        uint256 totalReward = (d.escrowAmount * JUROR_REWARD_PERCENT) / BASIS_POINTS;
        uint256 correctVotes = 0;

        // Count correct votes
        for (uint256 i = 0; i < d.jurorList.length; i++) {
            JurorVote storage vote = d.votes[d.jurorList[i]];
            if (vote.revealed && vote.ruling == winningRuling) {
                correctVotes++;
            }
        }

        if (correctVotes == 0) return; // No one to reward

        uint256 rewardPerCorrect = totalReward / correctVotes;

        // Distribute rewards and penalties
        for (uint256 i = 0; i < d.jurorList.length; i++) {
            address juror = d.jurorList[i];
            JurorVote storage vote = d.votes[juror];
            
            if (!vote.revealed) {
                // Penalize no-shows
                jurors[juror].stakedAmount -= vote.stake;
                emit JurorPenalized(disputeId, juror, vote.stake);
            } else if (vote.ruling == winningRuling) {
                // Reward correct votes
                vote.rewarded = true;
                jurors[juror].correctVotes++;
                IERC20(d.token).safeTransfer(juror, rewardPerCorrect);
                emit JurorRewarded(disputeId, juror, rewardPerCorrect);
            } else {
                // Penalize incorrect votes
                uint256 penalty = vote.stake / 2;
                jurors[juror].stakedAmount -= penalty;
                emit JurorPenalized(disputeId, juror, penalty);
            }
            
            jurors[juror].totalCases++;
        }
    }

    // ============ Execution ============
    function executeResolution(uint256 disputeId) external validDispute(disputeId) nonReentrant {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Resolved, "DisputeResolver: not resolved");

        d.status = DisputeStatus.Executed;

        uint256 clientAmount = (d.escrowAmount * d.clientShare) / BASIS_POINTS;
        uint256 freelancerAmount = (d.escrowAmount * d.freelancerShare) / BASIS_POINTS;

        // Transfer to parties
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

    receive() external payable {}
}

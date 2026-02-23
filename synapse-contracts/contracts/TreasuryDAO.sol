// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title TreasuryDAO
 * @notice DAO-controlled treasury with proposal/voting system
 * @dev No admin keys - all actions require DAO vote. Supports ETH and ERC20 tokens.
 */
contract TreasuryDAO is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address;

    // ============ Roles ============
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");

    // ============ Proposal Configuration ============
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant EXECUTION_DELAY = 1 days;
    uint256 public constant MIN_QUORUM = 1000 * 10**18; // 1000 HSK minimum quorum
    uint256 public constant PROPOSAL_THRESHOLD = 100 * 10**18; // 100 HSK to propose

    // ============ Proposal State ============
    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }

    struct Proposal {
        uint256 id;
        address proposer;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 startBlock;
        uint256 endBlock;
        bool executed;
        bool canceled;
        mapping(address => Receipt) receipts;
    }

    struct Receipt {
        bool hasVoted;
        uint8 support; // 0=against, 1=for, 2=abstain
        uint256 votes;
    }

    // ============ Storage ============
    IERC20 public governanceToken;
    mapping(uint256 => Proposal) public proposals;
    mapping(bytes32 => uint256) public proposalIds;
    mapping(address => uint256) public latestProposalIds;
    uint256 public proposalCount;
    uint256 public proposalTimelock; // Delay before execution

    // ============ Events ============
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        address[] targets,
        uint256[] values,
        bytes[] calldatas,
        string description,
        uint256 startBlock,
        uint256 endBlock
    );
    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        uint8 support,
        uint256 votes
    );
    event ProposalCanceled(uint256 indexed id);
    event ProposalQueued(uint256 indexed id, uint256 eta);
    event ProposalExecuted(uint256 indexed id);
    event ETHReceived(address indexed sender, uint256 amount);
    event TokenDeposited(address indexed token, address indexed sender, uint256 amount);
    event FundsWithdrawn(address indexed token, address indexed recipient, uint256 amount);

    // ============ Modifiers ============
    modifier onlyTokenHolder() {
        require(governanceToken.balanceOf(msg.sender) > 0, "TreasuryDAO: must hold tokens");
        _;
    }

    // ============ Constructor ============
    /**
     * @notice Initialize DAO treasury
     * @param _governanceToken The HSK token used for governance
     * @param _proposerRole Initial proposers (can be set to community members)
     */
    constructor(address _governanceToken, address[] memory _proposerRole) {
        require(_governanceToken != address(0), "TreasuryDAO: zero address");
        governanceToken = IERC20(_governanceToken);
        proposalTimelock = EXECUTION_DELAY;

        // Grant proposer role to specified addresses
        _grantRole(DEFAULT_ADMIN_ROLE, address(this));
        
        for (uint256 i = 0; i < _proposerRole.length; i++) {
            require(_proposerRole[i] != address(0), "TreasuryDAO: zero proposer");
            _grantRole(PROPOSER_ROLE, _proposerRole[i]);
        }
    }

    // ============ Proposal Functions ============
    /**
     * @notice Create a new proposal
     * @param targets Contract addresses to call
     * @param values ETH values to send
     * @param calldatas Function call data
     * @param description Proposal description (IPFS hash recommended)
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) external onlyTokenHolder returns (uint256) {
        require(
            hasRole(PROPOSER_ROLE, msg.sender) || 
            governanceToken.balanceOf(msg.sender) >= PROPOSAL_THRESHOLD,
            "TreasuryDAO: below proposal threshold"
        );
        require(
            targets.length == values.length && targets.length == calldatas.length,
            "TreasuryDAO: invalid proposal length"
        );
        require(targets.length > 0, "TreasuryDAO: empty proposal");
        require(bytes(description).length > 0, "TreasuryDAO: empty description");

        uint256 latestProposalId = latestProposalIds[msg.sender];
        if (latestProposalId != 0) {
            require(
                state(latestProposalId) != ProposalState.Active,
                "TreasuryDAO: active proposal exists"
            );
        }

        proposalCount++;
        uint256 proposalId = proposalCount;
        
        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.targets = targets;
        newProposal.values = values;
        newProposal.calldatas = calldatas;
        newProposal.description = description;
        newProposal.startBlock = block.timestamp;
        newProposal.endBlock = block.timestamp + VOTING_PERIOD;

        latestProposalIds[msg.sender] = proposalId;

        emit ProposalCreated(
            proposalId,
            msg.sender,
            targets,
            values,
            calldatas,
            description,
            newProposal.startBlock,
            newProposal.endBlock
        );

        return proposalId;
    }

    /**
     * @notice Cast a vote on a proposal
     * @param proposalId The proposal to vote on
     * @param support 0=against, 1=for, 2=abstain
     */
    function castVote(uint256 proposalId, uint8 support) external {
        require(state(proposalId) == ProposalState.Active, "TreasuryDAO: voting closed");
        require(support <= 2, "TreasuryDAO: invalid vote type");

        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = proposal.receipts[msg.sender];
        
        require(!receipt.hasVoted, "TreasuryDAO: already voted");

        uint256 votes = governanceToken.balanceOf(msg.sender);
        require(votes > 0, "TreasuryDAO: no voting power");

        if (support == 0) {
            proposal.againstVotes += votes;
        } else if (support == 1) {
            proposal.forVotes += votes;
        } else {
            proposal.abstainVotes += votes;
        }

        receipt.hasVoted = true;
        receipt.support = support;
        receipt.votes = votes;

        emit VoteCast(msg.sender, proposalId, support, votes);
    }

    /**
     * @notice Execute a successful proposal
     * @param proposalId The proposal to execute
     */
    function execute(uint256 proposalId) external payable nonReentrant {
        require(
            state(proposalId) == ProposalState.Succeeded,
            "TreasuryDAO: proposal not succeeded"
        );

        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success, ) = proposal.targets[i].call{value: proposal.values[i]}(
                proposal.calldatas[i]
            );
            require(success, "TreasuryDAO: execution failed");
        }

        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice Cancel a proposal (only proposer before voting starts)
     * @param proposalId The proposal to cancel
     */
    function cancel(uint256 proposalId) external {
        require(state(proposalId) == ProposalState.Pending, "TreasuryDAO: can only cancel pending");
        
        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.proposer || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "TreasuryDAO: not proposer"
        );

        proposal.canceled = true;

        emit ProposalCanceled(proposalId);
    }

    // ============ State Functions ============
    /**
     * @notice Get the current state of a proposal
     * @param proposalId The proposal to check
     * @return Current ProposalState
     */
    function state(uint256 proposalId) public view returns (ProposalState) {
        require(proposalCount >= proposalId && proposalId > 0, "TreasuryDAO: invalid proposal id");
        
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.canceled) {
            return ProposalState.Canceled;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else if (block.timestamp <= proposal.startBlock) {
            return ProposalState.Pending;
        } else if (block.timestamp <= proposal.endBlock) {
            return ProposalState.Active;
        } else if (proposal.forVotes <= proposal.againstVotes || proposal.forVotes < MIN_QUORUM) {
            return ProposalState.Defeated;
        } else {
            return ProposalState.Succeeded;
        }
    }

    /**
     * @notice Check if a proposal is executable
     * @param proposalId The proposal to check
     */
    function isExecutable(uint256 proposalId) external view returns (bool) {
        return state(proposalId) == ProposalState.Succeeded;
    }

    /**
     * @notice Get proposal details
     */
    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        address proposer,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        uint256 startBlock,
        uint256 endBlock,
        bool executed,
        bool canceled
    ) {
        Proposal storage p = proposals[proposalId];
        return (
            p.id,
            p.proposer,
            p.forVotes,
            p.againstVotes,
            p.abstainVotes,
            p.startBlock,
            p.endBlock,
            p.executed,
            p.canceled
        );
    }

    /**
     * @notice Get voter receipt
     */
    function getReceipt(uint256 proposalId, address voter) external view returns (Receipt memory) {
        return proposals[proposalId].receipts[voter];
    }

    // ============ Treasury Functions ============
    /**
     * @notice Receive ETH deposits
     */
    receive() external payable {
        emit ETHReceived(msg.sender, msg.value);
    }

    /**
     * @notice Deposit ERC20 tokens to treasury
     * @param token The token to deposit
     * @param amount Amount to deposit
     */
    function depositToken(address token, uint256 amount) external {
        require(token != address(0), "TreasuryDAO: zero token");
        require(amount > 0, "TreasuryDAO: zero amount");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit TokenDeposited(token, msg.sender, amount);
    }

    /**
     * @notice Get ETH balance of treasury
     */
    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get ERC20 token balance
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @notice Emergency token recovery (requires DAO proposal)
     * @dev This is callable via execute() only
     */
    function recoverTokens(address token, address to, uint256 amount) external {
        require(msg.sender == address(this), "TreasuryDAO: only via proposal");
        require(to != address(0), "TreasuryDAO: zero recipient");
        
        IERC20(token).safeTransfer(to, amount);
        emit FundsWithdrawn(token, to, amount);
    }

    // ============ Governance Updates ============
    /**
     * @notice Update proposal timelock (via proposal only)
     */
    function setProposalTimelock(uint256 newTimelock) external {
        require(msg.sender == address(this), "TreasuryDAO: only via proposal");
        proposalTimelock = newTimelock;
    }

    /**
     * @notice Grant proposer role (via proposal only)
     */
    function grantProposerRole(address account) external {
        require(msg.sender == address(this), "TreasuryDAO: only via proposal");
        _grantRole(PROPOSER_ROLE, account);
    }

    /**
     * @notice Revoke proposer role (via proposal only)
     */
    function revokeProposerRole(address account) external {
        require(msg.sender == address(this), "TreasuryDAO: only via proposal");
        _revokeRole(PROPOSER_ROLE, account);
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SynapseGovernor
 * @notice Enhanced governance with delegation, quadratic voting, and proposal templates
 * @dev Extends basic DAO with advanced governance features
 */
contract SynapseGovernor is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Structs ============
    struct Proposal {
        uint256 id;
        address proposer;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string description;
        string title;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 quadraticForVotes;
        uint256 quadraticAgainstVotes;
        uint256 startTime;
        uint256 endTime;
        uint256 eta; // Execution time after timelock
        bool executed;
        bool canceled;
        bool useQuadraticVoting;
        uint8 proposalType; // 0=general, 1=treasury, 2=parameter, 3=upgrade
        mapping(address => Receipt) receipts;
    }

    struct Receipt {
        bool hasVoted;
        uint8 support; // 0=against, 1=for, 2=abstain
        uint256 votes;
        uint256 quadraticVotes;
    }

    struct DelegateInfo {
        address delegate;
        uint256 delegatedAmount;
        uint256 delegatedAt;
        bool isActive;
    }

    struct ProposalTemplate {
        string name;
        string description;
        uint8 proposalType;
        address[] defaultTargets;
        bytes[] defaultCalldatas;
        bool useQuadraticVoting;
        uint256 votingPeriod;
    }

    // ============ Enums ============
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

    // ============ Constants ============
    uint256 public constant DEFAULT_VOTING_PERIOD = 3 days;
    uint256 public constant DEFAULT_TIMELock = 2 days;
    uint256 public constant MIN_QUORUM = 1000e18; // 1000 tokens
    uint256 public constant PROPOSAL_THRESHOLD = 100e18; // 100 tokens
    uint256 public constant QUADRATIC_VOTE_CAP = 1000e18; // Max votes for quadratic

    // ============ State Variables ============
    IERC20 public governanceToken;
    address public timelock;
    
    mapping(uint256 => Proposal) public proposals;
    mapping(address => DelegateInfo) public delegates;
    mapping(address => mapping(address => uint256)) public delegatedVotes; // delegator => delegate => amount
    mapping(uint256 => ProposalTemplate) public proposalTemplates;
    mapping(address => uint256) public latestProposalIds;
    mapping(address => uint256) public votingPower;
    mapping(bytes32 => uint256) public proposalHashes;
    
    uint256 public proposalCount;
    uint256 public templateCount;
    uint256 public quorum;
    uint256 public proposalThreshold;
    uint256 public votingPeriod;
    uint256 public timelockDelay;
    
    bool public quadraticVotingEnabled;

    // ============ Events ============
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        string title,
        uint8 proposalType,
        bool useQuadraticVoting,
        uint256 startTime,
        uint256 endTime
    );
    
    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        uint8 support,
        uint256 votes,
        uint256 quadraticVotes,
        string reason
    );
    
    event VoteDelegated(
        address indexed delegator,
        address indexed delegate,
        uint256 amount
    );
    
    event DelegationRevoked(
        address indexed delegator,
        address indexed delegate,
        uint256 amount
    );
    
    event ProposalExecuted(uint256 indexed id);
    event ProposalCanceled(uint256 indexed id);
    event ProposalQueued(uint256 indexed id, uint256 eta);
    event TemplateCreated(uint256 indexed templateId, string name);
    event TimelockUpdated(address indexed newTimelock);
    event QuorumUpdated(uint256 newQuorum);
    event VotingPeriodUpdated(uint256 newVotingPeriod);

    // ============ Modifiers ============
    modifier onlyTimelock() {
        require(msg.sender == timelock, "Governor: only timelock");
        _;
    }

    // ============ Constructor ============
    constructor(
        address _governanceToken,
        address _timelock,
        uint256 _quorum,
        uint256 _votingPeriod
    ) {
        require(_governanceToken != address(0), "Governor: zero token");
        require(_timelock != address(0), "Governor: zero timelock");
        
        governanceToken = IERC20(_governanceToken);
        timelock = _timelock;
        quorum = _quorum > 0 ? _quorum : MIN_QUORUM;
        proposalThreshold = PROPOSAL_THRESHOLD;
        votingPeriod = _votingPeriod > 0 ? _votingPeriod : DEFAULT_VOTING_PERIOD;
        timelockDelay = DEFAULT_TIMELock;
    }

    // ============ Proposal Creation ============
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory title,
        string memory description,
        uint8 proposalType,
        bool useQuadraticVoting
    ) external returns (uint256) {
        require(
            governanceToken.balanceOf(msg.sender) >= proposalThreshold,
            "Governor: below threshold"
        );
        require(
            targets.length == values.length && targets.length == calldatas.length,
            "Governor: length mismatch"
        );
        require(targets.length > 0, "Governor: empty proposal");
        require(bytes(title).length > 0, "Governor: empty title");

        // Check for active proposal
        uint256 latestId = latestProposalIds[msg.sender];
        if (latestId != 0) {
            require(
                state(latestId) != ProposalState.Active,
                "Governor: active proposal exists"
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
        newProposal.title = title;
        newProposal.description = description;
        newProposal.proposalType = proposalType;
        newProposal.useQuadraticVoting = useQuadraticVoting && quadraticVotingEnabled;
        newProposal.startTime = block.timestamp;
        newProposal.endTime = block.timestamp + votingPeriod;

        latestProposalIds[msg.sender] = proposalId;

        emit ProposalCreated(
            proposalId,
            msg.sender,
            title,
            proposalType,
            newProposal.useQuadraticVoting,
            newProposal.startTime,
            newProposal.endTime
        );

        return proposalId;
    }

    function proposeFromTemplate(
        uint256 templateId,
        string memory title,
        string memory description,
        bytes[] memory customCalldatas
    ) external returns (uint256) {
        require(templateId > 0 && templateId <= templateCount, "Governor: invalid template");
        
        ProposalTemplate storage template = proposalTemplates[templateId];
        bytes[] memory calldatas = customCalldatas.length > 0 
            ? customCalldatas 
            : template.defaultCalldatas;
        
        uint256[] memory values = new uint256[](template.defaultTargets.length);
        
        return propose(
            template.defaultTargets,
            values,
            calldatas,
            title,
            description,
            template.proposalType,
            template.useQuadraticVoting
        );
    }

    // ============ Voting ============
    function castVote(
        uint256 proposalId,
        uint8 support,
        string memory reason
    ) external {
        require(state(proposalId) == ProposalState.Active, "Governor: not active");
        require(support <= 2, "Governor: invalid support");

        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = proposal.receipts[msg.sender];
        
        require(!receipt.hasVoted, "Governor: already voted");

        uint256 votes = getVotes(msg.sender);
        require(votes > 0, "Governor: no voting power");

        uint256 quadraticVotes = calculateQuadraticVotes(votes);

        receipt.hasVoted = true;
        receipt.support = support;
        receipt.votes = votes;
        receipt.quadraticVotes = quadraticVotes;

        if (support == 0) {
            proposal.againstVotes += votes;
            if (proposal.useQuadraticVoting) {
                proposal.quadraticAgainstVotes += quadraticVotes;
            }
        } else if (support == 1) {
            proposal.forVotes += votes;
            if (proposal.useQuadraticVoting) {
                proposal.quadraticForVotes += quadraticVotes;
            }
        } else {
            proposal.abstainVotes += votes;
        }

        emit VoteCast(msg.sender, proposalId, support, votes, quadraticVotes, reason);
    }

    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        string memory reason,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("SynapseGovernor")),
                block.chainid,
                address(this)
            )
        );
        
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Ballot(uint256 proposalId,uint8 support)"),
                proposalId,
                support
            )
        );
        
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );
        
        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "Governor: invalid signature");
        
        // Call internal vote casting
        _castVoteInternal(signatory, proposalId, support, reason);
    }

    function _castVoteInternal(
        address voter,
        uint256 proposalId,
        uint8 support,
        string memory reason
    ) internal {
        require(state(proposalId) == ProposalState.Active, "Governor: not active");
        
        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = proposal.receipts[voter];
        
        require(!receipt.hasVoted, "Governor: already voted");

        uint256 votes = getVotes(voter);
        require(votes > 0, "Governor: no voting power");

        uint256 quadraticVotes = calculateQuadraticVotes(votes);

        receipt.hasVoted = true;
        receipt.support = support;
        receipt.votes = votes;
        receipt.quadraticVotes = quadraticVotes;

        if (support == 0) {
            proposal.againstVotes += votes;
            if (proposal.useQuadraticVoting) {
                proposal.quadraticAgainstVotes += quadraticVotes;
            }
        } else if (support == 1) {
            proposal.forVotes += votes;
            if (proposal.useQuadraticVoting) {
                proposal.quadraticForVotes += quadraticVotes;
            }
        } else {
            proposal.abstainVotes += votes;
        }

        emit VoteCast(voter, proposalId, support, votes, quadraticVotes, reason);
    }

    // ============ Delegation ============
    function delegate(address delegatee, uint256 amount) external {
        require(delegatee != address(0), "Governor: zero delegate");
        require(delegatee != msg.sender, "Governor: self delegation");
        require(amount > 0, "Governor: zero amount");
        require(
            governanceToken.balanceOf(msg.sender) >= amount,
            "Governor: insufficient balance"
        );

        DelegateInfo storage info = delegates[msg.sender];
        
        // Revoke existing delegation if any
        if (info.isActive && info.delegate != address(0)) {
            _revokeDelegation(msg.sender);
        }

        info.delegate = delegatee;
        info.delegatedAmount = amount;
        info.delegatedAt = block.timestamp;
        info.isActive = true;

        delegatedVotes[msg.sender][delegatee] = amount;

        emit VoteDelegated(msg.sender, delegatee, amount);
    }

    function revokeDelegation() external {
        _revokeDelegation(msg.sender);
    }

    function _revokeDelegation(address delegator) internal {
        DelegateInfo storage info = delegates[delegator];
        require(info.isActive, "Governor: no active delegation");

        address previousDelegate = info.delegate;
        uint256 amount = info.delegatedAmount;

        delegatedVotes[delegator][previousDelegate] = 0;
        
        info.delegate = address(0);
        info.delegatedAmount = 0;
        info.isActive = false;

        emit DelegationRevoked(delegator, previousDelegate, amount);
    }

    // ============ Proposal Execution ============
    function queue(uint256 proposalId) external {
        require(
            state(proposalId) == ProposalState.Succeeded,
            "Governor: not succeeded"
        );
        
        Proposal storage proposal = proposals[proposalId];
        require(proposal.eta == 0, "Governor: already queued");

        uint256 eta = block.timestamp + timelockDelay;
        proposal.eta = eta;

        // Queue transactions in timelock
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            _queueTransaction(
                proposal.targets[i],
                proposal.values[i],
                proposal.calldatas[i],
                eta
            );
        }

        emit ProposalQueued(proposalId, eta);
    }

    function execute(uint256 proposalId) external payable nonReentrant {
        require(
            state(proposalId) == ProposalState.Queued,
            "Governor: not queued"
        );
        
        Proposal storage proposal = proposals[proposalId];
        require(
            block.timestamp >= proposal.eta,
            "Governor: timelock not expired"
        );

        proposal.executed = true;

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            _executeTransaction(
                proposal.targets[i],
                proposal.values[i],
                proposal.calldatas[i],
                proposal.eta
            );
        }

        emit ProposalExecuted(proposalId);
    }

    function cancel(uint256 proposalId) external {
        ProposalState currentState = state(proposalId);
        require(
            currentState != ProposalState.Executed && 
            currentState != ProposalState.Canceled,
            "Governor: cannot cancel"
        );

        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.proposer ||
            governanceToken.balanceOf(proposal.proposer) < proposalThreshold,
            "Governor: cannot cancel"
        );

        proposal.canceled = true;

        emit ProposalCanceled(proposalId);
    }

    // ============ Template Management ============
    function createTemplate(
        string memory name,
        string memory description,
        uint8 proposalType,
        address[] memory defaultTargets,
        bytes[] memory defaultCalldatas,
        bool useQuadraticVoting,
        uint256 templateVotingPeriod
    ) external onlyTimelock returns (uint256) {
        templateCount++;
        
        proposalTemplates[templateCount] = ProposalTemplate({
            name: name,
            description: description,
            proposalType: proposalType,
            defaultTargets: defaultTargets,
            defaultCalldatas: defaultCalldatas,
            useQuadraticVoting: useQuadraticVoting,
            votingPeriod: templateVotingPeriod > 0 ? templateVotingPeriod : votingPeriod
        });

        emit TemplateCreated(templateCount, name);
        return templateCount;
    }

    // ============ View Functions ============
    function state(uint256 proposalId) public view returns (ProposalState) {
        require(proposalId > 0 && proposalId <= proposalCount, "Governor: invalid id");
        
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.canceled) {
            return ProposalState.Canceled;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else if (block.timestamp <= proposal.startTime) {
            return ProposalState.Pending;
        } else if (block.timestamp <= proposal.endTime) {
            return ProposalState.Active;
        } else if (proposal.eta > 0) {
            return block.timestamp >= proposal.eta 
                ? ProposalState.Expired 
                : ProposalState.Queued;
        } else if (_isDefeated(proposal)) {
            return ProposalState.Defeated;
        } else {
            return ProposalState.Succeeded;
        }
    }

    function _isDefeated(Proposal storage proposal) internal view returns (bool) {
        if (proposal.useQuadraticVoting) {
            return proposal.quadraticForVotes <= proposal.quadraticAgainstVotes ||
                   proposal.quadraticForVotes < quorum;
        }
        return proposal.forVotes <= proposal.againstVotes ||
               proposal.forVotes < quorum;
    }

    function getVotes(address account) public view returns (uint256) {
        uint256 ownVotes = governanceToken.balanceOf(account);
        
        // Add delegated votes
        DelegateInfo storage info = delegates[account];
        if (info.isActive && info.delegate == account) {
            ownVotes += info.delegatedAmount;
        }
        
        return ownVotes;
    }

    function calculateQuadraticVotes(uint256 votes) public pure returns (uint256) {
        if (votes > QUADRATIC_VOTE_CAP) {
            votes = QUADRATIC_VOTE_CAP;
        }
        // Square root of votes (simplified for gas efficiency)
        return _sqrt(votes);
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        
        return y;
    }

    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        address proposer,
        string memory title,
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        uint256 startTime,
        uint256 endTime,
        uint256 eta,
        bool executed,
        bool canceled,
        bool useQuadraticVoting,
        uint8 proposalType
    ) {
        Proposal storage p = proposals[proposalId];
        return (
            p.id,
            p.proposer,
            p.title,
            p.description,
            p.forVotes,
            p.againstVotes,
            p.abstainVotes,
            p.startTime,
            p.endTime,
            p.eta,
            p.executed,
            p.canceled,
            p.useQuadraticVoting,
            p.proposalType
        );
    }

    function getReceipt(uint256 proposalId, address voter) external view returns (Receipt memory) {
        return proposals[proposalId].receipts[voter];
    }

    function getActions(uint256 proposalId) external view returns (
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas
    ) {
        Proposal storage p = proposals[proposalId];
        return (p.targets, p.values, p.calldatas);
    }

    // ============ Admin Functions ============
    function setQuorum(uint256 newQuorum) external onlyTimelock {
        quorum = newQuorum;
        emit QuorumUpdated(newQuorum);
    }

    function setVotingPeriod(uint256 newVotingPeriod) external onlyTimelock {
        require(newVotingPeriod >= 1 days, "Governor: too short");
        votingPeriod = newVotingPeriod;
        emit VotingPeriodUpdated(newVotingPeriod);
    }

    function setTimelock(address newTimelock) external onlyTimelock {
        require(newTimelock != address(0), "Governor: zero timelock");
        timelock = newTimelock;
        emit TimelockUpdated(newTimelock);
    }

    function setQuadraticVotingEnabled(bool enabled) external onlyTimelock {
        quadraticVotingEnabled = enabled;
    }

    // ============ Internal Functions ============
    function _queueTransaction(
        address target,
        uint256 value,
        bytes memory data,
        uint256 eta
    ) internal {
        // Call to timelock contract would go here
        // This is a simplified version
    }

    function _executeTransaction(
        address target,
        uint256 value,
        bytes memory data,
        uint256 eta
    ) internal {
        (bool success, ) = target.call{value: value}(data);
        require(success, "Governor: execution failed");
    }

    receive() external payable {}
}
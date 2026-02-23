// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title DisputeResolverKleros
 * @notice Kleros-compatible dispute resolution
 * @dev Integrates with Kleros arbitrator for true decentralization
 */
contract DisputeResolverKleros is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant JOB_REGISTRY_ROLE = keccak256("JOB_REGISTRY_ROLE");

    // Kleros Arbitrator interface
    IArbitrator public arbitrator;
    bytes public arbitratorExtraData;

    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_ARBITRATORS = 3;

    enum DisputeStatus { None, Open, Ruling, Resolved, Executed }

    struct Dispute {
        uint256 id;
        uint256 jobId;
        address client;
        address freelancer;
        uint256 escrowAmount;
        address token;
        DisputeStatus status;
        uint256 ruling; // Kleros ruling
        uint256 createdAt;
        uint256 resolvedAt;
        uint256 externalDisputeId; // Kleros dispute ID
        bytes32 evidenceHash;
        uint256 clientShare;
        uint256 freelancerShare;
    }

    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => bool) public jobHasDispute;
    mapping(uint256 => uint256) public externalToInternalDispute;
    
    uint256 public disputeCount;
    uint256 public arbitrationFee; // Fee paid to Kleros
    uint256 public minArbitratorCount;

    // Required arbitrators for decentralization
    address[] public registeredArbitratorContracts;

    event DisputeCreated(
        uint256 indexed disputeId,
        uint256 indexed jobId,
        uint256 indexed externalDisputeId,
        uint256 amount
    );
    event EvidenceSubmitted(uint256 indexed disputeId, address submitter, bytes32 evidenceHash);
    event RulingReceived(uint256 indexed disputeId, uint256 indexed externalDisputeId, uint256 ruling);
    event DisputeExecuted(uint256 indexed disputeId, uint256 clientAmount, uint256 freelancerAmount);
    event ArbitratorChanged(address indexed newArbitrator);

    modifier onlyParties(uint256 disputeId) {
        Dispute storage d = disputes[disputeId];
        require(
            msg.sender == d.client || msg.sender == d.freelancer,
            "DisputeResolver: not a party"
        );
        _;
    }

    /**
     * @notice Initialize with Kleros arbitrator
     */
    constructor(address dao, address _arbitrator, bytes memory _extraData) {
        require(dao != address(0), "DisputeResolver: zero dao");
        require(_arbitrator != address(0), "DisputeResolver: zero arbitrator");
        
        _grantRole(DEFAULT_ADMIN_ROLE, dao);
        _grantRole(DAO_ROLE, dao);
        
        arbitrator = IArbitrator(_arbitrator);
        arbitratorExtraData = _extraData;
        minArbitratorCount = MIN_ARBITRATORS;
    }

    /**
     * @notice Create dispute through Kleros
     */
    function createDispute(
        uint256 jobId,
        address client,
        address freelancer,
        uint256 escrowAmount,
        address token,
        bytes32 evidenceHash
    ) external payable onlyRole(JOB_REGISTRY_ROLE) returns (uint256 disputeId) {
        require(!jobHasDispute[jobId], "DisputeResolver: dispute exists");
        require(client != address(0) && freelancer != address(0), "DisputeResolver: zero address");
        require(escrowAmount > 0, "DisputeResolver: zero amount");
        require(
            registeredArbitratorContracts.length >= minArbitratorCount,
            "DisputeResolver: insufficient arbitrators"
        );

        // Create dispute in Kleros
        uint256 externalDisputeId = arbitrator.createDispute{value: msg.value}(
            2, // Number of choices (client wins, freelancer wins)
            arbitratorExtraData
        );

        disputeCount++;
        disputeId = disputeCount;

        disputes[disputeId] = Dispute({
            id: disputeId,
            jobId: jobId,
            client: client,
            freelancer: freelancer,
            escrowAmount: escrowAmount,
            token: token,
            status: DisputeStatus.Open,
            ruling: 0,
            createdAt: block.timestamp,
            resolvedAt: 0,
            externalDisputeId: externalDisputeId,
            evidenceHash: evidenceHash,
            clientShare: 0,
            freelancerShare: 0
        });

        jobHasDispute[jobId] = true;
        externalToInternalDispute[externalDisputeId] = disputeId;

        emit DisputeCreated(disputeId, jobId, externalDisputeId, escrowAmount);
    }

    /**
     * @notice Submit evidence to Kleros
     */
    function submitEvidence(
        uint256 disputeId,
        bytes32 evidenceHash
    ) external onlyParties(disputeId) {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Open, "DisputeResolver: not open");
        require(evidenceHash != bytes32(0), "DisputeResolver: empty evidence");

        d.evidenceHash = evidenceHash;

        // Submit to Kleros
        arbitrator.submitEvidence(d.externalDisputeId, _evidenceToString(evidenceHash));

        emit EvidenceSubmitted(disputeId, msg.sender, evidenceHash);
    }

    /**
     * @notice Callback from Kleros when ruling is made
     */
    function rule(uint256 _disputeID, uint256 _ruling) external {
        require(msg.sender == address(arbitrator), "DisputeResolver: not arbitrator");
        
        uint256 internalId = externalToInternalDispute[_disputeID];
        Dispute storage d = disputes[internalId];
        
        require(d.status == DisputeStatus.Open, "DisputeResolver: not open");
        
        d.status = DisputeStatus.Resolved;
        d.ruling = _ruling;
        d.resolvedAt = block.timestamp;

        // Set shares based on ruling
        if (_ruling == 1) {
            // Client wins
            d.clientShare = BASIS_POINTS;
            d.freelancerShare = 0;
        } else if (_ruling == 2) {
            // Freelancer wins
            d.clientShare = 0;
            d.freelancerShare = BASIS_POINTS;
        } else {
            // Split (Refused to arbitrate or invalid)
            d.clientShare = BASIS_POINTS / 2;
            d.freelancerShare = BASIS_POINTS / 2;
        }

        emit RulingReceived(internalId, _disputeID, _ruling);
    }

    /**
     * @notice Execute resolution and distribute funds
     */
    function executeResolution(uint256 disputeId) external nonReentrant {
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.Resolved, "DisputeResolver: not resolved");

        d.status = DisputeStatus.Executed;

        uint256 clientAmount = (d.escrowAmount * d.clientShare) / BASIS_POINTS;
        uint256 freelancerAmount = (d.escrowAmount * d.freelancerShare) / BASIS_POINTS;

        // Distribute
        if (clientAmount > 0) {
            _transfer(d.token, d.client, clientAmount);
        }
        if (freelancerAmount > 0) {
            _transfer(d.token, d.freelancer, freelancerAmount);
        }

        emit DisputeExecuted(disputeId, clientAmount, freelancerAmount);
    }

    /**
     * @notice Register a new arbitrator contract (for redundancy)
     */
    function registerArbitratorContract(address arbitratorContract) external onlyRole(DAO_ROLE) {
        require(arbitratorContract != address(0), "DisputeResolver: zero address");
        
        for (uint i = 0; i < registeredArbitratorContracts.length; i++) {
            require(
                registeredArbitratorContracts[i] != arbitratorContract,
                "DisputeResolver: already registered"
            );
        }
        
        registeredArbitratorContracts.push(arbitratorContract);
    }

    /**
     * @notice Change primary Kleros arbitrator
     */
    function setArbitrator(address newArbitrator) external onlyRole(DAO_ROLE) {
        require(newArbitrator != address(0), "DisputeResolver: zero address");
        arbitrator = IArbitrator(newArbitrator);
        emit ArbitratorChanged(newArbitrator);
    }

    function _transfer(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "DisputeResolver: ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function _evidenceToString(bytes32 hash) internal pure returns (string memory) {
        // Convert bytes32 to IPFS hash string
        return string(abi.encodePacked("ipfs://", _toBase58(hash)));
    }

    function _toBase58(bytes32 source) internal pure returns (bytes memory) {
        // Simplified - in production use proper base58 encoding
        return abi.encodePacked(source);
    }

    function getArbitratorCount() external view returns (uint256) {
        return registeredArbitratorContracts.length;
    }

    receive() external payable {}
}

// Kleros Arbitrator interface
interface IArbitrator {
    function createDispute(uint256 _choices, bytes memory _extraData) external payable returns (uint256 disputeID);
    function submitEvidence(uint256 _disputeID, string memory _evidence) external;
    function arbitrationCost(bytes memory _extraData) external view returns (uint256 cost);
    function appealPeriod(uint256 _disputeID) external view returns (uint256 start, uint256 end);
}

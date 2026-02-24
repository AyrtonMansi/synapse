// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title NodeRegistry
 * @dev Manages node registration, staking, and slashing
 */
contract NodeRegistry is Ownable {
    using ECDSA for bytes32;
    
    struct Node {
        address owner;
        bytes32 fingerprint;
        string hardware;
        uint256 stakedAmount;
        uint256 registeredAt;
        uint256 lastHeartbeat;
        uint256 totalJobs;
        uint256 successfulJobs;
        bool isActive;
        bool isSlashed;
    }
    
    // Minimum stake required to register (1000 HSK)
    uint256 public constant MIN_STAKE = 1000 * 10**18;
    
    // Stake token (HSK)
    address public stakingToken;
    
    // Node storage: fingerprint => Node
    mapping(bytes32 => Node) public nodes;
    
    // Owner => fingerprint lookup
    mapping(address => bytes32[]) public ownerNodes;
    
    // Authorized slashers (settlement service)
    mapping(address => bool) public authorizedSlashers;
    
    // Nonce tracking for receipt verification
    mapping(bytes32 => mapping(uint256 => bool)) public usedNonces;
    
    uint256 public totalStaked;
    uint256 public activeNodeCount;
    
    event NodeRegistered(bytes32 indexed fingerprint, address indexed owner, uint256 stake);
    event NodeUnregistered(bytes32 indexed fingerprint, uint256 stakeReturned);
    event NodeSlashed(bytes32 indexed fingerprint, uint256 amount, string reason);
    event Heartbeat(bytes32 indexed fingerprint, uint256 timestamp);
    event SlasherAuthorized(address indexed slasher);
    
    modifier onlySlasher() {
        require(authorizedSlashers[msg.sender], "NodeRegistry: not authorized");
        _;
    }
    
    modifier onlyNodeOwner(bytes32 fingerprint) {
        require(nodes[fingerprint].owner == msg.sender, "NodeRegistry: not owner");
        _;
    }
    
    constructor(address _stakingToken, address initialOwner) Ownable(initialOwner) {
        stakingToken = _stakingToken;
    }
    
    function authorizeSlasher(address slasher) external onlyOwner {
        authorizedSlashers[slasher] = true;
        emit SlasherAuthorized(slasher);
    }
    
    /**
     * @dev Register a new node with stake
     * @param fingerprint Node's public key fingerprint (16 chars)
     * @param hardware Hardware description (e.g., "RTX 4090")
     * @param stakeAmount Amount of HSK to stake (must be >= MIN_STAKE)
     */
    function registerNode(
        bytes32 fingerprint,
        string calldata hardware,
        uint256 stakeAmount
    ) external {
        require(stakeAmount >= MIN_STAKE, "NodeRegistry: insufficient stake");
        require(nodes[fingerprint].owner == address(0), "NodeRegistry: already registered");
        require(bytes(hardware).length > 0, "NodeRegistry: hardware required");
        
        // Transfer stake from user
        require(
            IERC20(stakingToken).transferFrom(msg.sender, address(this), stakeAmount),
            "NodeRegistry: stake transfer failed"
        );
        
        nodes[fingerprint] = Node({
            owner: msg.sender,
            fingerprint: fingerprint,
            hardware: hardware,
            stakedAmount: stakeAmount,
            registeredAt: block.timestamp,
            lastHeartbeat: block.timestamp,
            totalJobs: 0,
            successfulJobs: 0,
            isActive: true,
            isSlashed: false
        });
        
        ownerNodes[msg.sender].push(fingerprint);
        totalStaked += stakeAmount;
        activeNodeCount++;
        
        emit NodeRegistered(fingerprint, msg.sender, stakeAmount);
    }
    
    /**
     * @dev Unregister node and return stake (if not slashed)
     */
    function unregisterNode(bytes32 fingerprint) external onlyNodeOwner(fingerprint) {
        Node storage node = nodes[fingerprint];
        require(!node.isSlashed, "NodeRegistry: node slashed");
        require(node.isActive, "NodeRegistry: already inactive");
        
        node.isActive = false;
        totalStaked -= node.stakedAmount;
        activeNodeCount--;
        
        // Return stake
        require(
            IERC20(stakingToken).transfer(msg.sender, node.stakedAmount),
            "NodeRegistry: stake return failed"
        );
        
        emit NodeUnregistered(fingerprint, node.stakedAmount);
    }
    
    /**
     * @dev Record job completion (called by settlement)
     */
    function recordJob(bytes32 fingerprint, bool success) external onlySlasher {
        Node storage node = nodes[fingerprint];
        require(node.isActive, "NodeRegistry: node not active");
        
        node.totalJobs++;
        if (success) {
            node.successfulJobs++;
        }
    }
    
    /**
     * @dev Slash a node for misbehavior
     */
    function slash(
        bytes32 fingerprint,
        uint256 amount,
        string calldata reason
    ) external onlySlasher {
        Node storage node = nodes[fingerprint];
        require(node.isActive, "NodeRegistry: node not active");
        require(amount <= node.stakedAmount, "NodeRegistry: slash exceeds stake");
        
        node.stakedAmount -= amount;
        node.isSlashed = true;
        
        if (node.stakedAmount == 0) {
            node.isActive = false;
            activeNodeCount--;
        }
        
        // Burn slashed tokens
        IERC20(stakingToken).transfer(address(0xdead), amount);
        
        emit NodeSlashed(fingerprint, amount, reason);
    }
    
    /**
     * @dev Record heartbeat from node
     */
    function recordHeartbeat(bytes32 fingerprint) external {
        require(nodes[fingerprint].owner != address(0), "NodeRegistry: node not found");
        nodes[fingerprint].lastHeartbeat = block.timestamp;
        emit Heartbeat(fingerprint, block.timestamp);
    }
    
    /**
     * @dev Check if nonce has been used (prevent replay attacks)
     */
    function isNonceUsed(bytes32 fingerprint, uint256 nonce) external view returns (bool) {
        return usedNonces[fingerprint][nonce];
    }
    
    /**
     * @dev Mark nonce as used
     */
    function useNonce(bytes32 fingerprint, uint256 nonce) external onlySlasher returns (bool) {
        require(!usedNonces[fingerprint][nonce], "NodeRegistry: nonce already used");
        usedNonces[fingerprint][nonce] = true;
        return true;
    }
    
    /**
     * @dev Get node's success rate
     */
    function getSuccessRate(bytes32 fingerprint) external view returns (uint256) {
        Node storage node = nodes[fingerprint];
        if (node.totalJobs == 0) return 0;
        return (node.successfulJobs * 10000) / node.totalJobs; // basis points
    }
    
    /**
     * @dev Get all nodes for an owner
     */
    function getOwnerNodes(address owner) external view returns (bytes32[] memory) {
        return ownerNodes[owner];
    }
    
    /**
     * @dev Check if heartbeat is stale (> 1 hour)
     */
    function isStale(bytes32 fingerprint) external view returns (bool) {
        return block.timestamp > nodes[fingerprint].lastHeartbeat + 1 hours;
    }
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

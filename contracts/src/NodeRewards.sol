// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title NodeRewards
 * @dev Distributes mining rewards via Merkle tree claims
 */
contract NodeRewards is Ownable {
    using MerkleProof for bytes32[];
    
    struct Epoch {
        bytes32 merkleRoot;
        uint256 totalRewards;
        uint256 claimedRewards;
        uint256 startTime;
        uint256 endTime;
        bool finalized;
    }
    
    // HSK token
    address public rewardToken;
    
    // Node registry
    address public nodeRegistry;
    
    // Epochs: epochId => Epoch
    mapping(uint256 => Epoch) public epochs;
    
    // Claims tracking: epochId => nodeFingerprint => claimed
    mapping(uint256 => mapping(bytes32 => bool)) public hasClaimed;
    
    // Current epoch
    uint256 public currentEpoch;
    
    // Epoch duration (default: 24 hours)
    uint256 public epochDuration = 24 hours;
    
    // Protocol fee (5%)
    uint256 public protocolFeePercent = 500; // basis points
    address public feeRecipient;
    
    // Total rewards distributed
    uint256 public totalRewardsDistributed;
    
    event EpochStarted(uint256 indexed epochId, uint256 startTime);
    event EpochFinalized(uint256 indexed epochId, bytes32 merkleRoot, uint256 totalRewards);
    event RewardsClaimed(uint256 indexed epochId, bytes32 indexed fingerprint, uint256 amount);
    event EpochDurationUpdated(uint256 newDuration);
    
    modifier onlyRegistry() {
        require(msg.sender == nodeRegistry, "NodeRewards: not registry");
        _;
    }
    
    constructor(address _rewardToken, address _feeRecipient, address initialOwner) Ownable(initialOwner) {
        rewardToken = _rewardToken;
        feeRecipient = _feeRecipient;
        
        // Start epoch 0
        epochs[0] = Epoch({
            merkleRoot: bytes32(0),
            totalRewards: 0,
            claimedRewards: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + epochDuration,
            finalized: false
        });
    }
    
    function setNodeRegistry(address _registry) external onlyOwner {
        nodeRegistry = _registry;
    }
    
    function setEpochDuration(uint256 newDuration) external onlyOwner {
        require(newDuration >= 1 hours, "NodeRewards: duration too short");
        epochDuration = newDuration;
        emit EpochDurationUpdated(newDuration);
    }
    
    /**
     * @dev Start a new epoch (called by settlement service)
     */
    function startNewEpoch() external onlyOwner {
        Epoch storage current = epochs[currentEpoch];
        require(block.timestamp >= current.endTime, "NodeRewards: current epoch not ended");
        require(current.finalized || currentEpoch == 0, "NodeRewards: current epoch not finalized");
        
        currentEpoch++;
        epochs[currentEpoch] = Epoch({
            merkleRoot: bytes32(0),
            totalRewards: 0,
            claimedRewards: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + epochDuration,
            finalized: false
        });
        
        emit EpochStarted(currentEpoch, block.timestamp);
    }
    
    /**
     * @dev Finalize epoch with Merkle root (called by settlement service)
     * @param epochId Epoch to finalize
     * @param merkleRoot Root of Merkle tree containing (fingerprint, amount) pairs
     * @param totalRewards Total HSK to distribute this epoch
     */
    function finalizeEpoch(
        uint256 epochId,
        bytes32 merkleRoot,
        uint256 totalRewards
    ) external onlyOwner {
        require(epochId <= currentEpoch, "NodeRewards: invalid epoch");
        Epoch storage epoch = epochs[epochId];
        require(!epoch.finalized, "NodeRewards: already finalized");
        require(merkleRoot != bytes32(0), "NodeRewards: invalid merkle root");
        
        epoch.merkleRoot = merkleRoot;
        epoch.totalRewards = totalRewards;
        epoch.finalized = true;
        
        totalRewardsDistributed += totalRewards;
        
        emit EpochFinalized(epochId, merkleRoot, totalRewards);
    }
    
    /**
     * @dev Claim rewards for a node using Merkle proof
     * @param epochId Epoch to claim from
     * @param fingerprint Node's fingerprint
     * @param amount Reward amount
     * @param merkleProof Merkle proof for (fingerprint, amount)
     */
    function claim(
        uint256 epochId,
        bytes32 fingerprint,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        Epoch storage epoch = epochs[epochId];
        require(epoch.finalized, "NodeRewards: epoch not finalized");
        require(!hasClaimed[epochId][fingerprint], "NodeRewards: already claimed");
        
        // Verify merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(fingerprint, amount));
        require(
            MerkleProof.verify(merkleProof, epoch.merkleRoot, leaf),
            "NodeRewards: invalid proof"
        );
        
        hasClaimed[epochId][fingerprint] = true;
        epoch.claimedRewards += amount;
        
        // Calculate protocol fee
        uint256 fee = (amount * protocolFeePercent) / 10000;
        uint256 netAmount = amount - fee;
        
        // Transfer rewards to node owner
        address nodeOwner = INodeRegistry(nodeRegistry).getNodeOwner(fingerprint);
        require(nodeOwner != address(0), "NodeRewards: node not found");
        
        require(IERC20(rewardToken).transfer(nodeOwner, netAmount), "NodeRewards: transfer failed");
        
        // Transfer fee to treasury
        if (fee > 0) {
            require(IERC20(rewardToken).transfer(feeRecipient, fee), "NodeRewards: fee transfer failed");
        }
        
        emit RewardsClaimed(epochId, fingerprint, amount);
    }
    
    /**
     * @dev Check if a node can claim rewards
     */
    function canClaim(
        uint256 epochId,
        bytes32 fingerprint,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external view returns (bool) {
        Epoch storage epoch = epochs[epochId];
        if (!epoch.finalized) return false;
        if (hasClaimed[epochId][fingerprint]) return false;
        
        bytes32 leaf = keccak256(abi.encodePacked(fingerprint, amount));
        return MerkleProof.verify(merkleProof, epoch.merkleRoot, leaf);
    }
    
    /**
     * @dev Get claimable amount for a node (requires off-chain data)
     */
    function getClaimableAmount(uint256 epochId, bytes32 fingerprint) external view returns (uint256) {
        if (hasClaimed[epochId][fingerprint]) return 0;
        // Note: Actual amount requires merkle tree data off-chain
        return 0;
    }
    
    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(IERC20(rewardToken).transfer(owner(), amount), "NodeRewards: withdraw failed");
    }
    
    /**
     * @dev Update protocol fee
     */
    function setProtocolFee(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= 2000, "NodeRewards: fee too high"); // max 20%
        protocolFeePercent = newFeePercent;
    }
    
    /**
     * @dev Update fee recipient
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface INodeRegistry {
    function nodes(bytes32 fingerprint) external view returns (
        address owner,
        bytes32 fingerprint,
        string memory hardware,
        uint256 stakedAmount,
        uint256 registeredAt,
        uint256 lastHeartbeat,
        uint256 totalJobs,
        uint256 successfulJobs,
        bool isActive,
        bool isSlashed
    );
    function getNodeOwner(bytes32 fingerprint) external view returns (address);
}

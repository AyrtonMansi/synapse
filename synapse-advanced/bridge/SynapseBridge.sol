// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@layerzero/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";

/**
 * @title SynapseBridge
 * @dev Cross-chain bridge for HSK token between Ethereum and Arbitrum
 * Uses LayerZero for cross-chain messaging
 */
contract SynapseBridge is ReentrancyGuard, Pausable, AccessControl, NonblockingLzApp {
    
    bytes32 public constant BRIDGE_ADMIN = keccak256("BRIDGE_ADMIN");
    
    // Supported chains
    uint256 public constant ETHEREUM = 1;
    uint256 public constant ARBITRUM = 42161;
    
    struct BridgeTransaction {
        bytes32 txHash;
        address sender;
        address recipient;
        uint256 amount;
        uint256 sourceChain;
        uint256 targetChain;
        uint256 timestamp;
        bool completed;
    }
    
    struct ChainConfig {
        bool supported;
        uint16 lzChainId;
        uint256 minTransfer;
        uint256 maxTransfer;
        uint256 feeBasisPoints;
        address remoteBridge;
    }
    
    // State variables
    IERC20 public hskToken;
    mapping(uint256 => ChainConfig) public chainConfigs;
    mapping(bytes32 => BridgeTransaction) public transactions;
    mapping(bytes32 => bool) public processedHashes;
    mapping(address => uint256) public pendingWithdrawals;
    
    uint256 public totalBridged;
    uint256 public totalFeesCollected;
    uint256 public constant MAX_FEE_BASIS_POINTS = 500; // 5%
    uint256 public constant MIN_TRANSFER = 0.001 ether;
    uint256 public constant MAX_TRANSFER = 1000000 ether;
    
    // Events
    event BridgeInitiated(
        bytes32 indexed txHash,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 sourceChain,
        uint256 targetChain,
        uint256 timestamp
    );
    
    event BridgeCompleted(
        bytes32 indexed txHash,
        address indexed recipient,
        uint256 amount,
        uint256 sourceChain,
        uint256 targetChain
    );
    
    event ChainConfigUpdated(
        uint256 indexed chainId,
        bool supported,
        uint256 feeBasisPoints
    );
    
    event EmergencyWithdraw(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );
    
    constructor(
        address _hskToken,
        address _lzEndpoint
    ) NonblockingLzApp(_lzEndpoint) {
        hskToken = IERC20(_hskToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BRIDGE_ADMIN, msg.sender);
        
        // Initialize chain configs
        _initializeChainConfigs();
    }
    
    function _initializeChainConfigs() internal {
        // Ethereum Mainnet
        chainConfigs[ETHEREUM] = ChainConfig({
            supported: true,
            lzChainId: 101,
            minTransfer: MIN_TRANSFER,
            maxTransfer: MAX_TRANSFER,
            feeBasisPoints: 30, // 0.3%
            remoteBridge: address(0)
        });
        
        // Arbitrum
        chainConfigs[ARBITRUM] = ChainConfig({
            supported: true,
            lzChainId: 110,
            minTransfer: MIN_TRANSFER,
            maxTransfer: MAX_TRANSFER,
            feeBasisPoints: 20, // 0.2%
            remoteBridge: address(0)
        });
    }
    
    /**
     * @dev Initiate a cross-chain bridge transfer
     */
    function bridge(
        uint256 _targetChain,
        address _recipient,
        uint256 _amount,
        bytes calldata _adapterParams
    ) external payable nonReentrant whenNotPaused returns (bytes32) {
        ChainConfig memory config = chainConfigs[_targetChain];
        require(config.supported, "Chain not supported");
        require(_amount >= config.minTransfer, "Amount below minimum");
        require(_amount <= config.maxTransfer, "Amount exceeds maximum");
        require(_recipient != address(0), "Invalid recipient");
        require(
            _targetChain == ETHEREUM || _targetChain == ARBITRUM,
            "Only Ethereum/Arbitrum supported"
        );
        
        // Calculate fee
        uint256 fee = (_amount * config.feeBasisPoints) / 10000;
        uint256 netAmount = _amount - fee;
        
        // Generate unique transaction hash
        bytes32 txHash = keccak256(abi.encodePacked(
            msg.sender,
            _recipient,
            _amount,
            _targetChain,
            block.timestamp,
            block.number
        ));
        
        require(!processedHashes[txHash], "Transaction already processed");
        processedHashes[txHash] = true;
        
        // Store transaction
        transactions[txHash] = BridgeTransaction({
            txHash: txHash,
            sender: msg.sender,
            recipient: _recipient,
            amount: netAmount,
            sourceChain: getChainId(),
            targetChain: _targetChain,
            timestamp: block.timestamp,
            completed: false
        });
        
        // Transfer tokens from sender
        require(hskToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        
        // Collect fee
        totalFeesCollected += fee;
        
        // Encode payload for LayerZero
        bytes memory payload = abi.encode(txHash, _recipient, netAmount, block.timestamp);
        
        // Estimate LayerZero fees
        (uint256 nativeFee, ) = lzEndpoint.estimateFees(
            config.lzChainId,
            config.remoteBridge,
            payload,
            false,
            _adapterParams
        );
        
        require(msg.value >= nativeFee, "Insufficient native fee");
        
        // Send cross-chain message
        _lzSend(
            config.lzChainId,
            payload,
            payable(msg.sender),
            address(0x0),
            _adapterParams,
            nativeFee
        );
        
        totalBridged += _amount;
        
        emit BridgeInitiated(
            txHash,
            msg.sender,
            _recipient,
            _amount,
            getChainId(),
            _targetChain,
            block.timestamp
        );
        
        // Refund excess native tokens
        if (msg.value > nativeFee) {
            payable(msg.sender).transfer(msg.value - nativeFee);
        }
        
        return txHash;
    }
    
    /**
     * @dev Handle incoming cross-chain messages
     */
    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) internal override {
        // Decode payload
        (bytes32 txHash, address recipient, uint256 amount, uint256 timestamp) = 
            abi.decode(_payload, (bytes32, address, uint256, uint256));
        
        require(!processedHashes[txHash], "Transaction already processed");
        processedHashes[txHash] = true;
        
        // Store as pending withdrawal
        pendingWithdrawals[recipient] += amount;
        
        // Complete immediately
        _completeBridge(txHash, recipient, amount, _srcChainId);
    }
    
    /**
     * @dev Complete a bridge transaction and release tokens
     */
    function _completeBridge(
        bytes32 _txHash,
        address _recipient,
        uint256 _amount,
        uint16 _sourceChain
    ) internal {
        BridgeTransaction storage txn = transactions[_txHash];
        
        require(pendingWithdrawals[_recipient] >= _amount, "Insufficient pending balance");
        pendingWithdrawals[_recipient] -= _amount;
        
        require(hskToken.transfer(_recipient, _amount), "Token transfer failed");
        
        txn.completed = true;
        
        emit BridgeCompleted(
            _txHash,
            _recipient,
            _amount,
            _sourceChain,
            getChainId()
        );
    }
    
    /**
     * @dev Claim pending tokens (fallback)
     */
    function claimTokens() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending tokens");
        
        pendingWithdrawals[msg.sender] = 0;
        require(hskToken.transfer(msg.sender, amount), "Transfer failed");
    }
    
    /**
     * @dev Get current chain ID
     */
    function getChainId() public view returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
    
    /**
     * @dev Admin functions
     */
    function updateChainConfig(
        uint256 _chainId,
        bool _supported,
        uint256 _feeBasisPoints,
        address _remoteBridge
    ) external onlyRole(BRIDGE_ADMIN) {
        require(_feeBasisPoints <= MAX_FEE_BASIS_POINTS, "Fee too high");
        require(_chainId == ETHEREUM || _chainId == ARBITRUM, "Invalid chain");
        
        ChainConfig storage config = chainConfigs[_chainId];
        config.supported = _supported;
        config.feeBasisPoints = _feeBasisPoints;
        config.remoteBridge = _remoteBridge;
        
        emit ChainConfigUpdated(_chainId, _supported, _feeBasisPoints);
    }
    
    function emergencyWithdraw(
        address _token,
        address _recipient,
        uint256 _amount
    ) external onlyRole(BRIDGE_ADMIN) whenPaused {
        require(_recipient != address(0), "Invalid recipient");
        IERC20(_token).transfer(_recipient, _amount);
        emit EmergencyWithdraw(_token, _recipient, _amount);
    }
    
    function pause() external onlyRole(BRIDGE_ADMIN) {
        _pause();
    }
    
    function unpause() external onlyRole(BRIDGE_ADMIN) {
        _unpause();
    }
    
    /**
     * @dev View functions
     */
    function getPendingAmount(address _user) external view returns (uint256) {
        return pendingWithdrawals[_user];
    }
    
    function estimateBridgeFee(
        uint256 _targetChain,
        uint256 _amount
    ) external view returns (uint256 nativeFee, uint256 tokenFee) {
        ChainConfig memory config = chainConfigs[_targetChain];
        
        tokenFee = (_amount * config.feeBasisPoints) / 10000;
        
        bytes memory payload = abi.encode(bytes32(0), address(0), _amount, block.timestamp);
        (nativeFee, ) = lzEndpoint.estimateFees(
            config.lzChainId,
            config.remoteBridge,
            payload,
            false,
            bytes("")
        );
        
        return (nativeFee, tokenFee);
    }
    
    function getTransaction(bytes32 _txHash) external view returns (BridgeTransaction memory) {
        return transactions[_txHash];
    }
    
    receive() external payable {}
}

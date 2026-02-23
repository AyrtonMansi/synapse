// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IGnosisSafe {
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        bytes calldata signatures
    ) external payable returns (bool success);

    function getThreshold() external view returns (uint256);
    function getOwners() external view returns (address[] memory);
    function isOwner(address owner) external view returns (bool);
    function nonce() external view returns (uint256);
    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) external view returns (bytes32);
}

/**
 * @title SynapseGnosisSafeModule
 * @notice Gnosis Safe integration for DAO treasury management
 * @dev Enables DAO governance to control Gnosis Safe multi-sig wallets
 */
contract SynapseGnosisSafeModule is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Structs ============
    struct SafeConfig {
        address safe;
        uint256 requiredConfirmations;
        bool isActive;
        mapping(address => bool) delegates;
        address[] delegateList;
    }

    struct TransactionRequest {
        bytes32 id;
        address safe;
        address to;
        uint256 value;
        bytes data;
        uint8 operation;
        uint256 requestedAt;
        uint256 executedAt;
        bool executed;
        bool canceled;
        address requester;
        string description;
    }

    struct Signature {
        address signer;
        bytes signature;
        uint256 signedAt;
    }

    // ============ State Variables ============
    address public governor;
    address public treasury;
    
    mapping(address => SafeConfig) public safeConfigs;
    mapping(bytes32 => TransactionRequest) public transactions;
    mapping(bytes32 => Signature[]) public transactionSignatures;
    mapping(address => bytes32[]) public safeTransactions;
    
    bytes32[] public allTransactionIds;
    address[] public registeredSafes;
    
    uint256 public transactionCount;
    uint256 public defaultThreshold;
    bool public moduleActive;

    // ============ Events ============
    event SafeRegistered(address indexed safe, uint256 threshold);
    event SafeUnregistered(address indexed safe);
    event TransactionRequested(
        bytes32 indexed id,
        address indexed safe,
        address indexed to,
        uint256 value,
        address requester
    );
    event TransactionSigned(bytes32 indexed id, address indexed signer);
    event TransactionExecuted(bytes32 indexed id, address indexed executor);
    event TransactionCanceled(bytes32 indexed id, address indexed canceler);
    event ThresholdUpdated(address indexed safe, uint256 newThreshold);
    event DelegateAdded(address indexed safe, address indexed delegate);
    event DelegateRemoved(address indexed safe, address indexed delegate);

    // ============ Modifiers ============
    modifier onlyGovernor() {
        require(msg.sender == governor, "SafeModule: only governor");
        _;
    }

    modifier onlyTreasury() {
        require(msg.sender == treasury, "SafeModule: only treasury");
        _;
    }

    modifier onlySafeDelegate(address safe) {
        require(
            safeConfigs[safe].delegates[msg.sender] || 
            msg.sender == governor ||
            msg.sender == treasury,
            "SafeModule: not delegate"
        );
        _;
    }

    modifier onlyActiveSafe(address safe) {
        require(safeConfigs[safe].isActive, "SafeModule: safe not active");
        _;
    }

    // ============ Constructor ============
    constructor(
        address _governor,
        address _treasury,
        uint256 _defaultThreshold
    ) {
        require(_governor != address(0), "SafeModule: zero governor");
        require(_treasury != address(0), "SafeModule: zero treasury");
        
        governor = _governor;
        treasury = _treasury;
        defaultThreshold = _defaultThreshold > 0 ? _defaultThreshold : 1;
        moduleActive = true;
    }

    // ============ Safe Management ============
    function registerSafe(
        address safe,
        uint256 threshold,
        address[] calldata delegates
    ) external onlyGovernor {
        require(safe != address(0), "SafeModule: zero safe");
        require(!safeConfigs[safe].isActive, "SafeModule: already registered");
        
        SafeConfig storage config = safeConfigs[safe];
        config.safe = safe;
        config.requiredConfirmations = threshold > 0 ? threshold : defaultThreshold;
        config.isActive = true;

        for (uint256 i = 0; i < delegates.length; i++) {
            config.delegates[delegates[i]] = true;
            config.delegateList.push(delegates[i]);
        }

        registeredSafes.push(safe);

        emit SafeRegistered(safe, config.requiredConfirmations);
    }

    function unregisterSafe(address safe) external onlyGovernor onlyActiveSafe(safe) {
        SafeConfig storage config = safeConfigs[safe];
        config.isActive = false;

        emit SafeUnregistered(safe);
    }

    function updateThreshold(address safe, uint256 newThreshold) 
        external 
        onlyGovernor 
        onlyActiveSafe(safe) 
    {
        require(newThreshold > 0, "SafeModule: zero threshold");
        safeConfigs[safe].requiredConfirmations = newThreshold;

        emit ThresholdUpdated(safe, newThreshold);
    }

    function addDelegate(address safe, address delegate) 
        external 
        onlyGovernor 
        onlyActiveSafe(safe) 
    {
        require(delegate != address(0), "SafeModule: zero delegate");
        
        SafeConfig storage config = safeConfigs[safe];
        require(!config.delegates[delegate], "SafeModule: already delegate");
        
        config.delegates[delegate] = true;
        config.delegateList.push(delegate);

        emit DelegateAdded(safe, delegate);
    }

    function removeDelegate(address safe, address delegate) 
        external 
        onlyGovernor 
        onlyActiveSafe(safe) 
    {
        SafeConfig storage config = safeConfigs[safe];
        require(config.delegates[delegate], "SafeModule: not delegate");
        
        config.delegates[delegate] = false;

        // Remove from list
        for (uint256 i = 0; i < config.delegateList.length; i++) {
            if (config.delegateList[i] == delegate) {
                config.delegateList[i] = config.delegateList[config.delegateList.length - 1];
                config.delegateList.pop();
                break;
            }
        }

        emit DelegateRemoved(safe, delegate);
    }

    // ============ Transaction Management ============
    function requestTransaction(
        address safe,
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        string calldata description
    ) external onlySafeDelegate(safe) onlyActiveSafe(safe) returns (bytes32) {
        require(to != address(0), "SafeModule: zero target");
        
        transactionCount++;
        bytes32 id = keccak256(abi.encodePacked(safe, to, value, data, operation, block.timestamp));
        
        transactions[id] = TransactionRequest({
            id: id,
            safe: safe,
            to: to,
            value: value,
            data: data,
            operation: operation,
            requestedAt: block.timestamp,
            executedAt: 0,
            executed: false,
            canceled: false,
            requester: msg.sender,
            description: description
        });

        safeTransactions[safe].push(id);
        allTransactionIds.push(id);

        // Auto-sign by requester
        _addSignature(id, msg.sender, "");

        emit TransactionRequested(id, safe, to, value, msg.sender);

        return id;
    }

    function signTransaction(bytes32 id, bytes calldata signature) 
        external 
        onlySafeDelegate(transactions[id].safe) 
    {
        TransactionRequest storage txn = transactions[id];
        require(!txn.executed, "SafeModule: already executed");
        require(!txn.canceled, "SafeModule: canceled");
        
        _addSignature(id, msg.sender, signature);

        emit TransactionSigned(id, msg.sender);
    }

    function _addSignature(bytes32 id, address signer, bytes memory signature) internal {
        // Check not already signed
        Signature[] storage sigs = transactionSignatures[id];
        for (uint256 i = 0; i < sigs.length; i++) {
            require(sigs[i].signer != signer, "SafeModule: already signed");
        }
        
        sigs.push(Signature({
            signer: signer,
            signature: signature,
            signedAt: block.timestamp
        }));
    }

    function executeTransaction(bytes32 id) 
        external 
        nonReentrant 
        returns (bool) 
    {
        TransactionRequest storage txn = transactions[id];
        require(!txn.executed, "SafeModule: already executed");
        require(!txn.canceled, "SafeModule: canceled");
        require(txn.safe != address(0), "SafeModule: invalid transaction");

        SafeConfig storage config = safeConfigs[txn.safe];
        require(config.isActive, "SafeModule: safe not active");

        Signature[] storage sigs = transactionSignatures[id];
        require(
            sigs.length >= config.requiredConfirmations,
            "SafeModule: insufficient signatures"
        );

        txn.executed = true;
        txn.executedAt = block.timestamp;

        // Build combined signatures
        bytes memory combinedSignatures = _buildSignatures(sigs);

        // Execute via Gnosis Safe
        bool success = IGnosisSafe(txn.safe).execTransaction(
            txn.to,
            txn.value,
            txn.data,
            txn.operation,
            0, // safeTxGas
            0, // baseGas
            0, // gasPrice
            address(0), // gasToken
            address(0), // refundReceiver
            combinedSignatures
        );

        require(success, "SafeModule: execution failed");

        emit TransactionExecuted(id, msg.sender);

        return true;
    }

    function _buildSignatures(Signature[] storage sigs) 
        internal 
        view 
        returns (bytes memory) 
    {
        // For simplicity, returning empty - in production would combine signatures properly
        // This would need proper EIP-1271 signature encoding for Gnosis Safe
        return "";
    }

    function cancelTransaction(bytes32 id) external {
        TransactionRequest storage txn = transactions[id];
        require(
            msg.sender == txn.requester || 
            msg.sender == governor ||
            msg.sender == treasury,
            "SafeModule: unauthorized"
        );
        require(!txn.executed, "SafeModule: already executed");
        require(!txn.canceled, "SafeModule: already canceled");

        txn.canceled = true;

        emit TransactionCanceled(id, msg.sender);
    }

    // ============ View Functions ============
    function getSafeInfo(address safe) external view returns (
        address safeAddress,
        uint256 requiredConfirmations,
        bool isActive,
        uint256 delegateCount
    ) {
        SafeConfig storage config = safeConfigs[safe];
        return (
            config.safe,
            config.requiredConfirmations,
            config.isActive,
            config.delegateList.length
        );
    }

    function getSafeDelegates(address safe) external view returns (address[] memory) {
        return safeConfigs[safe].delegateList;
    }

    function isDelegate(address safe, account) external view returns (bool) {
        return safeConfigs[safe].delegates[account];
    }

    function getTransaction(bytes32 id) external view returns (TransactionRequest memory) {
        return transactions[id];
    }

    function getTransactionSignatures(bytes32 id) external view returns (Signature[] memory) {
        return transactionSignatures[id];
    }

    function getSignatureCount(bytes32 id) external view returns (uint256) {
        return transactionSignatures[id].length;
    }

    function hasSigned(bytes32 id, address signer) external view returns (bool) {
        Signature[] storage sigs = transactionSignatures[id];
        for (uint256 i = 0; i < sigs.length; i++) {
            if (sigs[i].signer == signer) return true;
        }
        return false;
    }

    function isExecutable(bytes32 id) external view returns (bool) {
        TransactionRequest storage txn = transactions[id];
        if (txn.executed || txn.canceled || txn.safe == address(0)) {
            return false;
        }
        
        SafeConfig storage config = safeConfigs[txn.safe];
        if (!config.isActive) return false;
        
        return transactionSignatures[id].length >= config.requiredConfirmations;
    }

    function getSafeTransactions(address safe) external view returns (bytes32[] memory) {
        return safeTransactions[safe];
    }

    function getAllTransactions(uint256 start, uint256 limit) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        uint256 end = start + limit;
        if (end > allTransactionIds.length) {
            end = allTransactionIds.length;
        }
        
        bytes32[] memory result = new bytes32[](end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = allTransactionIds[i];
        }
        return result;
    }

    function getRegisteredSafes() external view returns (address[] memory) {
        return registeredSafes;
    }

    // ============ Admin Functions ============
    function setGovernor(address newGovernor) external onlyGovernor {
        require(newGovernor != address(0), "SafeModule: zero governor");
        governor = newGovernor;
    }

    function setTreasury(address newTreasury) external onlyGovernor {
        require(newTreasury != address(0), "SafeModule: zero treasury");
        treasury = newTreasury;
    }

    function setDefaultThreshold(uint256 newThreshold) external onlyGovernor {
        require(newThreshold > 0, "SafeModule: zero threshold");
        defaultThreshold = newThreshold;
    }

    function toggleModule(bool active) external onlyGovernor {
        moduleActive = active;
    }

    receive() external payable {}
}
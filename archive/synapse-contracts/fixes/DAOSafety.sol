// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title DAOSafety
 * @notice Safety module for DAO-controlled contracts
 * @dev Adds timelock and emergency pause capabilities
 */
contract DAOSafety is AccessControl {
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant TIMELOCK_ADMIN_ROLE = keccak256("TIMELOCK_ADMIN_ROLE");

    uint256 public constant MINIMUM_DELAY = 2 days;
    uint256 public constant MAXIMUM_DELAY = 30 days;
    uint256 public constant GRACE_PERIOD = 14 days;

    uint256 public delay;
    mapping(bytes32 => bool) public queuedTransactions;
    mapping(bytes32 => uint256) public transactionEta;

    event TransactionQueued(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    event TransactionExecuted(bytes32 indexed txHash);
    event TransactionCancelled(bytes32 indexed txHash);
    event EmergencyPaused(address indexed caller);
    event EmergencyUnpaused(address indexed caller);

    bool public emergencyPaused;
    uint256 public pauseExpiry;
    uint256 public constant MAX_PAUSE_DURATION = 7 days;

    constructor(address dao, uint256 initialDelay) {
        require(dao != address(0), "DAOSafety: zero dao");
        require(initialDelay >= MINIMUM_DELAY, "DAOSafety: delay too short");
        require(initialDelay <= MAXIMUM_DELAY, "DAOSafety: delay too long");

        _grantRole(DEFAULT_ADMIN_ROLE, dao);
        _grantRole(TIMELOCK_ADMIN_ROLE, dao);
        _grantRole(EMERGENCY_ROLE, dao);

        delay = initialDelay;
    }

    /**
     * @notice Queue a transaction for future execution
     * @dev All sensitive operations must go through timelock
     */
    function queueTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external onlyRole(TIMELOCK_ADMIN_ROLE) returns (bytes32) {
        require(!emergencyPaused, "DAOSafety: emergency paused");
        require(
            eta >= block.timestamp + delay,
            "DAOSafety: eta before delay"
        );
        require(eta <= block.timestamp + MAXIMUM_DELAY, "DAOSafety: eta too far");

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(!queuedTransactions[txHash], "DAOSafety: already queued");

        queuedTransactions[txHash] = true;
        transactionEta[txHash] = eta;

        emit TransactionQueued(txHash, target, value, signature, data, eta);
        return txHash;
    }

    /**
     * @notice Execute a queued transaction after delay
     */
    function executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external payable onlyRole(TIMELOCK_ADMIN_ROLE) returns (bytes memory) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(queuedTransactions[txHash], "DAOSafety: not queued");
        require(block.timestamp >= eta, "DAOSafety: timelock not passed");
        require(block.timestamp <= eta + GRACE_PERIOD, "DAOSafety: transaction expired");

        queuedTransactions[txHash] = false;

        bytes memory callData;
        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }

        (bool success, bytes memory returnData) = target.call{value: value}(callData);
        require(success, "DAOSafety: execution failed");

        emit TransactionExecuted(txHash);
        return returnData;
    }

    /**
     * @notice Cancel a queued transaction
     */
    function cancelTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external onlyRole(TIMELOCK_ADMIN_ROLE) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(queuedTransactions[txHash], "DAOSafety: not queued");

        queuedTransactions[txHash] = false;
        delete transactionEta[txHash];

        emit TransactionCancelled(txHash);
    }

    /**
     * @notice Emergency pause - can be called by multisig with EMERGENCY_ROLE
     * @dev Maximum pause duration to prevent permanent lock
     */
    function emergencyPause() external onlyRole(EMERGENCY_ROLE) {
        require(!emergencyPaused, "DAOSafety: already paused");
        emergencyPaused = true;
        pauseExpiry = block.timestamp + MAX_PAUSE_DURATION;
        emit EmergencyPaused(msg.sender);
    }

    /**
     * @notice Unpause - requires timelock after emergency pause
     */
    function emergencyUnpause() external onlyRole(TIMELOCK_ADMIN_ROLE) {
        require(emergencyPaused, "DAOSafety: not paused");
        require(
            block.timestamp >= pauseExpiry - MAX_PAUSE_DURATION + 1 days,
            "DAOSafety: unpause timelock active"
        );
        emergencyPaused = false;
        pauseExpiry = 0;
        emit EmergencyUnpaused(msg.sender);
    }

    /**
     * @notice Update timelock delay (requires timelock)
     */
    function setDelay(uint256 newDelay) external {
        require(msg.sender == address(this), "DAOSafety: only via timelock");
        require(newDelay >= MINIMUM_DELAY, "DAOSafety: delay too short");
        require(newDelay <= MAXIMUM_DELAY, "DAOSafety: delay too long");
        delay = newDelay;
    }

    /**
     * @notice Check if transaction is queued
     */
    function isTransactionQueued(bytes32 txHash) external view returns (bool) {
        return queuedTransactions[txHash];
    }

    /**
     * @notice Get time until transaction can be executed
     */
    function getTimeUntilExecution(bytes32 txHash) external view returns (uint256) {
        if (!queuedTransactions[txHash]) return 0;
        if (block.timestamp >= transactionEta[txHash]) return 0;
        return transactionEta[txHash] - block.timestamp;
    }

    receive() external payable {}
}

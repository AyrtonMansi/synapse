// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SynapseTimelock
 * @notice Timelock controller for governance actions with visualization support
 * @dev Handles delayed execution of governance proposals with granular tracking
 */
contract SynapseTimelock is AccessControl, ReentrancyGuard {
    
    // ============ Roles ============
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELER_ROLE = keccak256("CANCELER_ROLE");

    // ============ Structs ============
    struct TimelockOperation {
        bytes32 id;
        address target;
        uint256 value;
        bytes data;
        uint256 eta;
        bool executed;
        bool canceled;
        uint256 createdAt;
        uint256 delay;
        address proposer;
        string description;
    }

    struct OperationSchedule {
        bytes32[] operationIds;
        uint256 totalOperations;
        uint256 earliestExecution;
        uint256 latestExecution;
        bool allExecuted;
        bool anyCanceled;
    }

    // ============ State Variables ============
    uint256 public minDelay;
    uint256 public maxDelay;
    uint256 public gracePeriod;
    
    mapping(bytes32 => TimelockOperation) public operations;
    mapping(bytes32 => OperationSchedule) public schedules;
    mapping(address => bytes32[]) public proposerOperations;
    mapping(uint256 => bytes32[]) public operationsByDay;
    
    bytes32[] public operationIds;
    uint256 public operationCount;

    // ============ Events ============
    event OperationScheduled(
        bytes32 indexed id,
        address indexed target,
        uint256 value,
        bytes data,
        uint256 eta,
        uint256 delay,
        address indexed proposer
    );
    
    event OperationExecuted(
        bytes32 indexed id,
        address indexed target,
        uint256 value,
        bytes data
    );
    
    event OperationCanceled(bytes32 indexed id, address indexed canceler);
    event MinDelayUpdated(uint256 oldDuration, uint256 newDuration);
    event MaxDelayUpdated(uint256 oldDuration, uint256 newDuration);
    event GracePeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event EmergencyCancellation(bytes32 indexed id, address indexed canceler);

    // ============ Modifiers ============
    modifier onlyRoleOrOpenRole(bytes32 role) {
        if (!hasRole(role, address(0))) {
            require(hasRole(role, msg.sender), "Timelock: unauthorized");
        }
        _;
    }

    // ============ Constructor ============
    constructor(
        uint256 _minDelay,
        uint256 _maxDelay,
        uint256 _gracePeriod,
        address admin
    ) {
        require(_minDelay <= _maxDelay, "Timelock: min > max");
        require(_gracePeriod >= 1 days, "Timelock: grace too short");
        
        minDelay = _minDelay;
        maxDelay = _maxDelay;
        gracePeriod = _gracePeriod;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROPOSER_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
        _grantRole(CANCELER_ROLE, admin);
    }

    // ============ Scheduling ============
    function schedule(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay,
        string calldata description
    ) external onlyRole(PROPOSER_ROLE) returns (bytes32) {
        require(delay >= minDelay, "Timelock: insufficient delay");
        require(delay <= maxDelay, "Timelock: excessive delay");
        
        bytes32 id = hashOperation(target, value, data, predecessor, salt);
        require(operations[id].createdAt == 0, "Timelock: already scheduled");

        uint256 eta = block.timestamp + delay;
        
        operations[id] = TimelockOperation({
            id: id,
            target: target,
            value: value,
            data: data,
            eta: eta,
            executed: false,
            canceled: false,
            createdAt: block.timestamp,
            delay: delay,
            proposer: msg.sender,
            description: description
        });

        operationIds.push(id);
        operationCount++;
        proposerOperations[msg.sender].push(id);
        operationsByDay[eta / 1 days].push(id);

        emit OperationScheduled(id, target, value, data, eta, delay, msg.sender);

        return id;
    }

    function scheduleBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay,
        string calldata description
    ) external onlyRole(PROPOSER_ROLE) returns (bytes32) {
        require(targets.length == values.length, "Timelock: length mismatch");
        require(targets.length == datas.length, "Timelock: length mismatch");
        require(delay >= minDelay, "Timelock: insufficient delay");
        require(delay <= maxDelay, "Timelock: excessive delay");
        
        bytes32 id = hashOperationBatch(targets, values, datas, predecessor, salt);
        require(schedules[id].totalOperations == 0, "Timelock: already scheduled");

        uint256 eta = block.timestamp + delay;
        
        OperationSchedule storage schedule_ = schedules[id];
        schedule_.totalOperations = targets.length;
        schedule_.earliestExecution = eta;
        schedule_.latestExecution = eta + gracePeriod;

        for (uint256 i = 0; i < targets.length; i++) {
            bytes32 opId = keccak256(abi.encodePacked(id, i));
            
            operations[opId] = TimelockOperation({
                id: opId,
                target: targets[i],
                value: values[i],
                data: datas[i],
                eta: eta,
                executed: false,
                canceled: false,
                createdAt: block.timestamp,
                delay: delay,
                proposer: msg.sender,
                description: string(abi.encodePacked(description, " - Operation ", _toString(i + 1)))
            });

            schedule_.operationIds.push(opId);
            operationIds.push(opId);
            proposerOperations[msg.sender].push(opId);
        }

        operationCount += targets.length;
        operationsByDay[eta / 1 days].push(id);

        emit OperationScheduled(id, address(0), 0, "", eta, delay, msg.sender);

        return id;
    }

    // ============ Execution ============
    function execute(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt
    ) external payable onlyRoleOrOpenRole(EXECUTOR_ROLE) nonReentrant {
        bytes32 id = hashOperation(target, value, data, predecessor, salt);
        
        TimelockOperation storage op = operations[id];
        require(op.createdAt != 0, "Timelock: not scheduled");
        require(!op.executed, "Timelock: already executed");
        require(!op.canceled, "Timelock: canceled");
        require(block.timestamp >= op.eta, "Timelock: not ready");
        require(block.timestamp <= op.eta + gracePeriod, "Timelock: expired");

        op.executed = true;

        _execute(target, value, data);

        emit OperationExecuted(id, target, value, data);
    }

    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas,
        bytes32 predecessor,
        bytes32 salt
    ) external payable onlyRoleOrOpenRole(EXECUTOR_ROLE) nonReentrant {
        bytes32 id = hashOperationBatch(targets, values, datas, predecessor, salt);
        
        OperationSchedule storage schedule_ = schedules[id];
        require(schedule_.totalOperations > 0, "Timelock: not scheduled");
        require(!schedule_.allExecuted, "Timelock: already executed");
        require(!schedule_.anyCanceled, "Timelock: canceled");

        for (uint256 i = 0; i < targets.length; i++) {
            bytes32 opId = schedule_.operationIds[i];
            TimelockOperation storage op = operations[opId];
            
            require(!op.executed, "Timelock: already executed");
            require(block.timestamp >= op.eta, "Timelock: not ready");
            require(block.timestamp <= op.eta + gracePeriod, "Timelock: expired");

            op.executed = true;
            _execute(targets[i], values[i], datas[i]);

            emit OperationExecuted(opId, targets[i], values[i], datas[i]);
        }

        schedule_.allExecuted = true;
    }

    function _execute(address target, uint256 value, bytes memory data) internal {
        (bool success, ) = target.call{value: value}(data);
        require(success, "Timelock: execution failed");
    }

    // ============ Cancellation ============
    function cancel(bytes32 id) external onlyRole(CANCELER_ROLE) {
        TimelockOperation storage op = operations[id];
        require(op.createdAt != 0, "Timelock: not scheduled");
        require(!op.executed, "Timelock: already executed");
        require(!op.canceled, "Timelock: already canceled");

        op.canceled = true;

        emit OperationCanceled(id, msg.sender);
    }

    function emergencyCancel(bytes32 id) external onlyRole(DEFAULT_ADMIN_ROLE) {
        TimelockOperation storage op = operations[id];
        require(op.createdAt != 0, "Timelock: not scheduled");
        require(!op.executed, "Timelock: already executed");

        op.canceled = true;

        emit EmergencyCancellation(id, msg.sender);
    }

    // ============ View Functions ============
    function hashOperation(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(target, value, data, predecessor, salt));
    }

    function hashOperationBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas,
        bytes32 predecessor,
        bytes32 salt
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(targets, values, datas, predecessor, salt));
    }

    function isOperation(bytes32 id) public view returns (bool) {
        return operations[id].createdAt != 0;
    }

    function isOperationPending(bytes32 id) public view returns (bool) {
        TimelockOperation storage op = operations[id];
        return op.createdAt != 0 && !op.executed && !op.canceled;
    }

    function isOperationReady(bytes32 id) public view returns (bool) {
        TimelockOperation storage op = operations[id];
        return op.createdAt != 0 && !op.executed && !op.canceled && 
               block.timestamp >= op.eta && block.timestamp <= op.eta + gracePeriod;
    }

    function isOperationDone(bytes32 id) public view returns (bool) {
        TimelockOperation storage op = operations[id];
        return op.executed || op.canceled;
    }

    function getOperationState(bytes32 id) external view returns (
        bool exists,
        bool pending,
        bool ready,
        bool executed,
        bool canceled,
        uint256 eta,
        uint256 timeUntilExecution
    ) {
        TimelockOperation storage op = operations[id];
        exists = op.createdAt != 0;
        pending = isOperationPending(id);
        ready = isOperationReady(id);
        executed = op.executed;
        canceled = op.canceled;
        eta = op.eta;
        
        if (block.timestamp < op.eta) {
            timeUntilExecution = op.eta - block.timestamp;
        } else if (block.timestamp <= op.eta + gracePeriod) {
            timeUntilExecution = 0;
        } else {
            timeUntilExecution = type(uint256).max; // Expired
        }
    }

    function getTimestamp(bytes32 id) external view returns (uint256) {
        return operations[id].eta;
    }

    function getOperationsInRange(uint256 start, uint256 end) external view returns (bytes32[] memory) {
        require(start <= end, "Timelock: invalid range");
        require(end <= operationIds.length, "Timelock: out of bounds");
        
        bytes32[] memory result = new bytes32[](end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = operationIds[i];
        }
        return result;
    }

    function getOperationsByDay(uint256 day) external view returns (bytes32[] memory) {
        return operationsByDay[day];
    }

    function getProposerOperations(address proposer) external view returns (bytes32[] memory) {
        return proposerOperations[proposer];
    }

    function getSchedule(bytes32 scheduleId) external view returns (OperationSchedule memory) {
        return schedules[scheduleId];
    }

    function getRemainingDelay(bytes32 id) external view returns (uint256) {
        TimelockOperation storage op = operations[id];
        if (op.eta == 0 || block.timestamp >= op.eta) {
            return 0;
        }
        return op.eta - block.timestamp;
    }

    function getProgressToExecution(bytes32 id) external view returns (uint256 percent) {
        TimelockOperation storage op = operations[id];
        if (op.createdAt == 0 || op.executed || op.canceled) {
            return op.executed ? 100 : 0;
        }
        
        uint256 elapsed = block.timestamp - op.createdAt;
        if (elapsed >= op.delay) {
            return 100;
        }
        
        return (elapsed * 100) / op.delay;
    }

    // ============ Admin Functions ============
    function updateMinDelay(uint256 newMinDelay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMinDelay <= maxDelay, "Timelock: min > max");
        emit MinDelayUpdated(minDelay, newMinDelay);
        minDelay = newMinDelay;
    }

    function updateMaxDelay(uint256 newMaxDelay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxDelay >= minDelay, "Timelock: max < min");
        emit MaxDelayUpdated(maxDelay, newMaxDelay);
        maxDelay = newMaxDelay;
    }

    function updateGracePeriod(uint256 newGracePeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newGracePeriod >= 1 days, "Timelock: grace too short");
        emit GracePeriodUpdated(gracePeriod, newGracePeriod);
        gracePeriod = newGracePeriod;
    }

    // ============ Helper Functions ============
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }

    receive() external payable {}
}
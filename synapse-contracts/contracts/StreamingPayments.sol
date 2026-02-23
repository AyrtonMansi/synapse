// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title StreamingPayments
 * @notice Superfluid-style per-second payment streams
 * @dev Enables continuous money streaming between parties
 */
contract StreamingPayments is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");

    struct Stream {
        uint256 id;
        address sender;
        address recipient;
        address token;
        uint256 ratePerSecond;
        uint256 deposit;
        uint256 remainingBalance;
        uint256 startTime;
        uint256 stopTime;
        bool isActive;
        uint256 lastWithdrawTime;
        uint256 withdrawnAmount;
    }

    mapping(uint256 => Stream) public streams;
    mapping(address => uint256[]) public userStreams;
    mapping(address => bool) public supportedTokens;
    
    uint256 public streamCount;
    uint256 public constant MAX_DURATION = 365 days;
    uint256 public constant MIN_RATE = 1 wei;

    address public treasury;
    uint256 public platformFeeRate = 50; // 0.5%

    event StreamCreated(
        uint256 indexed streamId,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 ratePerSecond,
        uint256 deposit,
        uint256 stopTime
    );
    event StreamCancelled(uint256 indexed streamId, uint256 remainingBalance);
    event WithdrawnFromStream(uint256 indexed streamId, address indexed recipient, uint256 amount);

    modifier validStream(uint256 streamId) {
        require(streamId > 0 && streamId <= streamCount, "StreamingPayments: invalid stream");
        _;
    }

    constructor(address _treasury, address daoAddress) {
        require(_treasury != address(0), "StreamingPayments: zero treasury");
        require(daoAddress != address(0), "StreamingPayments: zero dao");
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, daoAddress);
        _grantRole(DAO_ROLE, daoAddress);
    }

    function createStream(
        address recipient,
        address token,
        uint256 ratePerSecond,
        uint256 deposit,
        uint256 duration
    ) external returns (uint256 streamId) {
        require(recipient != address(0), "StreamingPayments: zero recipient");
        require(recipient != msg.sender, "StreamingPayments: self stream");
        require(supportedTokens[token], "StreamingPayments: token not supported");
        require(ratePerSecond >= MIN_RATE, "StreamingPayments: rate too low");
        require(duration > 0 && duration <= MAX_DURATION, "StreamingPayments: invalid duration");
        require(deposit >= ratePerSecond * duration, "StreamingPayments: insufficient deposit");

        streamCount++;
        streamId = streamCount;

        uint256 startTime = block.timestamp;
        uint256 stopTime = startTime + duration;

        streams[streamId] = Stream({
            id: streamId,
            sender: msg.sender,
            recipient: recipient,
            token: token,
            ratePerSecond: ratePerSecond,
            deposit: deposit,
            remainingBalance: deposit,
            startTime: startTime,
            stopTime: stopTime,
            isActive: true,
            lastWithdrawTime: startTime,
            withdrawnAmount: 0
        });

        userStreams[msg.sender].push(streamId);
        userStreams[recipient].push(streamId);

        IERC20(token).safeTransferFrom(msg.sender, address(this), deposit);
        emit StreamCreated(streamId, msg.sender, recipient, token, ratePerSecond, deposit, stopTime);
        return streamId;
    }

    function calculateWithdrawableAmount(uint256 streamId) public view returns (uint256) {
        Stream storage stream = streams[streamId];
        if (!stream.isActive) return 0;

        uint256 currentTime = block.timestamp > stream.stopTime ? stream.stopTime : block.timestamp;
        uint256 elapsed = currentTime - stream.lastWithdrawTime;
        uint256 earned = elapsed * stream.ratePerSecond;

        return earned > stream.remainingBalance ? stream.remainingBalance : earned;
    }

    function withdrawFromStream(uint256 streamId) external validStream(streamId) nonReentrant {
        Stream storage stream = streams[streamId];
        require(stream.recipient == msg.sender, "StreamingPayments: not recipient");
        require(stream.isActive, "StreamingPayments: stream not active");

        uint256 withdrawable = calculateWithdrawableAmount(streamId);
        require(withdrawable > 0, "StreamingPayments: nothing to withdraw");

        stream.remainingBalance -= withdrawable;
        stream.withdrawnAmount += withdrawable;
        stream.lastWithdrawTime = block.timestamp;

        uint256 fee = (withdrawable * platformFeeRate) / 10000;
        uint256 netAmount = withdrawable - fee;

        if (fee > 0) IERC20(stream.token).safeTransfer(treasury, fee);
        IERC20(stream.token).safeTransfer(msg.sender, netAmount);

        emit WithdrawnFromStream(streamId, msg.sender, netAmount);
    }

    function cancelStream(uint256 streamId) 
        external 
        validStream(streamId) 
        nonReentrant 
    {
        Stream storage stream = streams[streamId];
        require(stream.sender == msg.sender, "StreamingPayments: not sender");
        require(stream.isActive, "StreamingPayments: already cancelled");

        stream.isActive = false;

        uint256 recipientBalance = calculateWithdrawableAmount(streamId);
        if (recipientBalance > 0) {
            stream.remainingBalance -= recipientBalance;
            stream.withdrawnAmount += recipientBalance;
            
            uint256 fee = (recipientBalance * platformFeeRate) / 10000;
            IERC20(stream.token).safeTransfer(treasury, fee);
            IERC20(stream.token).safeTransfer(stream.recipient, recipientBalance - fee);
            emit WithdrawnFromStream(streamId, stream.recipient, recipientBalance - fee);
        }

        uint256 refund = stream.remainingBalance;
        stream.remainingBalance = 0;
        if (refund > 0) IERC20(stream.token).safeTransfer(stream.sender, refund);

        emit StreamCancelled(streamId, refund);
    }

    function addSupportedToken(address token) external onlyRole(DAO_ROLE) {
        supportedTokens[token] = true;
    }

    function removeSupportedToken(address token) external onlyRole(DAO_ROLE) {
        supportedTokens[token] = false;
    }

    function setPlatformFeeRate(uint256 newRate) external onlyRole(DAO_ROLE) {
        require(newRate <= 500, "StreamingPayments: max 5%");
        platformFeeRate = newRate;
    }

    function getUserStreams(address user) external view returns (uint256[] memory) {
        return userStreams[user];
    }
}
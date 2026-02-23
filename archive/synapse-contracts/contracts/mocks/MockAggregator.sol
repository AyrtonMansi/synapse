// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title MockAggregator
 * @notice Mock Chainlink price feed for testing
 */
contract MockAggregator {
    int256 private _price;
    uint8 private _decimals = 8;
    uint256 private _updatedAt;

    function setPrice(int256 price) external {
        _price = price;
        _updatedAt = block.timestamp;
    }

    function setDecimals(uint8 d) external {
        _decimals = d;
    }

    function setUpdatedAt(uint256 timestamp) external {
        _updatedAt = timestamp;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function description() external pure returns (string memory) {
        return "Mock Price Feed";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function getRoundData(uint80) external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (1, _price, _updatedAt, _updatedAt, 1);
    }

    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (1, _price, _updatedAt, _updatedAt, 1);
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function getRoundData(uint80 _roundId) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
    function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/**
 * @title PriceOracle
 * @notice Decentralized multi-source price aggregation
 * @dev Aggregates prices from multiple Chainlink feeds with median calculation
 * @dev REMOVED: Manual price setting for decentralization
 * @dev Uses median of multiple sources, requires minimum sources
 */
contract PriceOracle is Initializable, AccessControl, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    struct PriceSource {
        address feedAddress;
        uint8 decimals;
        bool isActive;
        uint256 heartbeat;
        uint256 weight;
    }

    struct PriceData {
        uint256 price;
        uint8 decimals;
        uint256 timestamp;
        uint256 sourceCount;
        bool isValid;
    }

    mapping(bytes32 => PriceSource[]) public priceSources;
    mapping(bytes32 => uint8) public priceDecimals;
    bytes32[] public supportedAssets;

    uint256 public constant PRICE_PRECISION = 8;
    uint256 public stalenessThreshold;
    uint256 public minimumSources;
    uint256 public constant MAX_STALENESS = 4 hours;
    uint256 public constant MIN_SOURCES = 2;

    event PriceFeedAdded(bytes32 indexed asset, address feed, uint8 decimals);
    event PriceFeedRemoved(bytes32 indexed asset, address feed);
    event StalenessThresholdUpdated(uint256 newThreshold);
    event MinimumSourcesUpdated(uint256 newMinimum);

    error StalePrice(bytes32 asset, uint256 lastUpdate);
    error InvalidPrice(bytes32 asset, int256 price);
    error NoActiveFeed(bytes32 asset);
    error InsufficientSources(bytes32 asset, uint256 found, uint256 required);
    error PriceDeviationTooHigh(bytes32 asset, uint256 deviation);

    constructor() {
        _disableInitializers();
    }

    function initialize(address daoAddress) public initializer {
        require(daoAddress != address(0), "PriceOracle: zero DAO");
        
        _grantRole(DEFAULT_ADMIN_ROLE, daoAddress);
        _grantRole(ORACLE_ADMIN_ROLE, daoAddress);
        _grantRole(UPGRADER_ROLE, daoAddress);
        
        stalenessThreshold = 1 hours;
        minimumSources = MIN_SOURCES;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /**
     * @notice Add a Chainlink price feed for an asset
     * @param asset Asset identifier
     * @param feedAddress Chainlink aggregator address
     * @param heartbeat Maximum acceptable age of data
     * @param weight Source weight for aggregation
     */
    function addPriceFeed(bytes32 asset, address feedAddress, uint256 heartbeat, uint256 weight) external onlyRole(ORACLE_ADMIN_ROLE) {
        require(feedAddress != address(0), "PriceOracle: zero feed");
        require(heartbeat <= MAX_STALENESS, "PriceOracle: heartbeat too high");

        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        uint8 decimals = feed.decimals();

        (, int256 price, , uint256 updatedAt, ) = feed.latestRoundData();
        require(price > 0, "PriceOracle: invalid initial price");

        // Check if this is the first source for this asset
        if (priceSources[asset].length == 0) {
            supportedAssets.push(asset);
            priceDecimals[asset] = decimals;
        }

        priceSources[asset].push(PriceSource({
            feedAddress: feedAddress,
            decimals: decimals,
            isActive: true,
            heartbeat: heartbeat,
            weight: weight
        }));

        emit PriceFeedAdded(asset, feedAddress, decimals);
    }

    /**
     * @notice Remove a price feed
     */
    function removePriceFeed(bytes32 asset, uint256 sourceIndex) external onlyRole(ORACLE_ADMIN_ROLE) {
        require(sourceIndex < priceSources[asset].length, "PriceOracle: invalid index");
        
        address feedAddress = priceSources[asset][sourceIndex].feedAddress;
        
        // Remove by swapping with last element
        uint256 lastIndex = priceSources[asset].length - 1;
        if (sourceIndex != lastIndex) {
            priceSources[asset][sourceIndex] = priceSources[asset][lastIndex];
        }
        priceSources[asset].pop();

        // If no sources left, remove from supported assets
        if (priceSources[asset].length == 0) {
            for (uint256 i = 0; i < supportedAssets.length; i++) {
                if (supportedAssets[i] == asset) {
                    supportedAssets[i] = supportedAssets[supportedAssets.length - 1];
                    supportedAssets.pop();
                    break;
                }
            }
        }

        emit PriceFeedRemoved(asset, feedAddress);
    }

    /**
     * @notice Get latest aggregated price using median
     * @param asset Asset identifier
     * @return priceData Aggregated price data
     */
    function getLatestPrice(bytes32 asset) external view returns (PriceData memory priceData) {
        PriceSource[] storage sources = priceSources[asset];
        
        if (sources.length == 0) {
            revert NoActiveFeed(asset);
        }

        uint256[] memory validPrices = new uint256[](sources.length);
        uint256 validCount = 0;
        uint8 decimals = 0;

        // Collect valid prices from all sources
        for (uint256 i = 0; i < sources.length; i++) {
            if (!sources[i].isActive) continue;

            try AggregatorV3Interface(sources[i].feedAddress).latestRoundData() returns (
                uint80 roundId,
                int256 answer,
                uint256 startedAt,
                uint256 updatedAt,
                uint80 answeredInRound
            ) {
                // Validate price
                if (answer <= 0) continue;
                if (updatedAt == 0 || updatedAt > block.timestamp) continue;
                if (block.timestamp - updatedAt > stalenessThreshold) continue;
                if (answeredInRound < roundId) continue;

                uint256 price = uint256(answer);
                
                // Normalize to PRICE_PRECISION decimals
                if (sources[i].decimals < PRICE_PRECISION) {
                    price = price * (10 ** (PRICE_PRECISION - sources[i].decimals));
                } else if (sources[i].decimals > PRICE_PRECISION) {
                    price = price / (10 ** (sources[i].decimals - PRICE_PRECISION));
                }

                validPrices[validCount] = price;
                validCount++;
                decimals = uint8(PRICE_PRECISION);
            } catch {
                continue;
            }
        }

        if (validCount < minimumSources) {
            revert InsufficientSources(asset, validCount, minimumSources);
        }

        // Calculate median
        uint256 medianPrice = _calculateMedian(validPrices, validCount);

        // Check deviation between sources
        uint256 maxDeviation = _calculateMaxDeviation(validPrices, validCount, medianPrice);
        if (maxDeviation > 500) { // 5% max deviation
            revert PriceDeviationTooHigh(asset, maxDeviation);
        }

        return PriceData({
            price: medianPrice,
            decimals: decimals,
            timestamp: block.timestamp,
            sourceCount: validCount,
            isValid: true
        });
    }

    /**
     * @notice Calculate median of array
     */
    function _calculateMedian(uint256[] memory arr, uint256 length) internal pure returns (uint256) {
        if (length == 0) return 0;
        if (length == 1) return arr[0];

        // Sort array (simple bubble sort for small arrays)
        for (uint256 i = 0; i < length; i++) {
            for (uint256 j = i + 1; j < length; j++) {
                if (arr[j] < arr[i]) {
                    uint256 temp = arr[i];
                    arr[i] = arr[j];
                    arr[j] = temp;
                }
            }
        }

        if (length % 2 == 0) {
            return (arr[length / 2 - 1] + arr[length / 2]) / 2;
        } else {
            return arr[length / 2];
        }
    }

    /**
     * @notice Calculate maximum deviation from median (in basis points)
     */
    function _calculateMaxDeviation(uint256[] memory arr, uint256 length, uint256 median) internal pure returns (uint256) {
        if (median == 0) return 0;
        
        uint256 maxDev = 0;
        for (uint256 i = 0; i < length; i++) {
            uint256 dev = arr[i] > median ? 
                ((arr[i] - median) * 10000) / median : 
                ((median - arr[i]) * 10000) / median;
            if (dev > maxDev) maxDev = dev;
        }
        return maxDev;
    }

    function getUSDValue(bytes32 asset, uint256 amount, uint8 tokenDecimals) external view returns (uint256 usdValue) {
        PriceData memory data = this.getLatestPrice(asset);
        usdValue = (amount * data.price) / (10 ** uint256(tokenDecimals));
    }

    function convert(bytes32 fromAsset, bytes32 toAsset, uint256 amount) external view returns (uint256 convertedAmount) {
        PriceData memory fromData = this.getLatestPrice(fromAsset);
        PriceData memory toData = this.getLatestPrice(toAsset);
        require(toData.price > 0, "PriceOracle: zero to price");
        convertedAmount = (amount * fromData.price) / toData.price;
    }

    function isFeedHealthy(bytes32 asset) external view returns (bool) {
        PriceSource[] storage sources = priceSources[asset];
        uint256 healthyCount = 0;

        for (uint256 i = 0; i < sources.length; i++) {
            if (!sources[i].isActive) continue;
            
            try AggregatorV3Interface(sources[i].feedAddress).latestRoundData() returns (
                uint80 roundId,
                int256 answer,
                uint256 startedAt,
                uint256 updatedAt,
                uint80 answeredInRound
            ) {
                if (answer > 0 && updatedAt > 0 && 
                    block.timestamp - updatedAt <= stalenessThreshold &&
                    answeredInRound >= roundId) {
                    healthyCount++;
                }
            } catch {
                continue;
            }
        }

        return healthyCount >= minimumSources;
    }

    function getSourceCount(bytes32 asset) external view returns (uint256) {
        return priceSources[asset].length;
    }

    function getActiveSourceCount(bytes32 asset) external view returns (uint256) {
        PriceSource[] storage sources = priceSources[asset];
        uint256 count = 0;
        for (uint256 i = 0; i < sources.length; i++) {
            if (sources[i].isActive) count++;
        }
        return count;
    }

    function setStalenessThreshold(uint256 newThreshold) external onlyRole(ORACLE_ADMIN_ROLE) {
        require(newThreshold <= MAX_STALENESS, "PriceOracle: exceeds max");
        stalenessThreshold = newThreshold;
        emit StalenessThresholdUpdated(newThreshold);
    }

    function setMinimumSources(uint256 newMinimum) external onlyRole(ORACLE_ADMIN_ROLE) {
        require(newMinimum >= MIN_SOURCES, "PriceOracle: below minimum");
        minimumSources = newMinimum;
        emit MinimumSourcesUpdated(newMinimum);
    }

    function getSupportedAssets() external view returns (bytes32[] memory) {
        return supportedAssets;
    }
}

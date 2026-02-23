// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IPriceOracle {
    function getPrice(address token) external view returns (uint256);
    function getETHPrice() external view returns (uint256);
}

/**
 * @title TreasuryAnalytics
 * @notice Real-time treasury analytics, spending tracking, and revenue sharing
 * @dev Tracks all treasury movements with detailed analytics
 */
contract TreasuryAnalytics {
    using SafeERC20 for IERC20;

    // ============ Structs ============
    struct Asset {
        address token;
        string symbol;
        uint256 balance;
        uint256 price;
        uint256 valueUSD;
        uint8 decimals;
        bool isETH;
        bool isActive;
    }

    struct TreasurySnapshot {
        uint256 timestamp;
        uint256 totalValueUSD;
        uint256 ethBalance;
        uint256 tokenCount;
        Asset[] assets;
    }

    struct SpendingProposal {
        uint256 id;
        address token;
        address recipient;
        uint256 amount;
        uint256 amountUSD;
        string description;
        string category;
        uint256 proposedAt;
        uint256 executedAt;
        bool executed;
        bool approved;
        uint256 approvedBy;
    }

    struct RevenueShare {
        uint256 periodStart;
        uint256 periodEnd;
        uint256 totalRevenue;
        uint256 distributedAmount;
        uint256 burnAmount;
        uint256 stakingRewards;
        uint256 treasuryAllocation;
        uint256 holderCount;
        bool distributed;
    }

    struct TokenBurn {
        uint256 id;
        uint256 amount;
        uint256 priceAtBurn;
        uint256 valueUSD;
        uint256 timestamp;
        string reason;
        bytes32 txHash;
    }

    // ============ State Variables ============
    address public treasury;
    address public governor;
    address public priceOracle;
    
    address[] public trackedTokens;
    mapping(address => Asset) public assets;
    mapping(uint256 => TreasurySnapshot) public snapshots;
    mapping(uint256 => SpendingProposal) public spendingProposals;
    mapping(uint256 => RevenueShare) public revenueShares;
    mapping(uint256 => TokenBurn) public tokenBurns;
    
    uint256 public snapshotCount;
    uint256 public spendingProposalCount;
    uint256 public revenueShareCount;
    uint256 public tokenBurnCount;
    
    uint256 public totalBurned;
    uint256 public totalSpent;
    uint256 public totalRevenue;
    
    uint256 public burnRate; // Basis points (e.g., 100 = 1%)
    uint256 public stakingShare; // Basis points
    uint256 public treasuryShare; // Basis points
    
    bool public analyticsEnabled;

    // ============ Events ============
    event AssetTracked(address indexed token, string symbol);
    event AssetUntracked(address indexed token);
    event SnapshotTaken(uint256 indexed id, uint256 timestamp, uint256 totalValue);
    event SpendingProposed(uint256 indexed id, address indexed token, uint256 amount);
    event SpendingApproved(uint256 indexed id, address indexed approver);
    event SpendingExecuted(uint256 indexed id, address indexed recipient, uint256 amount);
    event RevenueShareCreated(uint256 indexed id, uint256 periodStart, uint256 periodEnd);
    event RevenueDistributed(uint256 indexed id, uint256 distributedAmount);
    event TokensBurned(uint256 indexed id, uint256 amount, uint256 valueUSD, string reason);
    event SharesUpdated(uint256 burnRate, uint256 stakingShare, uint256 treasuryShare);

    // ============ Modifiers ============
    modifier onlyGovernor() {
        require(msg.sender == governor, "Analytics: only governor");
        _;
    }

    modifier onlyTreasury() {
        require(msg.sender == treasury, "Analytics: only treasury");
        _;
    }

    // ============ Constructor ============
    constructor(
        address _treasury,
        address _governor,
        address _priceOracle
    ) {
        require(_treasury != address(0), "Analytics: zero treasury");
        require(_governor != address(0), "Analytics: zero governor");
        
        treasury = _treasury;
        governor = _governor;
        priceOracle = _priceOracle;
        
        // Default revenue sharing: 30% burn, 40% staking, 30% treasury
        burnRate = 3000;
        stakingShare = 4000;
        treasuryShare = 3000;
        
        analyticsEnabled = true;
        
        // Track ETH by default
        assets[address(0)] = Asset({
            token: address(0),
            symbol: "ETH",
            balance: 0,
            price: 0,
            valueUSD: 0,
            decimals: 18,
            isETH: true,
            isActive: true
        });
    }

    // ============ Asset Management ============
    function trackAsset(address token, string calldata symbol, uint8 decimals) 
        external 
        onlyGovernor 
    {
        require(token != address(0), "Analytics: zero token");
        require(!assets[token].isActive, "Analytics: already tracked");
        
        assets[token] = Asset({
            token: token,
            symbol: symbol,
            balance: 0,
            price: 0,
            valueUSD: 0,
            decimals: decimals,
            isETH: false,
            isActive: true
        });
        
        trackedTokens.push(token);
        
        emit AssetTracked(token, symbol);
    }

    function untrackAsset(address token) external onlyGovernor {
        require(assets[token].isActive, "Analytics: not tracked");
        
        assets[token].isActive = false;
        
        // Remove from tracked tokens array
        for (uint256 i = 0; i < trackedTokens.length; i++) {
            if (trackedTokens[i] == token) {
                trackedTokens[i] = trackedTokens[trackedTokens.length - 1];
                trackedTokens.pop();
                break;
            }
        }
        
        emit AssetUntracked(token);
    }

    function updateAssetPrice(address token, uint256 price) external {
        require(assets[token].isActive, "Analytics: asset not tracked");
        assets[token].price = price;
    }

    // ============ Snapshot Functions ============
    function takeSnapshot() external returns (uint256) {
        require(analyticsEnabled, "Analytics: disabled");
        
        snapshotCount++;
        TreasurySnapshot storage snapshot = snapshots[snapshotCount];
        snapshot.timestamp = block.timestamp;
        
        // Update ETH balance and price
        uint256 ethBalance = treasury.balance;
        uint256 ethPrice = _getETHPrice();
        
        assets[address(0)].balance = ethBalance;
        assets[address(0)].price = ethPrice;
        assets[address(0)].valueUSD = (ethBalance * ethPrice) / 1e18;
        
        snapshot.ethBalance = ethBalance;
        snapshot.totalValueUSD = assets[address(0)].valueUSD;
        
        // Update all tracked tokens
        for (uint256 i = 0; i < trackedTokens.length; i++) {
            address token = trackedTokens[i];
            if (!assets[token].isActive) continue;
            
            uint256 balance = IERC20(token).balanceOf(treasury);
            uint256 price = _getTokenPrice(token);
            uint256 decimals = assets[token].decimals;
            
            assets[token].balance = balance;
            assets[token].price = price;
            assets[token].valueUSD = (balance * price) / (10 ** decimals);
            
            snapshot.assets.push(assets[token]);
            snapshot.totalValueUSD += assets[token].valueUSD;
            snapshot.tokenCount++;
        }
        
        emit SnapshotTaken(snapshotCount, block.timestamp, snapshot.totalValueUSD);
        
        return snapshotCount;
    }

    // ============ Spending Proposals ============
    function proposeSpending(
        address token,
        address recipient,
        uint256 amount,
        string calldata description,
        string calldata category
    ) external onlyTreasury returns (uint256) {
        require(analyticsEnabled, "Analytics: disabled");
        require(recipient != address(0), "Analytics: zero recipient");
        require(amount > 0, "Analytics: zero amount");
        
        spendingProposalCount++;
        uint256 price = token == address(0) ? _getETHPrice() : _getTokenPrice(token);
        uint8 decimals = token == address(0) ? 18 : assets[token].decimals;
        
        spendingProposals[spendingProposalCount] = SpendingProposal({
            id: spendingProposalCount,
            token: token,
            recipient: recipient,
            amount: amount,
            amountUSD: (amount * price) / (10 ** decimals),
            description: description,
            category: category,
            proposedAt: block.timestamp,
            executedAt: 0,
            executed: false,
            approved: false,
            approvedBy: 0
        });
        
        emit SpendingProposed(spendingProposalCount, token, amount);
        
        return spendingProposalCount;
    }

    function approveSpending(uint256 proposalId) external onlyGovernor {
        SpendingProposal storage proposal = spendingProposals[proposalId];
        require(proposal.id > 0, "Analytics: invalid proposal");
        require(!proposal.approved, "Analytics: already approved");
        
        proposal.approved = true;
        proposal.approvedBy = uint256(uint160(msg.sender));
        
        emit SpendingApproved(proposalId, msg.sender);
    }

    function recordSpendingExecuted(uint256 proposalId) external onlyTreasury {
        SpendingProposal storage proposal = spendingProposals[proposalId];
        require(proposal.approved, "Analytics: not approved");
        require(!proposal.executed, "Analytics: already executed");
        
        proposal.executed = true;
        proposal.executedAt = block.timestamp;
        
        totalSpent += proposal.amountUSD;
        
        emit SpendingExecuted(proposalId, proposal.recipient, proposal.amount);
    }

    // ============ Revenue Sharing ============
    function createRevenueShare(
        uint256 periodStart,
        uint256 periodEnd,
        uint256 totalRevenue
    ) external onlyTreasury returns (uint256) {
        require(analyticsEnabled, "Analytics: disabled");
        require(periodEnd > periodStart, "Analytics: invalid period");
        
        revenueShareCount++;
        
        uint256 burnAmount = (totalRevenue * burnRate) / 10000;
        uint256 stakingAmount = (totalRevenue * stakingShare) / 10000;
        uint256 treasuryAmount = (totalRevenue * treasuryShare) / 10000;
        
        revenueShares[revenueShareCount] = RevenueShare({
            periodStart: periodStart,
            periodEnd: periodEnd,
            totalRevenue: totalRevenue,
            distributedAmount: 0,
            burnAmount: burnAmount,
            stakingRewards: stakingAmount,
            treasuryAllocation: treasuryAmount,
            holderCount: 0,
            distributed: false
        });
        
        totalRevenue += totalRevenue;
        
        emit RevenueShareCreated(revenueShareCount, periodStart, periodEnd);
        
        return revenueShareCount;
    }

    function recordRevenueDistributed(uint256 shareId, uint256 amount) external onlyTreasury {
        RevenueShare storage share = revenueShares[shareId];
        require(!share.distributed, "Analytics: already distributed");
        
        share.distributedAmount += amount;
        
        if (share.distributedAmount >= share.totalRevenue) {
            share.distributed = true;
        }
        
        emit RevenueDistributed(shareId, amount);
    }

    // ============ Token Burning ============
    function recordBurn(
        uint256 amount,
        string calldata reason,
        bytes32 txHash
    ) external onlyTreasury returns (uint256) {
        require(analyticsEnabled, "Analytics: disabled");
        require(amount > 0, "Analytics: zero amount");
        
        tokenBurnCount++;
        uint256 price = _getTokenPrice(address(0)); // Assume governance token
        
        tokenBurns[tokenBurnCount] = TokenBurn({
            id: tokenBurnCount,
            amount: amount,
            priceAtBurn: price,
            valueUSD: (amount * price) / 1e18,
            timestamp: block.timestamp,
            reason: reason,
            txHash: txHash
        });
        
        totalBurned += amount;
        
        emit TokensBurned(tokenBurnCount, amount, (amount * price) / 1e18, reason);
        
        return tokenBurnCount;
    }

    // ============ View Functions ============
    function getTreasuryValue() external view returns (
        uint256 totalValueUSD,
        uint256 ethValueUSD,
        uint256 tokenValuesUSD,
        Asset[] memory assetList
    ) {
        // Calculate current values
        totalValueUSD = 0;
        ethValueUSD = 0;
        tokenValuesUSD = 0;
        
        // ETH
        uint256 ethBalance = treasury.balance;
        uint256 ethPrice = _getETHPrice();
        ethValueUSD = (ethBalance * ethPrice) / 1e18;
        totalValueUSD += ethValueUSD;
        
        // Tokens
        assetList = new Asset[](trackedTokens.length + 1);
        assetList[0] = Asset({
            token: address(0),
            symbol: "ETH",
            balance: ethBalance,
            price: ethPrice,
            valueUSD: ethValueUSD,
            decimals: 18,
            isETH: true,
            isActive: true
        });
        
        for (uint256 i = 0; i < trackedTokens.length; i++) {
            address token = trackedTokens[i];
            if (!assets[token].isActive) continue;
            
            uint256 balance = IERC20(token).balanceOf(treasury);
            uint256 price = _getTokenPrice(token);
            uint8 decimals = assets[token].decimals;
            uint256 value = (balance * price) / (10 ** decimals);
            
            tokenValuesUSD += value;
            totalValueUSD += value;
            
            assetList[i + 1] = Asset({
                token: token,
                symbol: assets[token].symbol,
                balance: balance,
                price: price,
                valueUSD: value,
                decimals: decimals,
                isETH: false,
                isActive: true
            });
        }
    }

    function getSnapshot(uint256 snapshotId) external view returns (TreasurySnapshot memory) {
        return snapshots[snapshotId];
    }

    function getSpendingProposal(uint256 proposalId) external view returns (SpendingProposal memory) {
        return spendingProposals[proposalId];
    }

    function getRevenueShare(uint256 shareId) external view returns (RevenueShare memory) {
        return revenueShares[shareId];
    }

    function getTokenBurn(uint256 burnId) external view returns (TokenBurn memory) {
        return tokenBurns[burnId];
    }

    function getSpendingByCategory(string calldata category) external view returns (uint256 totalUSD) {
        for (uint256 i = 1; i <= spendingProposalCount; i++) {
            if (
                keccak256(bytes(spendingProposals[i].category)) == keccak256(bytes(category)) &&
                spendingProposals[i].executed
            ) {
                totalUSD += spendingProposals[i].amountUSD;
            }
        }
    }

    function getRecentBurns(uint256 count) external view returns (TokenBurn[] memory) {
        uint256 start = tokenBurnCount > count ? tokenBurnCount - count : 0;
        TokenBurn[] memory result = new TokenBurn[](tokenBurnCount - start);
        
        for (uint256 i = start; i < tokenBurnCount; i++) {
            result[i - start] = tokenBurns[i + 1];
        }
        
        return result;
    }

    function calculateRevenueShare(uint256 revenue) external view returns (
        uint256 burnAmount,
        uint256 stakingAmount,
        uint256 treasuryAmount
    ) {
        burnAmount = (revenue * burnRate) / 10000;
        stakingAmount = (revenue * stakingShare) / 10000;
        treasuryAmount = (revenue * treasuryShare) / 10000;
    }

    // ============ Internal Functions ============
    function _getETHPrice() internal view returns (uint256) {
        if (priceOracle == address(0)) return 0;
        return IPriceOracle(priceOracle).getETHPrice();
    }

    function _getTokenPrice(address token) internal view returns (uint256) {
        if (priceOracle == address(0)) return 0;
        return IPriceOracle(priceOracle).getPrice(token);
    }

    // ============ Admin Functions ============
    function setPriceOracle(address newOracle) external onlyGovernor {
        priceOracle = newOracle;
    }

    function setShares(
        uint256 newBurnRate,
        uint256 newStakingShare,
        uint256 newTreasuryShare
    ) external onlyGovernor {
        require(newBurnRate + newStakingShare + newTreasuryShare <= 10000, "Analytics: exceeds 100%");
        
        burnRate = newBurnRate;
        stakingShare = newStakingShare;
        treasuryShare = newTreasuryShare;
        
        emit SharesUpdated(burnRate, stakingShare, treasuryShare);
    }

    function toggleAnalytics(bool enabled) external onlyGovernor {
        analyticsEnabled = enabled;
    }

    function setGovernor(address newGovernor) external onlyGovernor {
        require(newGovernor != address(0), "Analytics: zero governor");
        governor = newGovernor;
    }

    function setTreasury(address newTreasury) external onlyGovernor {
        require(newTreasury != address(0), "Analytics: zero treasury");
        treasury = newTreasury;
    }
}
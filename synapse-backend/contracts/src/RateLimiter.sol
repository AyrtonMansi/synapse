// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SynapseRateLimiter
 * @notice Smart contract-based rate limiting for API access
 * @dev Tracks quota on-chain for decentralized rate limiting
 */
contract SynapseRateLimiter {
    
    struct Quota {
        uint256 requestsPerMinute;
        uint256 requestsPerHour;
        uint256 requestsPerDay;
        uint256 lastUpdated;
    }
    
    struct Usage {
        uint256 minuteWindow;
        uint256 hourWindow;
        uint256 dayWindow;
        uint256 minuteCount;
        uint256 hourCount;
        uint256 dayCount;
        uint256 totalRequests;
    }
    
    // Default quotas
    uint256 public defaultPerMinute = 60;
    uint256 public defaultPerHour = 1000;
    uint256 public defaultPerDay = 10000;
    
    // User quotas (0 = use default)
    mapping(address => Quota) public customQuota;
    
    // Usage tracking
    mapping(address => Usage) public usage;
    
    // Authorized API gateways that can update usage
    mapping(address => bool) public authorizedGateways;
    
    address public owner;
    
    // Events
    event QuotaUpdated(
        address indexed user,
        uint256 perMinute,
        uint256 perHour,
        uint256 perDay
    );
    
    event QuotaExceeded(
        address indexed user,
        uint256 timestamp
    );
    
    event GatewayAuthorized(address indexed gateway);
    event GatewayDeauthorized(address indexed gateway);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyAuthorized() {
        require(authorizedGateways[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @notice Get effective quota for a user
     * @param _user User address
     */
    function getRateLimit(address _user) external view returns (
        uint256 perMinute,
        uint256 perHour,
        uint256 perDay
    ) {
        Quota storage quota = customQuota[_user];
        
        perMinute = quota.requestsPerMinute > 0 ? quota.requestsPerMinute : defaultPerMinute;
        perHour = quota.requestsPerHour > 0 ? quota.requestsPerHour : defaultPerHour;
        perDay = quota.requestsPerDay > 0 ? quota.requestsPerDay : defaultPerDay;
    }
    
    /**
     * @notice Check if user has remaining quota
     * @param _user User address
     */
    function hasQuota(address _user) public view returns (bool) {
        (uint256 perMinute, uint256 perHour, uint256 perDay) = this.getRateLimit(_user);
        Usage storage u = usage[_user];
        
        uint256 currentWindow = block.timestamp / 60; // Minute window
        
        // Reset counters if window changed
        uint256 effectiveMinute = currentWindow == u.minuteWindow ? u.minuteCount : 0;
        uint256 effectiveHour = (block.timestamp / 3600) == u.hourWindow ? u.hourCount : 0;
        uint256 effectiveDay = (block.timestamp / 86400) == u.dayWindow ? u.dayCount : 0;
        
        return effectiveMinute < perMinute && 
               effectiveHour < perHour && 
               effectiveDay < perDay;
    }
    
    /**
     * @notice Check and update quota for a request
     * @param _user User address
     * @return allowed Whether request is allowed
     */
    function checkAndUpdateRateLimit(address _user) external onlyAuthorized returns (bool allowed) {
        if (!hasQuota(_user)) {
            emit QuotaExceeded(_user, block.timestamp);
            return false;
        }
        
        Usage storage u = usage[_user];
        uint256 currentMinute = block.timestamp / 60;
        uint256 currentHour = block.timestamp / 3600;
        uint256 currentDay = block.timestamp / 86400;
        
        // Reset minute counter if window changed
        if (currentMinute != u.minuteWindow) {
            u.minuteWindow = currentMinute;
            u.minuteCount = 0;
        }
        
        // Reset hour counter if window changed
        if (currentHour != u.hourWindow) {
            u.hourWindow = currentHour;
            u.hourCount = 0;
        }
        
        // Reset day counter if window changed
        if (currentDay != u.dayWindow) {
            u.dayWindow = currentDay;
            u.dayCount = 0;
        }
        
        // Increment counters
        u.minuteCount++;
        u.hourCount++;
        u.dayCount++;
        u.totalRequests++;
        
        return true;
    }
    
    /**
     * @notice Get remaining quota for user
     * @param _user User address
     */
    function getRemainingQuota(address _user) external view returns (
        uint256 minuteRemaining,
        uint256 hourRemaining,
        uint256 dayRemaining
    ) {
        (uint256 perMinute, uint256 perHour, uint256 perDay) = this.getRateLimit(_user);
        Usage storage u = usage[_user];
        
        uint256 currentMinute = block.timestamp / 60;
        uint256 currentHour = block.timestamp / 3600;
        uint256 currentDay = block.timestamp / 86400;
        
        uint256 usedMinute = currentMinute == u.minuteWindow ? u.minuteCount : 0;
        uint256 usedHour = currentHour == u.hourWindow ? u.hourCount : 0;
        uint256 usedDay = currentDay == u.dayWindow ? u.dayCount : 0;
        
        minuteRemaining = perMinute > usedMinute ? perMinute - usedMinute : 0;
        hourRemaining = perHour > usedHour ? perHour - usedHour : 0;
        dayRemaining = perDay > usedDay ? perDay - usedDay : 0;
    }
    
    /**
     * @notice Set custom quota for a user
     * @param _user User address
     * @param _perMinute Requests per minute
     * @param _perHour Requests per hour
     * @param _perDay Requests per day
     */
    function setCustomQuota(
        address _user,
        uint256 _perMinute,
        uint256 _perHour,
        uint256 _perDay
    ) external onlyOwner {
        require(_perMinute <= 1000, "Per-minute too high");
        require(_perHour <= 10000, "Per-hour too high");
        require(_perDay <= 100000, "Per-day too high");
        
        customQuota[_user] = Quota({
            requestsPerMinute: _perMinute,
            requestsPerHour: _perHour,
            requestsPerDay: _perDay,
            lastUpdated: block.timestamp
        });
        
        emit QuotaUpdated(_user, _perMinute, _perHour, _perDay);
    }
    
    /**
     * @notice Set default quotas
     */
    function setDefaultQuotas(
        uint256 _perMinute,
        uint256 _perHour,
        uint256 _perDay
    ) external onlyOwner {
        defaultPerMinute = _perMinute;
        defaultPerHour = _perHour;
        defaultPerDay = _perDay;
    }
    
    /**
     * @notice Authorize an API gateway
     * @param _gateway Gateway address
     */
    function authorizeGateway(address _gateway) external onlyOwner {
        authorizedGateways[_gateway] = true;
        emit GatewayAuthorized(_gateway);
    }
    
    /**
     * @notice Deauthorize an API gateway
     * @param _gateway Gateway address
     */
    function deauthorizeGateway(address _gateway) external onlyOwner {
        authorizedGateways[_gateway] = false;
        emit GatewayDeauthorized(_gateway);
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title ModelRegistry
 * @notice Decentralized AI model registry with pricing, VRAM requirements, and feature flags
 * @dev UUPS Upgradeable, DAO-controlled, timelocked critical functions
 */
contract ModelRegistry is Initializable, AccessControl, ReentrancyGuard, UUPSUpgradeable {
    
    // ============ Roles ============
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ============ Enums ============
    enum ModelStatus {
        Pending,
        Active,
        Deprecated,
        Disabled
    }

    // ============ Structs ============
    struct Model {
        string modelId;              // HuggingFace model ID (e.g., "deepseek-ai/DeepSeek-V3")
        string name;                 // Display name
        string description;          // Model description
        uint256 pricePerToken;       // Price in wei per token
        uint256 minVramGB;           // Minimum VRAM required in GB
        uint256 maxVramGB;           // Recommended VRAM in GB
        uint256 contextLength;       // Maximum context length
        bool supportsVision;         // Vision/multimodal support
        bool supportsTools;          // Function calling/tools support
        bool supportsJson;           // JSON mode support
        ModelStatus status;          // Current status
        uint256 addedAt;             // Timestamp when added
        uint256 updatedAt;           // Last update timestamp
        string[] tags;               // Model tags/categories
    }

    struct PricingTier {
        uint256 basePrice;           // Base price per token
        uint256 discountPercent;     // Discount percentage (0-100)
        uint256 minStakeRequired;    // Minimum stake for this tier
    }

    // ============ Storage ============
    mapping(string => Model) public models;                    // modelId => Model
    mapping(string => bool) public isModelRegistered;          // modelId => exists
    string[] public modelList;                                  // List of all model IDs
    
    mapping(uint8 => PricingTier) public pricingTiers;         // tier => PricingTier
    mapping(address => uint8) public userPricingTier;          // user => tier level
    
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public platformFeePercent;                          // Platform fee (e.g., 500 = 5%)
    uint256 public minPricePerToken;                            // Minimum allowed price
    uint256 public maxPricePerToken;                            // Maximum allowed price
    
    TimelockController public timelock;
    
    // ============ Events ============
    event ModelRegistered(
        string indexed modelId,
        string name,
        uint256 pricePerToken,
        uint256 minVramGB,
        uint256 maxVramGB
    );
    event ModelUpdated(string indexed modelId, string field, uint256 oldValue, uint256 newValue);
    event ModelStatusChanged(string indexed modelId, ModelStatus oldStatus, ModelStatus newStatus);
    event ModelDeprecated(string indexed modelId, string reason);
    event PriceUpdated(string indexed modelId, uint256 oldPrice, uint256 newPrice);
    event PricingTierSet(uint8 tier, uint256 basePrice, uint256 discountPercent);
    event UserPricingTierSet(address indexed user, uint8 tier);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event MinMaxPriceUpdated(uint256 minPrice, uint256 maxPrice);

    // ============ Modifiers ============
    modifier validModel(string memory modelId) {
        require(isModelRegistered[modelId], "ModelRegistry: model not registered");
        _;
    }

    modifier activeModel(string memory modelId) {
        require(isModelRegistered[modelId], "ModelRegistry: model not registered");
        require(models[modelId].status == ModelStatus.Active, "ModelRegistry: model not active");
        _;
    }

    // ============ Constructor ============
    constructor() {
        _disableInitializers();
    }

    // ============ Initializer ============
    function initialize(
        address _dao,
        TimelockController _timelock
    ) public initializer {
        require(_dao != address(0), "ModelRegistry: zero dao");
        require(address(_timelock) != address(0), "ModelRegistry: zero timelock");
        
        timelock = _timelock;
        
        // Initialize default values
        platformFeePercent = 500;        // 5% platform fee
        minPricePerToken = 1e12;         // 0.000001 tokens minimum
        maxPricePerToken = 1e20;         // 100 tokens maximum
        
        _grantRole(DEFAULT_ADMIN_ROLE, address(_timelock));
        _grantRole(DAO_ROLE, _dao);
        _grantRole(UPGRADER_ROLE, address(_timelock));
        _grantRole(OPERATOR_ROLE, _dao);
        
        // Initialize pricing tiers
        pricingTiers[0] = PricingTier({basePrice: 1e14, discountPercent: 0, minStakeRequired: 0});           // Free tier
        pricingTiers[1] = PricingTier({basePrice: 9e13, discountPercent: 10, minStakeRequired: 1000e18});    // Basic (10% off)
        pricingTiers[2] = PricingTier({basePrice: 8e13, discountPercent: 20, minStakeRequired: 10000e18});   // Pro (20% off)
        pricingTiers[3] = PricingTier({basePrice: 7e13, discountPercent: 30, minStakeRequired: 100000e18});  // Enterprise (30% off)
        
        // Initialize default models
        _initializeDefaultModels();
    }

    // ============ Upgrade Authorization ============
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // ============ Internal Model Registration ============
    function _initializeDefaultModels() internal {
        // DeepSeek V3 - 671B MoE model
        _registerModel(
            "deepseek-ai/DeepSeek-V3",
            "DeepSeek V3",
            "DeepSeek-V3 is a powerful MoE language model with 671B total parameters",
            5e13,           // 0.00005 per token
            80,             // 80GB VRAM minimum
            160,            // 160GB recommended
            64000,          // 64K context
            false,          // No vision
            true,           // Tools support
            true,           // JSON mode
            _toArray("deepseek", "moe", "large", "code")
        );
        
        // DeepSeek R1 - Reasoning model
        _registerModel(
            "deepseek-ai/DeepSeek-R1",
            "DeepSeek R1",
            "DeepSeek-R1 is a reasoning model trained with RL for complex tasks",
            6e13,           // 0.00006 per token
            80,             // 80GB VRAM minimum
            160,            // 160GB recommended
            64000,          // 64K context
            false,          // No vision
            true,           // Tools support
            true,           // JSON mode
            _toArray("deepseek", "reasoning", "rl", "large")
        );
        
        // Llama 3.1 8B
        _registerModel(
            "meta-llama/Meta-Llama-3.1-8B",
            "Llama 3.1 8B",
            "Meta's efficient 8B parameter multilingual model",
            8e12,           // 0.000008 per token (cheaper, smaller model)
            8,              // 8GB VRAM minimum
            16,             // 16GB recommended
            128000,         // 128K context
            false,          // No vision
            true,           // Tools support
            true,           // JSON mode
            _toArray("meta", "llama", "8b", "multilingual")
        );
        
        // Llama 3.1 70B
        _registerModel(
            "meta-llama/Meta-Llama-3.1-70B",
            "Llama 3.1 70B",
            "Meta's powerful 70B parameter multilingual model",
            3e13,           // 0.00003 per token
            40,             // 40GB VRAM minimum
            80,             // 80GB recommended
            128000,         // 128K context
            false,          // No vision
            true,           // Tools support
            true,           // JSON mode
            _toArray("meta", "llama", "70b", "multilingual", "large")
        );
        
        // Llama 3.2 3B
        _registerModel(
            "meta-llama/Llama-3.2-3B-Instruct",
            "Llama 3.2 3B",
            "Lightweight edge-optimized 3B model for mobile/edge devices",
            5e12,           // 0.000005 per token (very cheap)
            4,              // 4GB VRAM minimum
            8,              // 8GB recommended
            128000,         // 128K context
            false,          // No vision
            true,           // Tools support
            true,           // JSON mode
            _toArray("meta", "llama", "3b", "edge", "mobile")
        );
        
        // Llama 3.2 90B Vision
        _registerModel(
            "meta-llama/Llama-3.2-90B-Vision-Instruct",
            "Llama 3.2 90B Vision",
            "Multimodal vision model with 90B parameters",
            5e13,           // 0.00005 per token
            80,             // 80GB VRAM minimum
            160,            // 160GB recommended
            128000,         // 128K context
            true,           // Vision support
            true,           // Tools support
            true,           // JSON mode
            _toArray("meta", "llama", "90b", "vision", "multimodal", "large")
        );
        
        // Mistral Large 2
        _registerModel(
            "mistralai/Mistral-Large-Instruct-2407",
            "Mistral Large 2",
            "Mistral's flagship model with advanced reasoning and multilingual support",
            4e13,           // 0.00004 per token
            64,             // 64GB VRAM minimum
            128,            // 128GB recommended
            128000,         // 128K context
            false,          // No vision
            true,           // Tools support
            true,           // JSON mode
            _toArray("mistral", "large", "multilingual", "reasoning")
        );
        
        // Mixtral 8x22B
        _registerModel(
            "mistralai/Mixtral-8x22B-Instruct-v0.1",
            "Mixtral 8x22B",
            "Sparse MoE model with 8 experts, 141B total parameters",
            35e12,          // 0.000035 per token
            48,             // 48GB VRAM minimum
            96,             // 96GB recommended
            64000,          // 64K context
            false,          // No vision
            true,           // Tools support
            true,           // JSON mode
            _toArray("mistral", "mixtral", "moe", "141b")
        );
        
        // Qwen 2.5 72B
        _registerModel(
            "Qwen/Qwen2.5-72B-Instruct",
            "Qwen 2.5 72B",
            "Alibaba's powerful multilingual model with 72B parameters",
            28e12,          // 0.000028 per token
            40,             // 40GB VRAM minimum
            80,             // 80GB recommended
            128000,         // 128K context
            false,          // No vision
            true,           // Tools support
            true,           // JSON mode
            _toArray("qwen", "alibaba", "72b", "multilingual", "asian-languages")
        );
        
        // Gemma 2 27B
        _registerModel(
            "google/gemma-2-27b-it",
            "Gemma 2 27B",
            "Google's efficient open model with advanced reasoning",
            18e12,          // 0.000018 per token
            20,             // 20GB VRAM minimum
            40,             // 40GB recommended
            8192,           // 8K context
            false,          // No vision
            true,           // Tools support
            true,           // JSON mode
            _toArray("google", "gemma", "27b", "efficient")
        );
    }

    function _registerModel(
        string memory modelId,
        string memory name,
        string memory description,
        uint256 pricePerToken,
        uint256 minVramGB,
        uint256 maxVramGB,
        uint256 contextLength,
        bool supportsVision,
        bool supportsTools,
        bool supportsJson,
        string[] memory tags
    ) internal {
        require(bytes(modelId).length > 0, "ModelRegistry: empty model ID");
        require(!isModelRegistered[modelId], "ModelRegistry: model already registered");
        require(pricePerToken >= minPricePerToken && pricePerToken <= maxPricePerToken, 
            "ModelRegistry: price out of bounds");
        require(minVramGB > 0, "ModelRegistry: invalid VRAM requirement");
        
        models[modelId] = Model({
            modelId: modelId,
            name: name,
            description: description,
            pricePerToken: pricePerToken,
            minVramGB: minVramGB,
            maxVramGB: maxVramGB,
            contextLength: contextLength,
            supportsVision: supportsVision,
            supportsTools: supportsTools,
            supportsJson: supportsJson,
            status: ModelStatus.Active,
            addedAt: block.timestamp,
            updatedAt: block.timestamp,
            tags: tags
        });
        
        isModelRegistered[modelId] = true;
        modelList.push(modelId);
        
        emit ModelRegistered(modelId, name, pricePerToken, minVramGB, maxVramGB);
    }

    // ============ External Model Management ============
    function registerModel(
        string calldata modelId,
        string calldata name,
        string calldata description,
        uint256 pricePerToken,
        uint256 minVramGB,
        uint256 maxVramGB,
        uint256 contextLength,
        bool supportsVision,
        bool supportsTools,
        bool supportsJson,
        string[] calldata tags
    ) external onlyRole(DAO_ROLE) {
        _registerModel(
            modelId, name, description, pricePerToken, minVramGB, maxVramGB,
            contextLength, supportsVision, supportsTools, supportsJson, tags
        );
    }

    function updateModelPrice(
        string calldata modelId, 
        uint256 newPrice
    ) external onlyRole(OPERATOR_ROLE) validModel(modelId) {
        require(newPrice >= minPricePerToken && newPrice <= maxPricePerToken, 
            "ModelRegistry: price out of bounds");
        
        Model storage model = models[modelId];
        uint256 oldPrice = model.pricePerToken;
        model.pricePerToken = newPrice;
        model.updatedAt = block.timestamp;
        
        emit PriceUpdated(modelId, oldPrice, newPrice);
        emit ModelUpdated(modelId, "price", oldPrice, newPrice);
    }

    function updateModelStatus(
        string calldata modelId,
        ModelStatus newStatus
    ) external onlyRole(OPERATOR_ROLE) validModel(modelId) {
        Model storage model = models[modelId];
        ModelStatus oldStatus = model.status;
        model.status = newStatus;
        model.updatedAt = block.timestamp;
        
        emit ModelStatusChanged(modelId, oldStatus, newStatus);
    }

    function deprecateModel(
        string calldata modelId,
        string calldata reason
    ) external onlyRole(DAO_ROLE) validModel(modelId) {
        Model storage model = models[modelId];
        model.status = ModelStatus.Deprecated;
        model.updatedAt = block.timestamp;
        
        emit ModelDeprecated(modelId, reason);
        emit ModelStatusChanged(modelId, ModelStatus.Active, ModelStatus.Deprecated);
    }

    function updateModelVram(
        string calldata modelId,
        uint256 minVramGB,
        uint256 maxVramGB
    ) external onlyRole(OPERATOR_ROLE) validModel(modelId) {
        require(minVramGB > 0, "ModelRegistry: invalid VRAM");
        
        Model storage model = models[modelId];
        model.minVramGB = minVramGB;
        model.maxVramGB = maxVramGB;
        model.updatedAt = block.timestamp;
        
        emit ModelUpdated(modelId, "minVram", 0, minVramGB);
        emit ModelUpdated(modelId, "maxVram", 0, maxVramGB);
    }

    function updateModelFeatures(
        string calldata modelId,
        bool supportsVision,
        bool supportsTools,
        bool supportsJson
    ) external onlyRole(OPERATOR_ROLE) validModel(modelId) {
        Model storage model = models[modelId];
        model.supportsVision = supportsVision;
        model.supportsTools = supportsTools;
        model.supportsJson = supportsJson;
        model.updatedAt = block.timestamp;
        
        emit ModelUpdated(modelId, "features", 0, 0);
    }

    // ============ Pricing Management ============
    function calculatePrice(
        string calldata modelId,
        uint256 tokenCount,
        address user
    ) external view activeModel(modelId) returns (uint256 totalPrice, uint256 platformFee) {
        Model storage model = models[modelId];
        uint8 tier = userPricingTier[user];
        PricingTier memory pricing = pricingTiers[tier];
        
        // Apply tier discount to base price
        uint256 discountedPrice = (model.pricePerToken * (100 - pricing.discountPercent)) / 100;
        uint256 baseCost = tokenCount * discountedPrice;
        
        // Add platform fee
        platformFee = (baseCost * platformFeePercent) / BASIS_POINTS;
        totalPrice = baseCost + platformFee;
        
        return (totalPrice, platformFee);
    }

    function setPricingTier(
        uint8 tier,
        uint256 basePrice,
        uint256 discountPercent,
        uint256 minStakeRequired
    ) external onlyRole(DAO_ROLE) {
        require(discountPercent <= 50, "ModelRegistry: max 50% discount");
        
        pricingTiers[tier] = PricingTier({
            basePrice: basePrice,
            discountPercent: discountPercent,
            minStakeRequired: minStakeRequired
        });
        
        emit PricingTierSet(tier, basePrice, discountPercent);
    }

    function setUserPricingTier(address user, uint8 tier) external onlyRole(DAO_ROLE) {
        userPricingTier[user] = tier;
        emit UserPricingTierSet(user, tier);
    }

    function setPlatformFee(uint256 newFeePercent) external onlyRole(DAO_ROLE) {
        require(newFeePercent <= 2000, "ModelRegistry: max 20% fee");
        uint256 oldFee = platformFeePercent;
        platformFeePercent = newFeePercent;
        emit PlatformFeeUpdated(oldFee, newFeePercent);
    }

    function setMinMaxPrice(uint256 minPrice, uint256 maxPrice) external onlyRole(DAO_ROLE) {
        require(minPrice < maxPrice, "ModelRegistry: invalid range");
        minPricePerToken = minPrice;
        maxPricePerToken = maxPrice;
        emit MinMaxPriceUpdated(minPrice, maxPrice);
    }

    // ============ Validation Functions ============
    function isModelAvailable(string calldata modelId) external view returns (bool) {
        if (!isModelRegistered[modelId]) return false;
        return models[modelId].status == ModelStatus.Active;
    }

    function canNodeRunModel(
        string calldata modelId,
        uint256 availableVramGB
    ) external view validModel(modelId) returns (bool) {
        return availableVramGB >= models[modelId].minVramGB;
    }

    function validateRequest(
        string calldata modelId,
        uint256 requestedTokens,
        bool requiresVision,
        bool requiresTools,
        bool requiresJson
    ) external view validModel(modelId) returns (bool isValid, string memory errorMessage) {
        Model storage model = models[modelId];
        
        if (model.status != ModelStatus.Active) {
            return (false, "Model not active");
        }
        
        if (requestedTokens > model.contextLength) {
            return (false, "Requested tokens exceed context length");
        }
        
        if (requiresVision && !model.supportsVision) {
            return (false, "Model does not support vision");
        }
        
        if (requiresTools && !model.supportsTools) {
            return (false, "Model does not support tools");
        }
        
        if (requiresJson && !model.supportsJson) {
            return (false, "Model does not support JSON mode");
        }
        
        return (true, "");
    }

    // ============ Batch Operations ============
    function getModelsByVram(uint256 maxVramGB) external view returns (string[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < modelList.length; i++) {
            if (models[modelList[i]].minVramGB <= maxVramGB && 
                models[modelList[i]].status == ModelStatus.Active) {
                count++;
            }
        }
        
        string[] memory result = new string[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < modelList.length; i++) {
            if (models[modelList[i]].minVramGB <= maxVramGB && 
                models[modelList[i]].status == ModelStatus.Active) {
                result[index] = modelList[i];
                index++;
            }
        }
        return result;
    }

    function getModelsByFeature(
        bool requireVision,
        bool requireTools,
        bool requireJson
    ) external view returns (string[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < modelList.length; i++) {
            Model storage model = models[modelList[i]];
            if (model.status != ModelStatus.Active) continue;
            
            if (requireVision && !model.supportsVision) continue;
            if (requireTools && !model.supportsTools) continue;
            if (requireJson && !model.supportsJson) continue;
            
            count++;
        }
        
        string[] memory result = new string[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < modelList.length; i++) {
            Model storage model = models[modelList[i]];
            if (model.status != ModelStatus.Active) continue;
            
            if (requireVision && !model.supportsVision) continue;
            if (requireTools && !model.supportsTools) continue;
            if (requireJson && !model.supportsJson) continue;
            
            result[index] = modelList[i];
            index++;
        }
        return result;
    }

    // ============ View Functions ============
    function getModel(string calldata modelId) external view returns (Model memory) {
        require(isModelRegistered[modelId], "ModelRegistry: model not found");
        return models[modelId];
    }

    function getAllModels() external view returns (string[] memory) {
        return modelList;
    }

    function getActiveModels() external view returns (string[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < modelList.length; i++) {
            if (models[modelList[i]].status == ModelStatus.Active) {
                count++;
            }
        }
        
        string[] memory result = new string[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < modelList.length; i++) {
            if (models[modelList[i]].status == ModelStatus.Active) {
                result[index] = modelList[i];
                index++;
            }
        }
        return result;
    }

    function getModelCount() external view returns (uint256) {
        return modelList.length;
    }

    function getActiveModelCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < modelList.length; i++) {
            if (models[modelList[i]].status == ModelStatus.Active) {
                count++;
            }
        }
        return count;
    }

    function getPriceEstimate(
        string calldata modelId,
        uint256 inputTokens,
        uint256 outputTokens
    ) external view activeModel(modelId) returns (uint256 totalPrice) {
        Model storage model = models[modelId];
        uint256 totalTokens = inputTokens + outputTokens;
        uint256 baseCost = totalTokens * model.pricePerToken;
        uint256 platformFee = (baseCost * platformFeePercent) / BASIS_POINTS;
        return baseCost + platformFee;
    }

    // ============ Utility Functions ============
    function _toArray(string memory a) internal pure returns (string[] memory) {
        string[] memory arr = new string[](1);
        arr[0] = a;
        return arr;
    }

    function _toArray(string memory a, string memory b) internal pure returns (string[] memory) {
        string[] memory arr = new string[](2);
        arr[0] = a;
        arr[1] = b;
        return arr;
    }

    function _toArray(string memory a, string memory b, string memory c) internal pure returns (string[] memory) {
        string[] memory arr = new string[](3);
        arr[0] = a;
        arr[1] = b;
        arr[2] = c;
        return arr;
    }

    function _toArray(string memory a, string memory b, string memory c, string memory d) 
        internal pure returns (string[] memory) {
        string[] memory arr = new string[](4);
        arr[0] = a;
        arr[1] = b;
        arr[2] = c;
        arr[3] = d;
        return arr;
    }
}

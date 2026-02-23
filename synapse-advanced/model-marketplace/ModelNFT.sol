// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ModelNFT
 * @dev ERC721 representing AI models with royalty distribution
 */
contract ModelNFT is ERC721, ERC721Enumerable, ReentrancyGuard, AccessControl {
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    struct ModelMetadata {
        string name;
        string description;
        string version;
        string[] tags;
        bytes32 modelHash;
        bytes32 configHash;
        uint256 fileSize;
        string modelType;
        string framework;
        address creator;
        uint256 creationTime;
        uint256 basePrice;
        bool isVerified;
        uint256 verificationTime;
        string license;
        string documentationURI;
    }
    
    struct RoyaltyInfo {
        uint256 royaltyBasisPoints;
        address[] beneficiaries;
        uint256[] shares;
    }
    
    struct ModelStats {
        uint256 totalDownloads;
        uint256 totalUsage;
        uint256 totalRevenue;
        uint256 rating;
        uint256 ratingCount;
    }
    
    // Token ID => Metadata
    mapping(uint256 => ModelMetadata) public modelMetadata;
    mapping(uint256 => RoyaltyInfo) public modelRoyalties;
    mapping(uint256 => ModelStats) public modelStats;
    mapping(uint256 => mapping(address => bool)) public hasRated;
    mapping(bytes32 => bool) public usedModelHashes;
    mapping(bytes32 => uint256) public hashToTokenId;
    
    uint256 public constant MAX_ROYALTY = 1500; // 15%
    uint256 public constant BASIS_POINTS = 10000;
    
    uint256 private _tokenIdCounter;
    
    // Events
    event ModelMinted(
        uint256 indexed tokenId,
        address indexed creator,
        bytes32 modelHash,
        string name
    );
    
    event ModelVerified(uint256 indexed tokenId, address indexed verifier);
    event ModelPurchased(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event ModelRated(uint256 indexed tokenId, address indexed rater, uint8 rating);
    event RoyaltyDistributed(uint256 indexed tokenId, uint256 amount);
    
    constructor() ERC721("Synapse Model", "SYNMODEL") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }
    
    /**
     * @dev Mint a new model NFT
     */
    function mintModel(
        string calldata _name,
        string calldata _description,
        string calldata _version,
        string[] calldata _tags,
        bytes32 _modelHash,
        bytes32 _configHash,
        uint256 _fileSize,
        string calldata _modelType,
        string calldata _framework,
        uint256 _basePrice,
        string calldata _license,
        string calldata _documentationURI,
        address[] calldata _royaltyBeneficiaries,
        uint256[] calldata _royaltyShares,
        uint256 _royaltyBasisPoints
    ) external returns (uint256) {
        require(bytes(_name).length > 0, "Name required");
        require(_modelHash != bytes32(0), "Model hash required");
        require(!usedModelHashes[_modelHash], "Model already exists");
        require(_royaltyBasisPoints <= MAX_ROYALTY, "Royalty too high");
        require(
            _royaltyBeneficiaries.length == _royaltyShares.length,
            "Beneficiaries and shares mismatch"
        );
        
        uint256 tokenId = _tokenIdCounter++;
        
        modelMetadata[tokenId] = ModelMetadata({
            name: _name,
            description: _description,
            version: _version,
            tags: _tags,
            modelHash: _modelHash,
            configHash: _configHash,
            fileSize: _fileSize,
            modelType: _modelType,
            framework: _framework,
            creator: msg.sender,
            creationTime: block.timestamp,
            basePrice: _basePrice,
            isVerified: false,
            verificationTime: 0,
            license: _license,
            documentationURI: _documentationURI
        });
        
        modelRoyalties[tokenId] = RoyaltyInfo({
            royaltyBasisPoints: _royaltyBasisPoints,
            beneficiaries: _royaltyBeneficiaries,
            shares: _royaltyShares
        });
        
        usedModelHashes[_modelHash] = true;
        hashToTokenId[_modelHash] = tokenId;
        
        _safeMint(msg.sender, tokenId);
        
        emit ModelMinted(tokenId, msg.sender, _modelHash, _name);
        
        return tokenId;
    }
    
    /**
     * @dev Verify a model (verifier only)
     */
    function verifyModel(uint256 _tokenId) external onlyRole(VERIFIER_ROLE) {
        require(_exists(_tokenId), "Model does not exist");
        
        ModelMetadata storage metadata = modelMetadata[_tokenId];
        metadata.isVerified = true;
        metadata.verificationTime = block.timestamp;
        
        emit ModelVerified(_tokenId, msg.sender);
    }
    
    /**
     * @dev Update model metadata (creator only)
     */
    function updateMetadata(
        uint256 _tokenId,
        string calldata _description,
        uint256 _basePrice,
        string calldata _documentationURI
    ) external {
        require(ownerOf(_tokenId) == msg.sender, "Not owner");
        
        ModelMetadata storage metadata = modelMetadata[_tokenId];
        metadata.description = _description;
        metadata.basePrice = _basePrice;
        metadata.documentationURI = _documentationURI;
    }
    
    /**
     * @dev Record model purchase
     */
    function recordPurchase(uint256 _tokenId, uint256 _price) external {
        require(_exists(_tokenId), "Model does not exist");
        
        ModelStats storage stats = modelStats[_tokenId];
        stats.totalDownloads++;
        stats.totalRevenue += _price;
        
        emit ModelPurchased(_tokenId, msg.sender, _price);
    }
    
    /**
     * @dev Record model usage
     */
    function recordUsage(uint256 _tokenId, uint256 _revenue) external {
        require(_exists(_tokenId), "Model does not exist");
        
        ModelStats storage stats = modelStats[_tokenId];
        stats.totalUsage++;
        stats.totalRevenue += _revenue;
    }
    
    /**
     * @dev Rate a model (1-5)
     */
    function rateModel(uint256 _tokenId, uint8 _rating) external {
        require(_exists(_tokenId), "Model does not exist");
        require(_rating >= 1 && _rating <= 5, "Rating 1-5");
        require(!hasRated[_tokenId][msg.sender], "Already rated");
        
        ModelStats storage stats = modelStats[_tokenId];
        
        // Update average rating
        uint256 newRating = ((stats.rating * stats.ratingCount) + _rating) / (stats.ratingCount + 1);
        stats.rating = newRating;
        stats.ratingCount++;
        
        hasRated[_tokenId][msg.sender] = true;
        
        emit ModelRated(_tokenId, msg.sender, _rating);
    }
    
    /**
     * @dev Distribute royalties
     */
    function distributeRoyalties(uint256 _tokenId) external payable nonReentrant {
        require(_exists(_tokenId), "Model does not exist");
        require(msg.value > 0, "No royalties to distribute");
        
        RoyaltyInfo memory royalty = modelRoyalties[_tokenId];
        uint256 totalShares = 0;
        
        for (uint i = 0; i < royalty.shares.length; i++) {
            totalShares += royalty.shares[i];
        }
        
        require(totalShares > 0, "No shares defined");
        
        for (uint i = 0; i < royalty.beneficiaries.length; i++) {
            uint256 share = (msg.value * royalty.shares[i]) / totalShares;
            payable(royalty.beneficiaries[i]).transfer(share);
        }
        
        emit RoyaltyDistributed(_tokenId, msg.value);
    }
    
    /**
     * @dev Get models by tag
     */
    function getModelsByTag(string calldata _tag) external view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](totalSupply());
        uint256 count = 0;
        
        for (uint256 i = 0; i < totalSupply(); i++) {
            uint256 tokenId = tokenByIndex(i);
            string[] memory tags = modelMetadata[tokenId].tags;
            
            for (uint j = 0; j < tags.length; j++) {
                if (keccak256(bytes(tags[j])) == keccak256(bytes(_tag))) {
                    result[count] = tokenId;
                    count++;
                    break;
                }
            }
        }
        
        // Resize
        uint256[] memory resized = new uint256[](count);
        for (uint i = 0; i < count; i++) {
            resized[i] = result[i];
        }
        
        return resized;
    }
    
    /**
     * @dev Get top rated models
     */
    function getTopModels(uint256 _count) external view returns (uint256[] memory) {
        uint256 limit = _count > totalSupply() ? totalSupply() : _count;
        
        // Simple bubble sort by rating
        uint256[] memory topModels = new uint256[](totalSupply());
        for (uint256 i = 0; i < totalSupply(); i++) {
            topModels[i] = tokenByIndex(i);
        }
        
        for (uint256 i = 0; i < topModels.length; i++) {
            for (uint256 j = i + 1; j < topModels.length; j++) {
                if (modelStats[topModels[j]].rating > modelStats[topModels[i]].rating) {
                    uint256 temp = topModels[i];
                    topModels[i] = topModels[j];
                    topModels[j] = temp;
                }
            }
        }
        
        uint256[] memory result = new uint256[](limit);
        for (uint i = 0; i < limit; i++) {
            result[i] = topModels[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get verified models only
     */
    function getVerifiedModels() external view returns (uint256[] memory) {
        uint256[] memory verified = new uint256[](totalSupply());
        uint256 count = 0;
        
        for (uint256 i = 0; i < totalSupply(); i++) {
            uint256 tokenId = tokenByIndex(i);
            if (modelMetadata[tokenId].isVerified) {
                verified[count] = tokenId;
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint i = 0; i < count; i++) {
            result[i] = verified[i];
        }
        
        return result;
    }
    
    /**
     * @dev View functions
     */
    function getModelMetadata(uint256 _tokenId) external view returns (ModelMetadata memory) {
        return modelMetadata[_tokenId];
    }
    
    function getModelStats(uint256 _tokenId) external view returns (ModelStats memory) {
        return modelStats[_tokenId];
    }
    
    function getModelRoyalties(uint256 _tokenId) external view returns (RoyaltyInfo memory) {
        return modelRoyalties[_tokenId];
    }
    
    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(_exists(_tokenId), "Token does not exist");
        return modelMetadata[_tokenId].documentationURI;
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}

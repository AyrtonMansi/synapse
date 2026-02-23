// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ModelNFT.sol";

/**
 * @title ModelRegistry
 * @dev Registry for model uploads, versioning, and discovery
 */
contract ModelRegistry is ReentrancyGuard, AccessControl {
    
    bytes32 public constant UPLOADER_ROLE = keccak256("UPLOADER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    ModelNFT public modelNFT;
    
    struct ModelVersion {
        uint256 versionId;
        uint256 parentModelId;
        string version;
        bytes32 modelHash;
        string changelog;
        uint256 createdAt;
        bool isLatest;
    }
    
    struct ModelBundle {
        bytes32 bundleId;
        string name;
        string description;
        uint256[] modelIds;
        address creator;
        uint256 price;
        uint256 createdAt;
    }
    
    mapping(uint256 => ModelVersion[]) public modelVersions;
    mapping(bytes32 => ModelBundle) public modelBundles;
    mapping(uint256 => bytes32[]) public modelToBundles;
    mapping(string => uint256[]) public tagIndex;
    mapping(string => uint256[]) public typeIndex;
    mapping(address => uint256[]) public creatorIndex;
    mapping(bytes32 => bool) public usedHashes;
    
    bytes32[] public bundleList;
    string[] public allTags;
    string[] public allTypes;
    
    uint256 public uploadFee = 0.01 ether;
    
    event VersionRegistered(uint256 indexed modelId, uint256 indexed versionId, string version);
    event BundleCreated(bytes32 indexed bundleId, string name, uint256[] modelIds);
    
    constructor(address _modelNFT) {
        modelNFT = ModelNFT(_modelNFT);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    function registerVersion(
        uint256 _parentModelId,
        string calldata _version,
        bytes32 _modelHash,
        string calldata _changelog
    ) external payable nonReentrant returns (uint256 versionId) {
        require(msg.value >= uploadFee, "Insufficient fee");
        require(modelNFT.ownerOf(_parentModelId) == msg.sender, "Not model owner");
        require(!usedHashes[_modelHash], "Hash already used");
        
        ModelVersion[] storage versions = modelVersions[_parentModelId];
        if (versions.length > 0) {
            versions[versions.length - 1].isLatest = false;
        }
        
        versionId = versions.length;
        
        versions.push(ModelVersion({
            versionId: versionId,
            parentModelId: _parentModelId,
            version: _version,
            modelHash: _modelHash,
            changelog: _changelog,
            createdAt: block.timestamp,
            isLatest: true
        }));
        
        usedHashes[_modelHash] = true;
        emit VersionRegistered(_parentModelId, versionId, _version);
        return versionId;
    }
    
    function createBundle(
        string calldata _name,
        string calldata _description,
        uint256[] calldata _modelIds,
        uint256 _price
    ) external returns (bytes32 bundleId) {
        require(_modelIds.length >= 2, "Need at least 2 models");
        
        for (uint i = 0; i < _modelIds.length; i++) {
            require(modelNFT.ownerOf(_modelIds[i]) == msg.sender, "Not owner of all models");
        }
        
        bundleId = keccak256(abi.encodePacked(msg.sender, _name, block.timestamp));
        
        modelBundles[bundleId] = ModelBundle({
            bundleId: bundleId,
            name: _name,
            description: _description,
            modelIds: _modelIds,
            creator: msg.sender,
            price: _price,
            createdAt: block.timestamp
        });
        
        bundleList.push(bundleId);
        emit BundleCreated(bundleId, _name, _modelIds);
        return bundleId;
    }
    
    function indexModel(
        uint256 _modelId,
        string[] calldata _tags,
        string calldata _modelType
    ) external onlyRole(UPLOADER_ROLE) {
        for (uint i = 0; i < _tags.length; i++) {
            tagIndex[_tags[i]].push(_modelId);
        }
        typeIndex[_modelType].push(_modelId);
        
        ModelNFT.ModelMetadata memory metadata = modelNFT.getModelMetadata(_modelId);
        creatorIndex[metadata.creator].push(_modelId);
    }
    
    function getModelVersions(uint256 _modelId) external view returns (ModelVersion[] memory) {
        return modelVersions[_modelId];
    }
    
    function getBundle(bytes32 _bundleId) external view returns (ModelBundle memory) {
        return modelBundles[_bundleId];
    }
}

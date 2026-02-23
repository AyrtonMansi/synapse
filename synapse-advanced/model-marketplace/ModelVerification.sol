// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ModelNFT.sol";

/**
 * @title ModelVerification
 * @dev Verification system for AI models ensuring quality and safety
 */
contract ModelVerification is ReentrancyGuard, AccessControl {
    
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    ModelNFT public modelNFT;
    
    enum VerificationStatus { PENDING, IN_PROGRESS, APPROVED, REJECTED }
    
    struct VerificationRequest {
        bytes32 requestId;
        uint256 modelId;
        address requester;
        uint256 submittedAt;
        VerificationStatus status;
        bytes32 testResultsHash;
        string testReportURI;
        uint256 securityScore;
        uint256 performanceScore;
        uint256 accuracyScore;
        string verifierNotes;
        uint256 verifiedAt;
        address assignedVerifier;
    }
    
    struct VerificationCriteria {
        uint256 minSecurityScore;
        uint256 minPerformanceScore;
        uint256 minAccuracyScore;
        bool requiresAudit;
        uint256 verificationFee;
        uint256 verificationTimeout;
    }
    
    struct VerifierProfile {
        address verifier;
        string name;
        string credentials;
        uint256 totalVerifications;
        uint256 approvalRate;
        bool active;
        uint256 reputation;
    }
    
    // State
    mapping(bytes32 => VerificationRequest) public verificationRequests;
    mapping(uint256 => bytes32) public modelToRequest;
    mapping(address => VerifierProfile) public verifiers;
    mapping(string => VerificationCriteria) public criteriaByModelType;
    mapping(uint256 => mapping(string => bool)) public modelPassesCheck;
    
    bytes32[] public pendingRequests;
    address[] public verifierList;
    
    uint256 public totalVerifications;
    uint256 public verificationFee = 0.05 ether;
    uint256 public verifierReward = 0.03 ether;
    
    // Events
    event VerificationRequested(bytes32 indexed requestId, uint256 indexed modelId, address requester);
    event VerificationAssigned(bytes32 indexed requestId, address indexed verifier);
    event VerificationCompleted(bytes32 indexed requestId, VerificationStatus status, uint256 totalScore);
    event VerifierRegistered(address indexed verifier, string name);
    event ChecklistItemVerified(uint256 indexed modelId, string checkName, bool passed);
    
    constructor(address _modelNFT) {
        modelNFT = ModelNFT(_modelNFT);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        
        // Initialize default criteria
        _initializeCriteria();
    }
    
    function _initializeCriteria() internal {
        criteriaByModelType["llm"] = VerificationCriteria({
            minSecurityScore: 70,
            minPerformanceScore: 60,
            minAccuracyScore: 75,
            requiresAudit: true,
            verificationFee: 0.1 ether,
            verificationTimeout: 7 days
        });
        
        criteriaByModelType["vision"] = VerificationCriteria({
            minSecurityScore: 70,
            minPerformanceScore: 65,
            minAccuracyScore: 80,
            requiresAudit: true,
            verificationFee: 0.08 ether,
            verificationTimeout: 5 days
        });
        
        criteriaByModelType["classification"] = VerificationCriteria({
            minSecurityScore: 60,
            minPerformanceScore: 60,
            minAccuracyScore: 85,
            requiresAudit: false,
            verificationFee: 0.05 ether,
            verificationTimeout: 3 days
        });
    }
    
    /**
     * @dev Request verification for a model
     */
    function requestVerification(uint256 _modelId) external payable nonReentrant returns (bytes32 requestId) {
        require(modelNFT.ownerOf(_modelId) == msg.sender, "Not model owner");
        require(modelToRequest[_modelId] == bytes32(0), "Verification already requested");
        
        ModelNFT.ModelMetadata memory metadata = modelNFT.getModelMetadata(_modelId);
        VerificationCriteria memory criteria = criteriaByModelType[metadata.modelType];
        
        require(msg.value >= criteria.verificationFee, "Insufficient fee");
        
        requestId = keccak256(abi.encodePacked(_modelId, msg.sender, block.timestamp));
        
        verificationRequests[requestId] = VerificationRequest({
            requestId: requestId,
            modelId: _modelId,
            requester: msg.sender,
            submittedAt: block.timestamp,
            status: VerificationStatus.PENDING,
            testResultsHash: bytes32(0),
            testReportURI: "",
            securityScore: 0,
            performanceScore: 0,
            accuracyScore: 0,
            verifierNotes: "",
            verifiedAt: 0,
            assignedVerifier: address(0)
        });
        
        modelToRequest[_modelId] = requestId;
        pendingRequests.push(requestId);
        
        emit VerificationRequested(requestId, _modelId, msg.sender);
        
        return requestId;
    }
    
    /**
     * @dev Assign verifier to a request
     */
    function assignVerifier(bytes32 _requestId) external onlyRole(VERIFIER_ROLE) {
        VerificationRequest storage request = verificationRequests[_requestId];
        require(request.status == VerificationStatus.PENDING, "Not pending");
        require(verifiers[msg.sender].active, "Not an active verifier");
        
        request.assignedVerifier = msg.sender;
        request.status = VerificationStatus.IN_PROGRESS;
        
        _removePendingRequest(_requestId);
        
        emit VerificationAssigned(_requestId, msg.sender);
    }
    
    /**
     * @dev Submit verification results
     */
    function submitVerification(
        bytes32 _requestId,
        bytes32 _testResultsHash,
        string calldata _testReportURI,
        uint256 _securityScore,
        uint256 _performanceScore,
        uint256 _accuracyScore,
        string calldata _verifierNotes
    ) external onlyRole(VERIFIER_ROLE) nonReentrant {
        VerificationRequest storage request = verificationRequests[_requestId];
        require(request.assignedVerifier == msg.sender, "Not assigned verifier");
        require(request.status == VerificationStatus.IN_PROGRESS, "Not in progress");
        
        request.testResultsHash = _testResultsHash;
        request.testReportURI = _testReportURI;
        request.securityScore = _securityScore;
        request.performanceScore = _performanceScore;
        request.accuracyScore = _accuracyScore;
        request.verifierNotes = _verifierNotes;
        request.verifiedAt = block.timestamp;
        
        ModelNFT.ModelMetadata memory metadata = modelNFT.getModelMetadata(request.modelId);
        VerificationCriteria memory criteria = criteriaByModelType[metadata.modelType];
        
        // Determine pass/fail
        uint256 totalScore = (_securityScore + _performanceScore + _accuracyScore) / 3;
        
        if (_securityScore >= criteria.minSecurityScore &&
            _performanceScore >= criteria.minPerformanceScore &&
            _accuracyScore >= criteria.minAccuracyScore) {
            request.status = VerificationStatus.APPROVED;
            modelNFT.verifyModel(request.modelId);
        } else {
            request.status = VerificationStatus.REJECTED;
        }
        
        // Update verifier stats
        verifiers[msg.sender].totalVerifications++;
        
        // Pay verifier
        payable(msg.sender).transfer(verifierReward);
        
        totalVerifications++;
        
        emit VerificationCompleted(_requestId, request.status, totalScore);
    }
    
    /**
     * @dev Register as a verifier
     */
    function registerVerifier(
        string calldata _name,
        string calldata _credentials
    ) external {
        require(!verifiers[msg.sender].active, "Already registered");
        
        verifiers[msg.sender] = VerifierProfile({
            verifier: msg.sender,
            name: _name,
            credentials: _credentials,
            totalVerifications: 0,
            approvalRate: 0,
            active: true,
            reputation: 100
        });
        
        verifierList.push(msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        
        emit VerifierRegistered(msg.sender, _name);
    }
    
    /**
     * @dev Verify checklist item
     */
    function verifyChecklistItem(
        uint256 _modelId,
        string calldata _checkName,
        bool _passed
    ) external onlyRole(VERIFIER_ROLE) {
        modelPassesCheck[_modelId][_checkName] = _passed;
        emit ChecklistItemVerified(_modelId, _checkName, _passed);
    }
    
    /**
     * @dev Get verification status
     */
    function getVerificationStatus(uint256 _modelId) external view returns (VerificationStatus) {
        bytes32 requestId = modelToRequest[_modelId];
        if (requestId == bytes32(0)) {
            return VerificationStatus.PENDING;
        }
        return verificationRequests[requestId].status;
    }
    
    /**
     * @dev Get verification details
     */
    function getVerificationDetails(bytes32 _requestId) 
        external 
        view 
        returns (VerificationRequest memory) 
    {
        return verificationRequests[_requestId];
    }
    
    /**
     * @dev Get pending requests
     */
    function getPendingRequests() external view returns (bytes32[] memory) {
        return pendingRequests;
    }
    
    /**
     * @dev Admin functions
     */
    function updateCriteria(
        string calldata _modelType,
        VerificationCriteria calldata _criteria
    ) external onlyRole(ADMIN_ROLE) {
        criteriaByModelType[_modelType] = _criteria;
    }
    
    function updateFees(uint256 _verificationFee, uint256 _verifierReward) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        verificationFee = _verificationFee;
        verifierReward = _verifierReward;
    }
    
    function deactivateVerifier(address _verifier) external onlyRole(ADMIN_ROLE) {
        verifiers[_verifier].active = false;
        _revokeRole(VERIFIER_ROLE, _verifier);
    }
    
    function withdrawFees() external onlyRole(ADMIN_ROLE) {
        payable(msg.sender).transfer(address(this).balance);
    }
    
    function _removePendingRequest(bytes32 _requestId) internal {
        for (uint i = 0; i < pendingRequests.length; i++) {
            if (pendingRequests[i] == _requestId) {
                pendingRequests[i] = pendingRequests[pendingRequests.length - 1];
                pendingRequests.pop();
                break;
            }
        }
    }
}

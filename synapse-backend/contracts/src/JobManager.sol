// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SynapseJobManager
 * @notice Decentralized job management for compute network
 * @dev All job state is on-chain, no central database
 */
contract SynapseJobManager {
    
    enum JobStatus { Pending, Assigned, Completed, Cancelled }
    
    struct Job {
        address creator;
        address worker;
        bytes32 jobType;
        bytes32 inputHash;
        bytes32 resultHash;
        uint256 payment;
        uint256 timeout;
        uint256 createdAt;
        uint256 assignedAt;
        uint256 completedAt;
        JobStatus status;
    }
    
    // State variables
    mapping(bytes32 => Job) public jobs;
    mapping(address => bytes32[]) public creatorJobs;
    mapping(address => bytes32[]) public workerJobs;
    mapping(address => uint256) public reputation;
    
    uint256 public platformFeePercent = 25; // 2.5%
    uint256 public constant MIN_TIMEOUT = 300; // 5 minutes
    uint256 public constant MAX_TIMEOUT = 86400; // 24 hours
    
    address public owner;
    address public feeRecipient;
    
    // Events
    event JobCreated(
        bytes32 indexed jobId,
        address indexed creator,
        bytes32 jobType,
        uint256 payment,
        uint256 timeout
    );
    
    event JobAssigned(
        bytes32 indexed jobId,
        address indexed worker
    );
    
    event JobCompleted(
        bytes32 indexed jobId,
        bytes32 resultHash,
        uint256 payout
    );
    
    event JobCancelled(
        bytes32 indexed jobId
    );
    
    event PaymentReleased(
        bytes32 indexed jobId,
        address indexed recipient,
        uint256 amount
    );
    
    event PaymentDisputed(
        bytes32 indexed jobId,
        address indexed disputer,
        string reason
    );
    
    event ReputationUpdated(
        address indexed user,
        int256 delta,
        string reason
    );
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyJobCreator(bytes32 _jobId) {
        require(jobs[_jobId].creator == msg.sender, "Not job creator");
        _;
    }
    
    modifier onlyJobWorker(bytes32 _jobId) {
        require(jobs[_jobId].worker == msg.sender, "Not job worker");
        _;
    }
    
    constructor(address _feeRecipient) {
        owner = msg.sender;
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @notice Create a new job with ETH escrow
     * @param _jobId Unique job identifier
     * @param _jobType Type of computation
     * @param _inputHash IPFS hash of job input
     * @param _timeout Maximum time for completion
     */
    function createJob(
        bytes32 _jobId,
        bytes32 _jobType,
        bytes32 _inputHash,
        uint256 _timeout
    ) external payable returns (bool) {
        require(msg.value > 0, "Payment required");
        require(_timeout >= MIN_TIMEOUT && _timeout <= MAX_TIMEOUT, "Invalid timeout");
        require(jobs[_jobId].creator == address(0), "Job exists");
        
        Job storage job = jobs[_jobId];
        job.creator = msg.sender;
        job.jobType = _jobType;
        job.inputHash = _inputHash;
        job.payment = msg.value;
        job.timeout = _timeout;
        job.createdAt = block.timestamp;
        job.status = JobStatus.Pending;
        
        creatorJobs[msg.sender].push(_jobId);
        
        emit JobCreated(_jobId, msg.sender, _jobType, msg.value, _timeout);
        return true;
    }
    
    /**
     * @notice Worker accepts/assigns themselves to a job
     * @param _jobId Job to assign
     */
    function assignJob(bytes32 _jobId) external returns (bool) {
        Job storage job = jobs[_jobId];
        
        require(job.status == JobStatus.Pending, "Job not pending");
        require(job.creator != msg.sender, "Cannot assign own job");
        require(block.timestamp <= job.createdAt + job.timeout, "Job expired");
        
        job.worker = msg.sender;
        job.assignedAt = block.timestamp;
        job.status = JobStatus.Assigned;
        
        workerJobs[msg.sender].push(_jobId);
        
        emit JobAssigned(_jobId, msg.sender);
        return true;
    }
    
    /**
     * @notice Submit job result and release payment
     * @param _jobId Job identifier
     * @param _resultHash IPFS hash of result
     */
    function completeJob(
        bytes32 _jobId,
        bytes32 _resultHash
    ) external onlyJobWorker(_jobId) returns (bool) {
        Job storage job = jobs[_jobId];
        
        require(job.status == JobStatus.Assigned, "Job not assigned");
        require(_resultHash != bytes32(0), "Invalid result");
        
        job.resultHash = _resultHash;
        job.completedAt = block.timestamp;
        job.status = JobStatus.Completed;
        
        // Calculate payout
        uint256 fee = (job.payment * platformFeePercent) / 1000;
        uint256 payout = job.payment - fee;
        
        // Transfer payment to worker
        (bool success, ) = payable(job.worker).call{value: payout}("");
        require(success, "Payment failed");
        
        // Transfer fee to platform
        if (fee > 0) {
            (bool feeSuccess, ) = payable(feeRecipient).call{value: fee}("");
            require(feeSuccess, "Fee transfer failed");
        }
        
        // Update reputation
        _updateReputation(job.worker, 5, "Job completed successfully");
        
        emit JobCompleted(_jobId, _resultHash, payout);
        emit PaymentReleased(_jobId, job.worker, payout);
        
        return true;
    }
    
    /**
     * @notice Cancel a pending job and refund payment
     * @param _jobId Job to cancel
     */
    function cancelJob(bytes32 _jobId) external onlyJobCreator(_jobId) returns (bool) {
        Job storage job = jobs[_jobId];
        
        require(job.status == JobStatus.Pending, "Job not pending");
        
        job.status = JobStatus.Cancelled;
        
        // Refund creator
        (bool success, ) = payable(job.creator).call{value: job.payment}("");
        require(success, "Refund failed");
        
        emit JobCancelled(_jobId);
        return true;
    }
    
    /**
     * @notice Dispute a job completion
     * @param _jobId Job to dispute
     * @param _reason Reason for dispute
     */
    function disputeJob(
        bytes32 _jobId,
        string calldata _reason
    ) external onlyJobCreator(_jobId) {
        Job storage job = jobs[_jobId];
        
        require(job.status == JobStatus.Completed, "Job not completed");
        require(block.timestamp <= job.completedAt + 7 days, "Dispute period expired");
        
        _updateReputation(job.worker, -10, "Job disputed");
        
        emit PaymentDisputed(_jobId, msg.sender, _reason);
    }
    
    /**
     * @notice Claim expired job (if worker never completed)
     * @param _jobId Job to claim
     */
    function claimExpiredJob(bytes32 _jobId) external onlyJobCreator(_jobId) {
        Job storage job = jobs[_jobId];
        
        require(job.status == JobStatus.Assigned, "Job not assigned");
        require(block.timestamp > job.assignedAt + job.timeout, "Job not expired");
        
        job.status = JobStatus.Cancelled;
        
        // Penalize worker
        _updateReputation(job.worker, -20, "Job expired without completion");
        
        // Refund creator
        (bool success, ) = payable(job.creator).call{value: job.payment}("");
        require(success, "Refund failed");
        
        emit JobCancelled(_jobId);
    }
    
    /**
     * @notice Get job details
     * @param _jobId Job identifier
     */
    function getJob(bytes32 _jobId) external view returns (
        address creator,
        address worker,
        bytes32 jobType,
        uint256 payment,
        uint256 timeout,
        JobStatus status
    ) {
        Job storage job = jobs[_jobId];
        return (
            job.creator,
            job.worker,
            job.jobType,
            job.payment,
            job.timeout,
            job.status
        );
    }
    
    /**
     * @notice Get jobs created by address
     * @param _creator Creator address
     */
    function getJobsByCreator(address _creator) external view returns (bytes32[] memory) {
        return creatorJobs[_creator];
    }
    
    /**
     * @notice Get jobs assigned to worker
     * @param _worker Worker address
     */
    function getJobsByWorker(address _worker) external view returns (bytes32[] memory) {
        return workerJobs[_worker];
    }
    
    /**
     * @notice Update reputation score
     * @param _user User to update
     * @param _delta Score change (+/-)
     * @param _reason Reason for update
     */
    function _updateReputation(address _user, int256 _delta, string memory _reason) internal {
        int256 current = int256(reputation[_user]);
        int256 updated = current + _delta;
        
        if (updated < 0) updated = 0;
        if (updated > 1000) updated = 1000;
        
        reputation[_user] = uint256(updated);
        
        emit ReputationUpdated(_user, _delta, _reason);
    }
    
    /**
     * @notice Set platform fee
     * @param _newFee New fee in basis points (25 = 2.5%)
     */
    function setPlatformFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 100, "Fee too high"); // Max 10%
        platformFeePercent = _newFee;
    }
    
    /**
     * @notice Set fee recipient
     * @param _newRecipient New fee recipient address
     */
    function setFeeRecipient(address _newRecipient) external onlyOwner {
        feeRecipient = _newRecipient;
    }
    
    receive() external payable {
        revert("Direct payments not accepted");
    }
}
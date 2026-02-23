export const SYNAPSE_GOVERNOR_ABI = [
  // View functions
  "function state(uint256 proposalId) view returns (uint8)",
  "function proposalCount() view returns (uint256)",
  "function quorum() view returns (uint256)",
  "function proposalThreshold() view returns (uint256)",
  "function votingPeriod() view returns (uint256)",
  "function quadraticVotingEnabled() view returns (bool)",
  "function getVotes(address account) view returns (uint256)",
  "function getProposal(uint256 proposalId) view returns (uint256 id, address proposer, string title, string description, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, uint256 startTime, uint256 endTime, uint256 eta, bool executed, bool canceled, bool useQuadraticVoting, uint8 proposalType)",
  "function getReceipt(uint256 proposalId, address voter) view returns (bool hasVoted, uint8 support, uint256 votes, uint256 quadraticVotes)",
  "function delegates(address account) view returns (address delegate, uint256 delegatedAmount, uint256 delegatedAt, bool isActive)",
  "function proposalTemplates(uint256 templateId) view returns (string name, string description, uint8 proposalType, bool useQuadraticVoting, uint256 votingPeriod)",
  "function templateCount() view returns (uint256)",
  
  // Write functions
  "function propose(address[] targets, uint256[] values, bytes[] calldatas, string title, string description, uint8 proposalType, bool useQuadraticVoting) returns (uint256)",
  "function castVote(uint256 proposalId, uint8 support, string reason)",
  "function delegate(address delegatee, uint256 amount)",
  "function revokeDelegation()",
  "function queue(uint256 proposalId)",
  "function execute(uint256 proposalId) payable",
  "function cancel(uint256 proposalId)",
  
  // Events
  "event ProposalCreated(uint256 indexed id, address indexed proposer, string title, uint8 proposalType, bool useQuadraticVoting, uint256 startTime, uint256 endTime)",
  "event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 votes, uint256 quadraticVotes, string reason)",
  "event VoteDelegated(address indexed delegator, address indexed delegate, uint256 amount)",
  "event DelegationRevoked(address indexed delegator, address indexed delegate, uint256 amount)",
  "event ProposalExecuted(uint256 indexed id)",
  "event ProposalCanceled(uint256 indexed id)",
  "event ProposalQueued(uint256 indexed id, uint256 eta)",
] as const;

export const TREASURY_ANALYTICS_ABI = [
  // View functions
  "function getTreasuryValue() view returns (uint256 totalValueUSD, uint256 ethValueUSD, uint256 tokenValuesUSD, tuple(address token, string symbol, uint256 balance, uint256 price, uint256 valueUSD, uint8 decimals, bool isETH, bool isActive)[] assetList)",
  "function totalSpent() view returns (uint256)",
  "function totalBurned() view returns (uint256)",
  "function totalRevenue() view returns (uint256)",
  "function burnRate() view returns (uint256)",
  "function stakingShare() view returns (uint256)",
  "function treasuryShare() view returns (uint256)",
  "function snapshotCount() view returns (uint256)",
  "function snapshots(uint256 snapshotId) view returns (uint256 timestamp, uint256 totalValueUSD, uint256 ethBalance, uint256 tokenCount)",
  "function spendingProposalCount() view returns (uint256)",
  "function spendingProposals(uint256 proposalId) view returns (uint256 id, address token, address recipient, uint256 amount, uint256 amountUSD, string description, string category, uint256 proposedAt, uint256 executedAt, bool executed, bool approved, uint256 approvedBy)",
  "function tokenBurnCount() view returns (uint256)",
  "function tokenBurns(uint256 burnId) view returns (uint256 id, uint256 amount, uint256 priceAtBurn, uint256 valueUSD, uint256 timestamp, string reason, bytes32 txHash)",
  "function calculateRevenueShare(uint256 revenue) view returns (uint256 burnAmount, uint256 stakingAmount, uint256 treasuryAmount)",
  "function getSpendingByCategory(string category) view returns (uint256 totalUSD)",
  
  // Write functions
  "function takeSnapshot() returns (uint256)",
  "function trackAsset(address token, string symbol, uint8 decimals)",
  "function proposeSpending(address token, address recipient, uint256 amount, string description, string category) returns (uint256)",
  "function recordBurn(uint256 amount, string reason, bytes32 txHash) returns (uint256)",
  
  // Events
  "event AssetTracked(address indexed token, string symbol)",
  "event SnapshotTaken(uint256 indexed id, uint256 timestamp, uint256 totalValue)",
  "event SpendingProposed(uint256 indexed id, address indexed token, uint256 amount)",
  "event TokensBurned(uint256 indexed id, uint256 amount, uint256 valueUSD, string reason)",
  "event RevenueShareCreated(uint256 indexed id, uint256 periodStart, uint256 periodEnd)",
] as const;

export const TIMELOCK_ABI = [
  // View functions
  "function minDelay() view returns (uint256)",
  "function maxDelay() view returns (uint256)",
  "function gracePeriod() view returns (uint256)",
  "function operationCount() view returns (uint256)",
  "function operations(bytes32 id) view returns (bytes32 opId, address target, uint256 value, bytes data, uint256 eta, bool executed, bool canceled, uint256 createdAt, uint256 delay, address proposer, string description)",
  "function getOperationState(bytes32 id) view returns (bool exists, bool pending, bool ready, bool executed, bool canceled, uint256 eta, uint256 timeUntilExecution)",
  "function getRemainingDelay(bytes32 id) view returns (uint256)",
  "function getProgressToExecution(bytes32 id) view returns (uint256 percent)",
  "function isOperation(bytes32 id) view returns (bool)",
  "function isOperationPending(bytes32 id) view returns (bool)",
  "function isOperationReady(bytes32 id) view returns (bool)",
  
  // Write functions
  "function schedule(address target, uint256 value, bytes data, bytes32 predecessor, bytes32 salt, uint256 delay, string description) returns (bytes32)",
  "function execute(address target, uint256 value, bytes data, bytes32 predecessor, bytes32 salt)",
  "function cancel(bytes32 id)",
  
  // Events
  "event OperationScheduled(bytes32 indexed id, address indexed target, uint256 value, bytes data, uint256 eta, uint256 delay, address indexed proposer)",
  "event OperationExecuted(bytes32 indexed id, address indexed target, uint256 value, bytes data)",
  "event OperationCanceled(bytes32 indexed id, address indexed canceler)",
] as const;

export const GNOSIS_SAFE_MODULE_ABI = [
  // View functions
  "function governor() view returns (address)",
  "function treasury() view returns (address)",
  "function defaultThreshold() view returns (uint256)",
  "function transactionCount() view returns (uint256)",
  "function getRegisteredSafes() view returns (address[])",
  "function safeConfigs(address safe) view returns (address safeAddress, uint256 requiredConfirmations, bool isActive, uint256 delegateCount)",
  "function getSafeDelegates(address safe) view returns (address[])",
  "function getTransaction(bytes32 id) view returns (bytes32 txId, address safe, address to, uint256 value, bytes data, uint8 operation, uint256 requestedAt, uint256 executedAt, bool executed, bool canceled, address requester, string description)",
  "function getSignatureCount(bytes32 id) view returns (uint256)",
  "function isExecutable(bytes32 id) view returns (bool)",
  "function getSafeTransactions(address safe) view returns (bytes32[])",
  
  // Write functions
  "function registerSafe(address safe, uint256 threshold, address[] delegates)",
  "function updateThreshold(address safe, uint256 newThreshold)",
  "function addDelegate(address safe, address delegate)",
  "function removeDelegate(address safe, address delegate)",
  "function requestTransaction(address safe, address to, uint256 value, bytes data, uint8 operation, string description) returns (bytes32)",
  "function signTransaction(bytes32 id, bytes signature)",
  "function executeTransaction(bytes32 id) returns (bool)",
  "function cancelTransaction(bytes32 id)",
  
  // Events
  "event SafeRegistered(address indexed safe, uint256 threshold)",
  "event TransactionRequested(bytes32 indexed id, address indexed safe, address indexed to, uint256 value, address requester)",
  "event TransactionSigned(bytes32 indexed id, address indexed signer)",
  "event TransactionExecuted(bytes32 indexed id, address indexed executor)",
] as const;

// Export all ABIs as a single object
export const GOVERNANCE_ABIS = {
  SYNAPSE_GOVERNOR: SYNAPSE_GOVERNOR_ABI,
  TREASURY_ANALYTICS: TREASURY_ANALYTICS_ABI,
  TIMELOCK: TIMELOCK_ABI,
  GNOSIS_SAFE_MODULE: GNOSIS_SAFE_MODULE_ABI,
};
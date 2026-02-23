// Synapse Token ABI (ERC20)
export const SynapseTokenABI = [
  { inputs: [], stateMutability: 'nonpayable', type: 'constructor' },
  { inputs: [], name: 'InvalidShortString', type: 'error' },
  { inputs: [{ internalType: 'string', name: 'str', type: 'string' }], name: 'StringTooLong', type: 'error' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'owner', type: 'address' }, { indexed: true, internalType: 'address', name: 'spender', type: 'address' }, { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' }], name: 'Approval', type: 'event' },
  { anonymous: false, inputs: [], name: 'EIP712DomainChanged', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'from', type: 'address' }, { indexed: true, internalType: 'address', name: 'to', type: 'address' }, { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' }], name: 'Transfer', type: 'event' },
  { inputs: [], name: 'DOMAIN_SEPARATOR', outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'owner', type: 'address' }, { internalType: 'address', name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'spender', type: 'address' }, { internalType: 'uint256', name: 'value', type: 'uint256' }], name: 'approve', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'eip712Domain', outputs: [{ internalType: 'bytes1', name: 'fields', type: 'bytes1' }, { internalType: 'string', name: 'name', type: 'string' }, { internalType: 'string', name: 'version', type: 'string' }, { internalType: 'uint256', name: 'chainId', type: 'uint256' }, { internalType: 'address', name: 'verifyingContract', type: 'address' }, { internalType: 'bytes32', name: 'salt', type: 'bytes32' }, { internalType: 'uint256[]', name: 'extensions', type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'name', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'owner', type: 'address' }], name: 'nonces', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'owner', type: 'address' }, { internalType: 'address', name: 'spender', type: 'address' }, { internalType: 'uint256', name: 'value', type: 'uint256' }, { internalType: 'uint256', name: 'deadline', type: 'uint256' }, { internalType: 'uint8', name: 'v', type: 'uint8' }, { internalType: 'bytes32', name: 'r', type: 'bytes32' }, { internalType: 'bytes32', name: 's', type: 'bytes32' }], name: 'permit', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'value', type: 'uint256' }], name: 'transfer', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'from', type: 'address' }, { internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'value', type: 'uint256' }], name: 'transferFrom', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
];

// Staking Contract ABI
export const SynapseStakingABI = [
  { inputs: [{ internalType: 'address', name: '_synapseToken', type: 'address' }], stateMutability: 'nonpayable', type: 'constructor' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'user', type: 'address' }, { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }], name: 'Claimed', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'user', type: 'address' }, { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }], name: 'Staked', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'user', type: 'address' }, { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }], name: 'Unstaked', type: 'event' },
  { inputs: [], name: 'claimRewards', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'address', name: '_user', type: 'address' }], name: 'getStakedBalance', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: '_user', type: 'address' }], name: 'pendingRewards', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: '_amount', type: 'uint256' }], name: 'stake', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: '_amount', type: 'uint256' }], name: 'unstake', outputs: [], stateMutability: 'nonpayable', type: 'function' },
];

// Node Registry ABI
export const SynapseRegistryABI = [
  { inputs: [{ internalType: 'address', name: '_synapseToken', type: 'address' }, { internalType: 'uint256', name: '_minStake', type: 'uint256' }], stateMutability: 'nonpayable', type: 'constructor' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'bytes32', name: 'nodeId', type: 'bytes32' }, { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }], name: 'EarningsWithdrawn', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'bytes32', name: 'nodeId', type: 'bytes32' }, { indexed: true, internalType: 'address', name: 'owner', type: 'address' }], name: 'NodeRegistered', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'bytes32', name: 'nodeId', type: 'bytes32' }, { indexed: false, internalType: 'uint8', name: 'status', type: 'uint8' }], name: 'NodeStatusUpdated', type: 'event' },
  { inputs: [{ internalType: 'bytes32', name: '_nodeId', type: 'bytes32' }], name: 'getNode', outputs: [{ components: [{ internalType: 'bytes32', name: 'id', type: 'bytes32' }, { internalType: 'address', name: 'owner', type: 'address' }, { internalType: 'string', name: 'gpuModel', type: 'string' }, { internalType: 'uint256', name: 'vram', type: 'uint256' }, { internalType: 'uint256', name: 'tflops', type: 'uint256' }, { internalType: 'string', name: 'region', type: 'string' }, { internalType: 'uint8', name: 'status', type: 'uint8' }, { internalType: 'uint256', name: 'stakedAmount', type: 'uint256' }, { internalType: 'uint256', name: 'totalEarnings', type: 'uint256' }, { internalType: 'uint256', name: 'jobsCompleted', type: 'uint256' }, { internalType: 'uint256', name: 'pricePerHour', type: 'uint256' }, { internalType: 'uint256', name: 'registeredAt', type: 'uint256' }, { internalType: 'uint256', name: 'lastSeen', type: 'uint256' }], internalType: 'struct SynapseRegistry.Node', name: '', type: 'tuple' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: '_owner', type: 'address' }], name: 'getNodesByOwner', outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'string', name: '_gpuModel', type: 'string' }, { internalType: 'uint256', name: '_vram', type: 'uint256' }, { internalType: 'uint256', name: '_tflops', type: 'uint256' }, { internalType: 'string', name: '_region', type: 'string' }, { internalType: 'uint256', name: '_pricePerHour', type: 'uint256' }, { internalType: 'uint256', name: '_stakeAmount', type: 'uint256' }], name: 'registerNode', outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'totalNodes', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'bytes32', name: '_nodeId', type: 'bytes32' }, { internalType: 'uint8', name: '_status', type: 'uint8' }], name: 'updateNodeStatus', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'bytes32', name: '_nodeId', type: 'bytes32' }], name: 'withdrawEarnings', outputs: [], stateMutability: 'nonpayable', type: 'function' },
];

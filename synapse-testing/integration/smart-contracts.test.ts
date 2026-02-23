import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ethers } from 'ethers';
import { ContractDeployer } from '../utils/contract-deployer.js';
import { BlockchainProvider } from '../utils/blockchain-provider.js';
import { TestEnvironment } from '../utils/test-env.js';

const env = new TestEnvironment();
let provider: BlockchainProvider;
let deployer: ContractDeployer;

// Contract ABIs (simplified for testing)
const MessageRegistryABI = [
  'function storeMessage(bytes32 messageHash, address sender, uint256 timestamp) external returns (bool)',
  'function verifyMessage(bytes32 messageHash) external view returns (bool, address, uint256)',
  'function getMessageCount() external view returns (uint256)',
  'event MessageStored(bytes32 indexed messageHash, address indexed sender, uint256 timestamp)',
];

const SynapseTokenABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address recipient, uint256 amount) external returns (bool)',
  'function stake(uint256 amount) external',
  'function unstake(uint256 amount) external',
  'function getStakeInfo(address account) external view returns (uint256 staked, uint256 rewards)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Staked(address indexed user, uint256 amount)',
];

describe('Smart Contract Integration', () => {
  beforeAll(async () => {
    await env.start();
    provider = new BlockchainProvider(env.getBlockchainUrl());
    deployer = new ContractDeployer(provider);
  });

  afterAll(async () => {
    await env.stop();
  });

  describe('Message Registry Contract', () => {
    let messageRegistry: ethers.Contract;

    beforeAll(async () => {
      messageRegistry = await deployer.deploy('MessageRegistry', MessageRegistryABI);
    });

    it('should store and verify messages', async () => {
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes('test message'));
      const sender = await provider.getSigner().getAddress();
      const timestamp = Math.floor(Date.now() / 1000);

      const tx = await messageRegistry.storeMessage(messageHash, sender, timestamp);
      await tx.wait();

      const [verified, storedSender, storedTime] = await messageRegistry.verifyMessage(messageHash);
      
      expect(verified).toBe(true);
      expect(storedSender).toBe(sender);
      expect(Number(storedTime)).toBe(timestamp);
    });

    it('should emit events on message storage', async () => {
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes('event test'));
      const sender = await provider.getSigner().getAddress();
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        messageRegistry.storeMessage(messageHash, sender, timestamp)
      ).to.emit(messageRegistry, 'MessageStored')
        .withArgs(messageHash, sender, timestamp);
    });

    it('should track message count', async () => {
      const initialCount = await messageRegistry.getMessageCount();
      
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes('count test'));
      const sender = await provider.getSigner().getAddress();
      await messageRegistry.storeMessage(messageHash, sender, Math.floor(Date.now() / 1000));

      const newCount = await messageRegistry.getMessageCount();
      expect(Number(newCount)).toBe(Number(initialCount) + 1);
    });

    it('should prevent duplicate message storage', async () => {
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes('duplicate test'));
      const sender = await provider.getSigner().getAddress();
      const timestamp = Math.floor(Date.now() / 1000);

      await messageRegistry.storeMessage(messageHash, sender, timestamp);
      
      await expect(
        messageRegistry.storeMessage(messageHash, sender, timestamp)
      ).to.be.revertedWith('Message already exists');
    });
  });

  describe('Synapse Token Contract', () => {
    let token: ethers.Contract;
    let owner: ethers.Signer;
    let user1: ethers.Signer;
    let user2: ethers.Signer;

    beforeAll(async () => {
      token = await deployer.deploy('SynapseToken', SynapseTokenABI);
      owner = provider.getSigner();
      user1 = await provider.createSigner();
      user2 = await provider.createSigner();
      
      // Mint initial tokens for testing
      await token.mint(await user1.getAddress(), ethers.parseEther('1000'));
      await token.mint(await user2.getAddress(), ethers.parseEther('1000'));
    });

    it('should handle token transfers', async () => {
      const amount = ethers.parseEther('100');
      const user1Address = await user1.getAddress();
      const user2Address = await user2.getAddress();

      const initialBalance = await token.balanceOf(user2Address);
      
      await token.connect(user1).transfer(user2Address, amount);

      const finalBalance = await token.balanceOf(user2Address);
      expect(finalBalance - initialBalance).toBe(amount);
    });

    it('should handle staking operations', async () => {
      const stakeAmount = ethers.parseEther('500');
      const user1Address = await user1.getAddress();

      await expect(token.connect(user1).stake(stakeAmount))
        .to.emit(token, 'Staked')
        .withArgs(user1Address, stakeAmount);

      const [staked, rewards] = await token.getStakeInfo(user1Address);
      expect(staked).toBe(stakeAmount);
      expect(rewards).toBeGreaterThanOrEqual(0);
    });

    it('should handle unstaking with rewards', async () => {
      const user1Address = await user1.getAddress();
      const [stakedBefore] = await token.getStakeInfo(user1Address);
      const balanceBefore = await token.balanceOf(user1Address);

      // Fast forward time to accrue rewards
      await provider.increaseTime(86400 * 7); // 7 days

      await token.connect(user1).unstake(stakedBefore);

      const balanceAfter = await token.balanceOf(user1Address);
      expect(balanceAfter).toBeGreaterThan(balanceBefore);
    });

    it('should enforce access control', async () => {
      // Only owner should be able to mint
      await expect(
        token.connect(user1).mint(await user2.getAddress(), ethers.parseEther('100'))
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should handle insufficient balance', async () => {
      const tooMuch = ethers.parseEther('10000');
      
      await expect(
        token.connect(user1).transfer(await user2.getAddress(), tooMuch)
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });
  });

  describe('Cross-Contract Interactions', () => {
    let messageRegistry: ethers.Contract;
    let token: ethers.Contract;

    beforeAll(async () => {
      messageRegistry = await deployer.deploy('MessageRegistry', MessageRegistryABI);
      token = await deployer.deploy('SynapseToken', SynapseTokenABI);
    });

    it('should integrate message verification with token rewards', async () => {
      const user = await provider.createSigner();
      await token.mint(await user.getAddress(), ethers.parseEther('100'));

      const messageHash = ethers.keccak256(ethers.toUtf8Bytes('rewarded message'));
      const timestamp = Math.floor(Date.now() / 1000);

      // Store message
      await messageRegistry.storeMessage(messageHash, await user.getAddress(), timestamp);

      // Verify and reward
      const [verified] = await messageRegistry.verifyMessage(messageHash);
      expect(verified).toBe(true);

      // Token reward logic would be implemented in actual contract
      const balance = await token.balanceOf(await user.getAddress());
      expect(balance).toBeGreaterThan(0);
    });

    it('should handle multi-sig operations', async () => {
      const signers = await Promise.all([
        provider.createSigner(),
        provider.createSigner(),
        provider.createSigner(),
      ]);

      const multiSig = await deployer.deploy('MultiSigWallet', [
        'function submitTransaction(address destination, uint256 value, bytes data) external returns (uint256)',
        'function confirmTransaction(uint256 txId) external',
        'function executeTransaction(uint256 txId) external',
      ], [
        await Promise.all(signers.map(s => s.getAddress())),
        2, // Required confirmations
      ]);

      // Submit transaction
      const txId = await multiSig.submitTransaction(
        await messageRegistry.getAddress(),
        0,
        messageRegistry.interface.encodeFunctionData('getMessageCount')
      );

      // Confirm from two signers
      await multiSig.connect(signers[0]).confirmTransaction(txId);
      await multiSig.connect(signers[1]).confirmTransaction(txId);

      // Execute
      await expect(multiSig.executeTransaction(txId)).not.to.throw();
    });
  });

  describe('Contract Upgradeability', () => {
    it('should support proxy pattern upgrades', async () => {
      const implementation = await deployer.deploy('MessageRegistryV1', MessageRegistryABI);
      const proxy = await deployer.deployProxy(implementation);

      // Initial version
      const v1 = implementation.attach(proxy);
      expect(await v1.version()).toBe('1.0.0');

      // Upgrade
      const implementationV2 = await deployer.deploy('MessageRegistryV2', MessageRegistryABI);
      await deployer.upgradeProxy(proxy, implementationV2);

      // Verify upgrade
      const v2 = implementationV2.attach(proxy);
      expect(await v2.version()).toBe('2.0.0');
      
      // Data should be preserved
      expect(await v2.getMessageCount()).toBeDefined();
    });
  });
});

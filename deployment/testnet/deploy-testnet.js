#!/usr/bin/env node
/**
 * Synapse Testnet Deployment Script
 * Deploys all 6 smart contracts to Sepolia testnet
 * 
 * Usage: node deploy-testnet.js
 * Requires: SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY in .env
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Testnet Configuration
const CONFIG = {
  network: "sepolia",
  chainId: 11155111,
  confirmations: 2,
  gasPriceMultiplier: 1.1,
  verifyContracts: true,
};

// Test Account Funding Amounts (in ETH)
const TEST_FUNDING = {
  deployer: "0.5",
  testAccount1: "0.1",
  testAccount2: "0.1",
  testAccount3: "0.1",
};

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("           SYNAPSE TESTNET DEPLOYMENT - SEPOLIA");
  console.log("═══════════════════════════════════════════════════════════\n");

  const [deployer] = await ethers.getSigners();
  console.log(`🔑 Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  if (balance < ethers.parseEther("0.5")) {
    console.error("❌ Insufficient funds. Need at least 0.5 ETH for deployment");
    process.exit(1);
  }

  // Deployment state tracking
  const deployment = {
    network: CONFIG.network,
    chainId: CONFIG.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {},
    transactions: [],
    gasUsed: {},
  };

  // DAO address - initially deployer, will transfer to timelock
  const daoAddress = deployer.address;

  try {
    // ========================================
    // 1. Deploy HSKToken
    // ========================================
    console.log("📦 [1/6] Deploying HSKToken...");
    const HSKToken = await ethers.getContractFactory("HSKToken");
    const hskToken = await HSKToken.deploy(daoAddress, daoAddress);
    await hskToken.waitForDeployment();
    const hskTokenAddress = await hskToken.getAddress();
    
    const hskReceipt = await ethers.provider.getTransactionReceipt(
      hskToken.deploymentTransaction().hash
    );
    
    deployment.contracts.HSKToken = {
      address: hskTokenAddress,
      txHash: hskToken.deploymentTransaction().hash,
      blockNumber: hskReceipt.blockNumber,
    };
    deployment.gasUsed.HSKToken = hskReceipt.gasUsed.toString();
    
    console.log(`✅ HSKToken: ${hskTokenAddress}`);
    console.log(`   Gas Used: ${hskReceipt.gasUsed.toString()}`);
    console.log(`   Block: ${hskReceipt.blockNumber}\n`);

    // ========================================
    // 2. Deploy TreasuryDAO
    // ========================================
    console.log("📦 [2/6] Deploying TreasuryDAO...");
    const TreasuryDAO = await ethers.getContractFactory("TreasuryDAO");
    const proposers = [daoAddress];
    const executors = [daoAddress];
    const treasuryDAO = await TreasuryDAO.deploy(
      hskTokenAddress,
      proposers,
      executors
    );
    await treasuryDAO.waitForDeployment();
    const treasuryDAOAddress = await treasuryDAO.getAddress();
    
    const treasuryReceipt = await ethers.provider.getTransactionReceipt(
      treasuryDAO.deploymentTransaction().hash
    );
    
    deployment.contracts.TreasuryDAO = {
      address: treasuryDAOAddress,
      txHash: treasuryDAO.deploymentTransaction().hash,
      blockNumber: treasuryReceipt.blockNumber,
    };
    deployment.gasUsed.TreasuryDAO = treasuryReceipt.gasUsed.toString();
    
    console.log(`✅ TreasuryDAO: ${treasuryDAOAddress}`);
    console.log(`   Gas Used: ${treasuryReceipt.gasUsed.toString()}`);
    console.log(`   Block: ${treasuryReceipt.blockNumber}\n`);

    // ========================================
    // 3. Deploy PriceOracle
    // ========================================
    console.log("📦 [3/6] Deploying PriceOracle...");
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy(daoAddress);
    await priceOracle.waitForDeployment();
    const priceOracleAddress = await priceOracle.getAddress();
    
    const oracleReceipt = await ethers.provider.getTransactionReceipt(
      priceOracle.deploymentTransaction().hash
    );
    
    deployment.contracts.PriceOracle = {
      address: priceOracleAddress,
      txHash: priceOracle.deploymentTransaction().hash,
      blockNumber: oracleReceipt.blockNumber,
    };
    deployment.gasUsed.PriceOracle = oracleReceipt.gasUsed.toString();
    
    console.log(`✅ PriceOracle: ${priceOracleAddress}`);
    console.log(`   Gas Used: ${oracleReceipt.gasUsed.toString()}`);
    console.log(`   Block: ${oracleReceipt.blockNumber}\n`);

    // ========================================
    // 4. Deploy DisputeResolver
    // ========================================
    console.log("📦 [4/6] Deploying DisputeResolver...");
    const DisputeResolver = await ethers.getContractFactory("DisputeResolver");
    const disputeResolver = await DisputeResolver.deploy(daoAddress);
    await disputeResolver.waitForDeployment();
    const disputeResolverAddress = await disputeResolver.getAddress();
    
    const disputeReceipt = await ethers.provider.getTransactionReceipt(
      disputeResolver.deploymentTransaction().hash
    );
    
    deployment.contracts.DisputeResolver = {
      address: disputeResolverAddress,
      txHash: disputeResolver.deploymentTransaction().hash,
      blockNumber: disputeReceipt.blockNumber,
    };
    deployment.gasUsed.DisputeResolver = disputeReceipt.gasUsed.toString();
    
    console.log(`✅ DisputeResolver: ${disputeResolverAddress}`);
    console.log(`   Gas Used: ${disputeReceipt.gasUsed.toString()}`);
    console.log(`   Block: ${disputeReceipt.blockNumber}\n`);

    // ========================================
    // 5. Deploy JobRegistry
    // ========================================
    console.log("📦 [5/6] Deploying JobRegistry...");
    const JobRegistry = await ethers.getContractFactory("JobRegistry");
    const jobRegistry = await JobRegistry.deploy(treasuryDAOAddress, daoAddress);
    await jobRegistry.waitForDeployment();
    const jobRegistryAddress = await jobRegistry.getAddress();
    
    const jobReceipt = await ethers.provider.getTransactionReceipt(
      jobRegistry.deploymentTransaction().hash
    );
    
    deployment.contracts.JobRegistry = {
      address: jobRegistryAddress,
      txHash: jobRegistry.deploymentTransaction().hash,
      blockNumber: jobReceipt.blockNumber,
    };
    deployment.gasUsed.JobRegistry = jobReceipt.gasUsed.toString();
    
    console.log(`✅ JobRegistry: ${jobRegistryAddress}`);
    console.log(`   Gas Used: ${jobReceipt.gasUsed.toString()}`);
    console.log(`   Block: ${jobReceipt.blockNumber}\n`);

    // ========================================
    // 6. Deploy StreamingPayments
    // ========================================
    console.log("📦 [6/6] Deploying StreamingPayments...");
    const StreamingPayments = await ethers.getContractFactory("StreamingPayments");
    const streamingPayments = await StreamingPayments.deploy(treasuryDAOAddress, daoAddress);
    await streamingPayments.waitForDeployment();
    const streamingPaymentsAddress = await streamingPayments.getAddress();
    
    const streamingReceipt = await ethers.provider.getTransactionReceipt(
      streamingPayments.deploymentTransaction().hash
    );
    
    deployment.contracts.StreamingPayments = {
      address: streamingPaymentsAddress,
      txHash: streamingPayments.deploymentTransaction().hash,
      blockNumber: streamingReceipt.blockNumber,
    };
    deployment.gasUsed.StreamingPayments = streamingReceipt.gasUsed.toString();
    
    console.log(`✅ StreamingPayments: ${streamingPaymentsAddress}`);
    console.log(`   Gas Used: ${streamingReceipt.gasUsed.toString()}`);
    console.log(`   Block: ${streamingReceipt.blockNumber}\n`);

    // ========================================
    // Configure Contracts
    // ========================================
    console.log("⚙️ Configuring contracts...\n");

    // Register DisputeResolver in JobRegistry
    console.log("Setting DisputeResolver in JobRegistry...");
    const tx1 = await jobRegistry.connect(deployer).setDisputeResolver(disputeResolverAddress);
    await tx1.wait(CONFIG.confirmations);
    deployment.transactions.push({
      name: "setDisputeResolver",
      txHash: tx1.hash,
    });

    // Grant DISPUTE_RESOLVER_ROLE to DisputeResolver
    console.log("Granting DISPUTE_RESOLVER_ROLE...");
    const DISPUTE_RESOLVER_ROLE = await jobRegistry.DISPUTE_RESOLVER_ROLE();
    const tx2 = await jobRegistry.connect(deployer).grantRole(DISPUTE_RESOLVER_ROLE, disputeResolverAddress);
    await tx2.wait(CONFIG.confirmations);
    deployment.transactions.push({
      name: "grantRole(DISPUTE_RESOLVER_ROLE)",
      txHash: tx2.hash,
    });

    // Add HSK token to StreamingPayments
    console.log("Adding HSK token to StreamingPayments...");
    const tx3 = await streamingPayments.connect(deployer).addSupportedToken(hskTokenAddress);
    await tx3.wait(CONFIG.confirmations);
    deployment.transactions.push({
      name: "addSupportedToken(HSK)",
      txHash: tx3.hash,
    });

    // Setup initial arbitrator
    console.log("Setting up default arbitrator...");
    const tx4 = await disputeResolver.connect(deployer).registerArbitrator(
      daoAddress,
      ethers.parseEther("0.01"), // 0.01 ETH flat fee for testnet
      100, // 1% fee
      3 * 24 * 60 * 60, // 3 days evidence
      1 * 24 * 60 * 60, // 1 day vote
      1 * 24 * 60 * 60, // 1 day appeal
      treasuryDAOAddress
    );
    await tx4.wait(CONFIG.confirmations);
    deployment.transactions.push({
      name: "registerArbitrator",
      txHash: tx4.hash,
    });

    // Mint some test HSK for testing
    console.log("Minting test HSK tokens...");
    const tx5 = await hskToken.connect(deployer).mint(
      deployer.address,
      ethers.parseEther("1000000") // 1M HSK
    );
    await tx5.wait(CONFIG.confirmations);
    deployment.transactions.push({
      name: "mint(test tokens)",
      txHash: tx5.hash,
    });

    console.log("✅ Configuration complete!\n");

    // ========================================
    // Save Deployment Info
    // ========================================
    const deploymentPath = path.join(__dirname, "testnet-deployment.json");
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    
    const envPath = path.join(__dirname, "testnet-contracts.env");
    const envContent = `# Synapse Testnet Contract Addresses (Sepolia)
# Deployed: ${deployment.timestamp}
# Deployer: ${deployer.address}

NETWORK=sepolia
CHAIN_ID=11155111

# Core Contracts
HSK_TOKEN_ADDRESS=${hskTokenAddress}
TREASURY_DAO_ADDRESS=${treasuryDAOAddress}
PRICE_ORACLE_ADDRESS=${priceOracleAddress}
DISPUTE_RESOLVER_ADDRESS=${disputeResolverAddress}
JOB_REGISTRY_ADDRESS=${jobRegistryAddress}
STREAMING_PAYMENTS_ADDRESS=${streamingPaymentsAddress}
`;
    fs.writeFileSync(envPath, envContent);

    // ========================================
    // Summary
    // ========================================
    console.log("═══════════════════════════════════════════════════════════");
    console.log("              ✅ TESTNET DEPLOYMENT COMPLETE");
    console.log("═══════════════════════════════════════════════════════════\n");
    
    console.log("Contract Addresses:");
    console.log(`  1. HSKToken:            ${hskTokenAddress}`);
    console.log(`  2. TreasuryDAO:         ${treasuryDAOAddress}`);
    console.log(`  3. PriceOracle:         ${priceOracleAddress}`);
    console.log(`  4. DisputeResolver:     ${disputeResolverAddress}`);
    console.log(`  5. JobRegistry:         ${jobRegistryAddress}`);
    console.log(`  6. StreamingPayments:   ${streamingPaymentsAddress}\n`);

    console.log("Files Saved:");
    console.log(`  • ${deploymentPath}`);
    console.log(`  • ${envPath}\n`);

    console.log("Next Steps:");
    console.log("  1. Verify contracts on Sepolia Etherscan");
    console.log("  2. Deploy subgraph (./deploy-subgraph.sh)");
    console.log("  3. Fund test accounts (./fund-test-accounts.js)");
    console.log("  4. Run integration tests");
    console.log("  5. Configure API gateways\n");

    return deployment;

  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    console.error(error.stack);
    
    // Save partial deployment
    const deploymentPath = path.join(__dirname, "testnet-deployment-partial.json");
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log(`\nPartial deployment saved to: ${deploymentPath}`);
    
    process.exit(1);
  }
}

main()
  .then((deployment) => {
    console.log("Deployment successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

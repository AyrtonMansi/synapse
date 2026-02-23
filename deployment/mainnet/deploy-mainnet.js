#!/usr/bin/env node
/**
 * Synapse Mainnet Deployment Script
 * Deploys all 6 smart contracts to Ethereum Mainnet
 * 
 * ⚠️  WARNING: This uses real funds and is irreversible!
 * 
 * Usage: node deploy-mainnet.js
 * Requires: MAINNET_RPC_URL, MAINNET_PRIVATE_KEY in .env
 *           MULTISIG_ADDRESS for DAO ownership
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Mainnet Configuration
const CONFIG = {
  network: "mainnet",
  chainId: 1,
  confirmations: 5, // More confirmations for mainnet
  gasPriceMultiplier: 1.2,
  verifyContracts: true,
  multisigRequired: true,
};

// Create readline interface for confirmations
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

async function confirmDeployment() {
  console.log("\n⚠️  ⚠️  ⚠️   MAINNET DEPLOYMENT WARNING   ⚠️  ⚠️  ⚠️\n");
  console.log("You are about to deploy to ETHEREUM MAINNET.");
  console.log("This will use REAL ETH and the deployment is IRREVERSIBLE.\n");
  
  const answer1 = await ask("Do you understand the risks? (yes/no): ");
  if (answer1.toLowerCase() !== "yes") {
    console.log("❌ Deployment cancelled.");
    process.exit(0);
  }
  
  const answer2 = await ask("Have you completed all testnet testing? (yes/no): ");
  if (answer2.toLowerCase() !== "yes") {
    console.log("❌ Please complete testnet testing first.");
    process.exit(0);
  }
  
  const answer3 = await ask("Is the multisig wallet configured and tested? (yes/no): ");
  if (answer3.toLowerCase() !== "yes") {
    console.log("❌ Please configure the multisig wallet first.");
    process.exit(0);
  }
  
  const answer4 = await ask("Type 'DEPLOY TO MAINNET' to proceed: ");
  if (answer4 !== "DEPLOY TO MAINNET") {
    console.log("❌ Deployment cancelled.");
    process.exit(0);
  }
  
  rl.close();
}

async function main() {
  await confirmDeployment();
  
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("           SYNAPSE MAINNET DEPLOYMENT - ETHEREUM");
  console.log("═══════════════════════════════════════════════════════════\n");

  const [deployer] = await ethers.getSigners();
  console.log(`🔑 Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceEth = ethers.formatEther(balance);
  console.log(`💰 Balance: ${balanceEth} ETH\n`);

  // Check minimum balance (approximately 0.5 ETH for all contracts)
  if (balance < ethers.parseEther("0.5")) {
    console.error("❌ Insufficient funds. Need at least 0.5 ETH for deployment");
    process.exit(1);
  }

  // Load multisig address from environment
  const multisigAddress = process.env.MULTISIG_ADDRESS;
  if (!multisigAddress) {
    console.error("❌ MULTISIG_ADDRESS not set in environment");
    process.exit(1);
  }
  
  console.log(`🔐 Multisig (DAO): ${multisigAddress}\n`);

  // Deployment state tracking
  const deployment = {
    network: CONFIG.network,
    chainId: CONFIG.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    multisig: multisigAddress,
    contracts: {},
    transactions: [],
    gasUsed: {},
    totalCost: "0",
  };

  try {
    // ========================================
    // 1. Deploy HSKToken
    // ========================================
    console.log("📦 [1/6] Deploying HSKToken...");
    const HSKToken = await ethers.getContractFactory("HSKToken");
    const hskToken = await HSKToken.deploy(multisigAddress, multisigAddress);
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

    // Wait for extra confirmations on mainnet
    console.log(`⏳ Waiting for ${CONFIG.confirmations} confirmations...`);
    await hskToken.deploymentTransaction().wait(CONFIG.confirmations);

    // ========================================
    // 2. Deploy TreasuryDAO
    // ========================================
    console.log("📦 [2/6] Deploying TreasuryDAO...");
    const TreasuryDAO = await ethers.getContractFactory("TreasuryDAO");
    const proposers = [multisigAddress];
    const executors = [multisigAddress];
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

    await treasuryDAO.deploymentTransaction().wait(CONFIG.confirmations);

    // ========================================
    // 3. Deploy PriceOracle
    // ========================================
    console.log("📦 [3/6] Deploying PriceOracle...");
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy(multisigAddress);
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

    await priceOracle.deploymentTransaction().wait(CONFIG.confirmations);

    // ========================================
    // 4. Deploy DisputeResolver
    // ========================================
    console.log("📦 [4/6] Deploying DisputeResolver...");
    const DisputeResolver = await ethers.getContractFactory("DisputeResolver");
    const disputeResolver = await DisputeResolver.deploy(multisigAddress);
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

    await disputeResolver.deploymentTransaction().wait(CONFIG.confirmations);

    // ========================================
    // 5. Deploy JobRegistry
    // ========================================
    console.log("📦 [5/6] Deploying JobRegistry...");
    const JobRegistry = await ethers.getContractFactory("JobRegistry");
    const jobRegistry = await JobRegistry.deploy(treasuryDAOAddress, multisigAddress);
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

    await jobRegistry.deploymentTransaction().wait(CONFIG.confirmations);

    // ========================================
    // 6. Deploy StreamingPayments
    // ========================================
    console.log("📦 [6/6] Deploying StreamingPayments...");
    const StreamingPayments = await ethers.getContractFactory("StreamingPayments");
    const streamingPayments = await StreamingPayments.deploy(treasuryDAOAddress, multisigAddress);
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

    await streamingPayments.deploymentTransaction().wait(CONFIG.confirmations);

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

    console.log("✅ Configuration complete!\n");

    // Calculate total gas used
    const totalGas = Object.values(deployment.gasUsed).reduce(
      (acc, gas) => acc + BigInt(gas),
      BigInt(0)
    );
    deployment.totalGasUsed = totalGas.toString();

    // ========================================
    // Save Deployment Info
    // ========================================
    const deploymentPath = path.join(__dirname, "mainnet-deployment.json");
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    
    const envPath = path.join(__dirname, "mainnet-contracts.env");
    const envContent = `# Synapse Mainnet Contract Addresses
# Deployed: ${deployment.timestamp}
# Deployer: ${deployer.address}
# Multisig: ${multisigAddress}

NETWORK=mainnet
CHAIN_ID=1

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
    console.log("              ✅ MAINNET DEPLOYMENT COMPLETE");
    console.log("═══════════════════════════════════════════════════════════\n");
    
    console.log("Contract Addresses:");
    console.log(`  1. HSKToken:            ${hskTokenAddress}`);
    console.log(`  2. TreasuryDAO:         ${treasuryDAOAddress}`);
    console.log(`  3. PriceOracle:         ${priceOracleAddress}`);
    console.log(`  4. DisputeResolver:     ${disputeResolverAddress}`);
    console.log(`  5. JobRegistry:         ${jobRegistryAddress}`);
    console.log(`  6. StreamingPayments:   ${streamingPaymentsAddress}\n`);

    console.log(`Total Gas Used: ${totalGas.toString()}\n`);

    console.log("Files Saved:");
    console.log(`  • ${deploymentPath}`);
    console.log(`  • ${envPath}\n`);

    console.log("⚠️  IMPORTANT NEXT STEPS:");
    console.log("  1. Verify contracts on Etherscan (./verify-mainnet.sh)");
    console.log("  2. Transfer admin roles to multisig");
    console.log("  3. Configure Chainlink price feeds");
    console.log("  4. Setup DEX liquidity");
    console.log("  5. Deploy subgraph");
    console.log("  6. Run security verification\n");

    return deployment;

  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    console.error(error.stack);
    
    // Save partial deployment
    const deploymentPath = path.join(__dirname, "mainnet-deployment-partial.json");
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

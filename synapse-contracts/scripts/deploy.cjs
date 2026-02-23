const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying Synapse Smart Contract Suite...\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  // DAO address - will be controlled by governance
  const daoAddress = deployer.address; // Initially deployer, to be transferred to DAO

  // ========================================
  // 1. Deploy HSK Token
  // ========================================
  console.log("📦 Deploying HSKToken...");
  const HSKToken = await ethers.getContractFactory("HSKToken");
  const hskToken = await HSKToken.deploy(daoAddress, daoAddress);
  await hskToken.waitForDeployment();
  const hskTokenAddress = await hskToken.getAddress();
  console.log(`✅ HSKToken deployed to: ${hskTokenAddress}`);
  console.log(`   Initial supply: 20,000,000 HSK`);
  console.log(`   Max supply: 100,000,000 HSK\n`);

  // ========================================
  // 2. Deploy TreasuryDAO
  // ========================================
  console.log("📦 Deploying TreasuryDAO...");
  const TreasuryDAO = await ethers.getContractFactory("TreasuryDAO");
  const proposers = [daoAddress];
  const treasuryDAO = await TreasuryDAO.deploy(hskTokenAddress, proposers);
  await treasuryDAO.waitForDeployment();
  const treasuryDAOAddress = await treasuryDAO.getAddress();
  console.log(`✅ TreasuryDAO deployed to: ${treasuryDAOAddress}\n`);

  // ========================================
  // 3. Deploy PriceOracle
  // ========================================
  console.log("📦 Deploying PriceOracle...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy(daoAddress);
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();
  console.log(`✅ PriceOracle deployed to: ${priceOracleAddress}\n`);

  // ========================================
  // 4. Deploy DisputeResolver
  // ========================================
  console.log("📦 Deploying DisputeResolver...");
  const DisputeResolver = await ethers.getContractFactory("DisputeResolver");
  const disputeResolver = await DisputeResolver.deploy(daoAddress);
  await disputeResolver.waitForDeployment();
  const disputeResolverAddress = await disputeResolver.getAddress();
  console.log(`✅ DisputeResolver deployed to: ${disputeResolverAddress}\n`);

  // ========================================
  // 5. Deploy JobRegistry
  // ========================================
  console.log("📦 Deploying JobRegistry...");
  const JobRegistry = await ethers.getContractFactory("JobRegistry");
  const jobRegistry = await JobRegistry.deploy(treasuryDAOAddress, daoAddress);
  await jobRegistry.waitForDeployment();
  const jobRegistryAddress = await jobRegistry.getAddress();
  console.log(`✅ JobRegistry deployed to: ${jobRegistryAddress}\n`);

  // ========================================
  // 6. Deploy StreamingPayments
  // ========================================
  console.log("📦 Deploying StreamingPayments...");
  const StreamingPayments = await ethers.getContractFactory("StreamingPayments");
  const streamingPayments = await StreamingPayments.deploy(treasuryDAOAddress, daoAddress);
  await streamingPayments.waitForDeployment();
  const streamingPaymentsAddress = await streamingPayments.getAddress();
  console.log(`✅ StreamingPayments deployed to: ${streamingPaymentsAddress}\n`);

  // ========================================
  // Configure Contracts
  // ========================================
  console.log("⚙️ Configuring contracts...\n");

  // Register DisputeResolver in JobRegistry
  console.log("Setting DisputeResolver in JobRegistry...");
  await (await jobRegistry.connect(deployer).setDisputeResolver(disputeResolverAddress)).wait();

  // Grant DISPUTE_RESOLVER_ROLE to DisputeResolver in JobRegistry
  const DISPUTE_RESOLVER_ROLE = await jobRegistry.DISPUTE_RESOLVER_ROLE();
  await (await jobRegistry.connect(deployer).grantRole(DISPUTE_RESOLVER_ROLE, disputeResolverAddress)).wait();

  // Add HSK token to StreamingPayments
  console.log("Adding HSK token to StreamingPayments...");
  await (await streamingPayments.connect(deployer).addSupportedToken(hskTokenAddress)).wait();

  // Setup PriceOracle with some default feeds (would be mainnet addresses on mainnet)
  console.log("PriceOracle ready for DAO to add feeds\n");

  // ========================================
  // Setup Arbitrator in DisputeResolver
  // ========================================
  console.log("Setting up default arbitrator in DisputeResolver...");
  await (await disputeResolver.connect(deployer).registerArbitrator(
    daoAddress, // Use DAO as initial arbitrator
    ethers.parseEther("0.1"), // 0.1 ETH flat fee
    100, // 1% fee percentage
    7 * 24 * 60 * 60, // 7 days evidence period
    3 * 24 * 60 * 60, // 3 days vote period
    2 * 24 * 60 * 60, // 2 days appeal period
    treasuryDAOAddress // Fee recipient
  )).wait();

  console.log("✅ Configuration complete!\n");

  // ========================================
  // Summary
  // ========================================
  console.log("═══════════════════════════════════════════════════════════");
  console.log("              SYNAPSE CONTRACT SUITE DEPLOYED");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  console.log("Contract Addresses:");
  console.log(`  1. HSKToken:            ${hskTokenAddress}`);
  console.log(`  2. TreasuryDAO:         ${treasuryDAOAddress}`);
  console.log(`  3. PriceOracle:         ${priceOracleAddress}`);
  console.log(`  4. DisputeResolver:     ${disputeResolverAddress}`);
  console.log(`  5. JobRegistry:         ${jobRegistryAddress}`);
  console.log(`  6. StreamingPayments:   ${streamingPaymentsAddress}\n`);

  console.log("Governance:");
  console.log(`  DAO Controller: ${daoAddress}`);
  console.log(`  Treasury:       ${treasuryDAOAddress}\n`);

  console.log("Next Steps:");
  console.log("  1. Transfer DAO ownership to actual governance contract");
  console.log("  2. Add Chainlink price feeds to PriceOracle");
  console.log("  3. Setup treasury funding");
  console.log("  4. Verify contracts on Etherscan\n");

  // Save deployment addresses
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      HSKToken: hskTokenAddress,
      TreasuryDAO: treasuryDAOAddress,
      PriceOracle: priceOracleAddress,
      DisputeResolver: disputeResolverAddress,
      JobRegistry: jobRegistryAddress,
      StreamingPayments: streamingPaymentsAddress,
    },
  };

  const fs = require("fs");
  fs.writeFileSync(
    `deployment-${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment saved to deployment-${hre.network.name}.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

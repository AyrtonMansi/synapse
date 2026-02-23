const hre = require("hardhat");

/**
 * @title Deploy Governance Contracts
 * @notice Deploys the complete Synapse governance suite
 * @dev Run with: npx hardhat run scripts/deploy-governance.js --network <network>
 */

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying governance contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Configuration
  const config = {
    // Token addresses (update these)
    governanceToken: process.env.GOVERNANCE_TOKEN || "0x0000000000000000000000000000000000000000",
    
    // Timelock settings
    minDelay: 2 * 24 * 60 * 60, // 2 days
    maxDelay: 30 * 24 * 60 * 60, // 30 days
    gracePeriod: 14 * 24 * 60 * 60, // 14 days
    
    // Governor settings
    quorum: hre.ethers.parseUnits("1000", 18), // 1000 tokens
    votingPeriod: 3 * 24 * 60 * 60, // 3 days
    proposalThreshold: hre.ethers.parseUnits("100", 18), // 100 tokens
    
    // Price oracle (optional)
    priceOracle: process.env.PRICE_ORACLE || "0x0000000000000000000000000000000000000000",
  };

  const deployedContracts = {};

  try {
    // 1. Deploy Timelock
    console.log("\n1. Deploying SynapseTimelock...");
    const Timelock = await hre.ethers.getContractFactory("SynapseTimelock");
    const timelock = await Timelock.deploy(
      config.minDelay,
      config.maxDelay,
      config.gracePeriod,
      deployer.address // admin
    );
    await timelock.waitForDeployment();
    deployedContracts.timelock = await timelock.getAddress();
    console.log("SynapseTimelock deployed to:", deployedContracts.timelock);

    // 2. Deploy Governor
    console.log("\n2. Deploying SynapseGovernor...");
    const Governor = await hre.ethers.getContractFactory("SynapseGovernor");
    const governor = await Governor.deploy(
      config.governanceToken,
      deployedContracts.timelock,
      config.quorum,
      config.votingPeriod
    );
    await governor.waitForDeployment();
    deployedContracts.governor = await governor.getAddress();
    console.log("SynapseGovernor deployed to:", deployedContracts.governor);

    // 3. Deploy Treasury Analytics
    console.log("\n3. Deploying TreasuryAnalytics...");
    // Note: Treasury address should be set after TreasuryDAO deployment
    const treasuryAddress = process.env.TREASURY_DAO || deployer.address;
    const Analytics = await hre.ethers.getContractFactory("TreasuryAnalytics");
    const analytics = await Analytics.deploy(
      treasuryAddress,
      deployedContracts.governor,
      config.priceOracle
    );
    await analytics.waitForDeployment();
    deployedContracts.analytics = await analytics.getAddress();
    console.log("TreasuryAnalytics deployed to:", deployedContracts.analytics);

    // 4. Deploy Gnosis Safe Module
    console.log("\n4. Deploying SynapseGnosisSafeModule...");
    const SafeModule = await hre.ethers.getContractFactory("SynapseGnosisSafeModule");
    const safeModule = await SafeModule.deploy(
      deployedContracts.governor,
      treasuryAddress,
      2 // default threshold
    );
    await safeModule.waitForDeployment();
    deployedContracts.safeModule = await safeModule.getAddress();
    console.log("SynapseGnosisSafeModule deployed to:", deployedContracts.safeModule);

    // 5. Configure roles
    console.log("\n5. Configuring roles...");
    
    // Grant governor proposer role on timelock
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    await timelock.grantRole(PROPOSER_ROLE, deployedContracts.governor);
    console.log("Granted PROPOSER_ROLE to Governor");

    // Grant executor role to governor
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    await timelock.grantRole(EXECUTOR_ROLE, deployedContracts.governor);
    console.log("Granted EXECUTOR_ROLE to Governor");

    // Grant admin role to timelock itself (DAO control)
    const DEFAULT_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();
    await timelock.grantRole(DEFAULT_ADMIN_ROLE, deployedContracts.timelock);
    console.log("Granted DEFAULT_ADMIN_ROLE to Timelock");

    // 6. Transfer timelock admin to timelock contract (optional - for full DAO control)
    // await timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    // console.log("Deployer renounced timelock admin");

    // Print summary
    console.log("\n========================================");
    console.log("Governance Deployment Summary");
    console.log("========================================");
    console.log("SynapseGovernor:", deployedContracts.governor);
    console.log("SynapseTimelock:", deployedContracts.timelock);
    console.log("TreasuryAnalytics:", deployedContracts.analytics);
    console.log("SynapseGnosisSafeModule:", deployedContracts.safeModule);
    console.log("========================================\n");

    // Save deployment info
    const fs = require('fs');
    const deploymentInfo = {
      network: hre.network.name,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contracts: deployedContracts,
      config: {
        minDelay: config.minDelay,
        maxDelay: config.maxDelay,
        gracePeriod: config.gracePeriod,
        quorum: config.quorum.toString(),
        votingPeriod: config.votingPeriod,
        proposalThreshold: config.proposalThreshold.toString(),
      }
    };

    const deploymentsDir = './deployments';
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir);
    }

    fs.writeFileSync(
      `${deploymentsDir}/governance-${hre.network.name}-${Date.now()}.json`,
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("Deployment info saved to deployments/");

  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
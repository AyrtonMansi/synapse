const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);
  console.log('Account balance:', (await deployer.provider.getBalance(deployer.address)).toString());

  const network = hre.network.name;
  console.log('Network:', network);

  // 1. Deploy HSK Token
  console.log('\n1. Deploying HSKToken...');
  const HSKToken = await ethers.getContractFactory('HSKToken');
  const hskToken = await HSKToken.deploy(deployer.address);
  await hskToken.waitForDeployment();
  console.log('HSKToken deployed to:', await hskToken.getAddress());

  // 2. Deploy NodeRegistry
  console.log('\n2. Deploying NodeRegistry...');
  const NodeRegistry = await ethers.getContractFactory('NodeRegistry');
  const nodeRegistry = await NodeRegistry.deploy(
    await hskToken.getAddress(),
    deployer.address
  );
  await nodeRegistry.waitForDeployment();
  console.log('NodeRegistry deployed to:', await nodeRegistry.getAddress());

  // 3. Deploy NodeRewards
  console.log('\n3. Deploying NodeRewards...');
  const NodeRewards = await ethers.getContractFactory('NodeRewards');
  const nodeRewards = await NodeRewards.deploy(
    await hskToken.getAddress(),
    deployer.address, // fee recipient (treasury)
    deployer.address
  );
  await nodeRewards.waitForDeployment();
  console.log('NodeRewards deployed to:', await nodeRewards.getAddress());

  // 4. Wire contracts together
  console.log('\n4. Wiring contracts...');
  
  // Authorize NodeRewards as minter
  await (await hskToken.authorizeMinter(await nodeRewards.getAddress())).wait();
  console.log('✓ NodeRewards authorized as minter');
  
  // Set NodeRegistry in NodeRewards
  await (await nodeRewards.setNodeRegistry(await nodeRegistry.getAddress())).wait();
  console.log('✓ NodeRegistry set in NodeRewards');
  
  // Authorize settlement service as slasher (deployer for now)
  await (await nodeRegistry.authorizeSlasher(deployer.address)).wait();
  console.log('✓ Deployer authorized as slasher');

  // 5. Fund NodeRewards with initial rewards pool
  console.log('\n5. Funding rewards pool...');
  const REWARD_POOL = ethers.parseEther('10000000'); // 10M HSK
  await (await hskToken.transfer(await nodeRewards.getAddress(), REWARD_POOL)).wait();
  console.log('✓ Funded with 10,000,000 HSK');

  // 6. Save deployment info
  const deploymentInfo = {
    network,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      HSKToken: await hskToken.getAddress(),
      NodeRegistry: await nodeRegistry.getAddress(),
      NodeRewards: await nodeRewards.getAddress(),
    },
    config: {
      minStake: '1000 HSK',
      epochDuration: '24 hours',
      protocolFee: '5%',
      rewardPool: '10000000 HSK',
    },
  };

  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const filename = path.join(deploymentsDir, `${network}.json`);
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n✓ Deployment info saved to ${filename}`);

  // 7. Verification instructions
  console.log('\n========================================');
  console.log('DEPLOYMENT COMPLETE');
  console.log('========================================');
  console.log('\nContract Addresses:');
  console.log(`HSK Token:      ${await hskToken.getAddress()}`);
  console.log(`Node Registry:  ${await nodeRegistry.getAddress()}`);
  console.log(`Node Rewards:   ${await nodeRewards.getAddress()}`);
  console.log('\nNext Steps:');
  console.log('1. Verify contracts on Etherscan:');
  console.log(`   npx hardhat verify --network ${network} ${await hskToken.getAddress()} ${deployer.address}`);
  console.log(`   npx hardhat verify --network ${network} ${await nodeRegistry.getAddress()} ${await hskToken.getAddress()} ${deployer.address}`);
  console.log(`   npx hardhat verify --network ${network} ${await nodeRewards.getAddress()} ${await hskToken.getAddress()} ${deployer.address} ${deployer.address}`);
  console.log('\n2. Update settlement service with contract addresses');
  console.log('\n3. Start settlement daemon');
  console.log('========================================');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

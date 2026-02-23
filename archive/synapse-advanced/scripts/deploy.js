const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying Synapse Bridge + Model Marketplace...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // ============ CROSS-CHAIN BRIDGE (Ethereum <> Arbitrum) ============
    console.log("\n=== Deploying Cross-Chain Bridge Contracts ===");

    // Deploy Unified HSK Token
    const UnifiedHSK = await ethers.getContractFactory("UnifiedHSK");
    const unifiedHSK = await UnifiedHSK.deploy();
    await unifiedHSK.deployed();
    console.log("UnifiedHSK deployed to:", unifiedHSK.address);

    // Deploy Synapse Bridge
    // LayerZero Endpoints:
    // Ethereum: 0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675
    // Arbitrum: 0x3c2269811836af69497E5F486A85D7316753cf62
    const lzEndpoint = "0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675"; // Ethereum
    const SynapseBridge = await ethers.getContractFactory("SynapseBridge");
    const synapseBridge = await SynapseBridge.deploy(unifiedHSK.address, lzEndpoint);
    await synapseBridge.deployed();
    console.log("SynapseBridge deployed to:", synapseBridge.address);

    // Grant bridge role to bridge contract
    await unifiedHSK.grantRole(await unifiedHSK.BRIDGE_ROLE(), synapseBridge.address);
    await unifiedHSK.grantRole(await unifiedHSK.MINTER_ROLE(), synapseBridge.address);
    await unifiedHSK.grantRole(await unifiedHSK.BURNER_ROLE(), synapseBridge.address);
    console.log("Bridge roles granted to SynapseBridge");

    // ============ MODEL MARKETPLACE ============
    console.log("\n=== Deploying Model Marketplace Contracts ===");

    // Deploy Model NFT
    const ModelNFT = await ethers.getContractFactory("ModelNFT");
    const modelNFT = await ModelNFT.deploy();
    await modelNFT.deployed();
    console.log("ModelNFT deployed to:", modelNFT.address);

    // Deploy Model Verification
    const ModelVerification = await ethers.getContractFactory("ModelVerification");
    const modelVerification = await ModelVerification.deploy(modelNFT.address);
    await modelVerification.deployed();
    console.log("ModelVerification deployed to:", modelVerification.address);

    // Deploy Model Registry
    const ModelRegistry = await ethers.getContractFactory("ModelRegistry");
    const modelRegistry = await ModelRegistry.deploy(modelNFT.address);
    await modelRegistry.deployed();
    console.log("ModelRegistry deployed to:", modelRegistry.address);

    // ============ SUMMARY ============
    console.log("\n=== DEPLOYMENT SUMMARY ===");
    const deployedContracts = {
        bridge: {
            UnifiedHSK: unifiedHSK.address,
            SynapseBridge: synapseBridge.address
        },
        modelMarketplace: {
            ModelNFT: modelNFT.address,
            ModelVerification: modelVerification.address,
            ModelRegistry: modelRegistry.address
        }
    };

    console.log(JSON.stringify(deployedContracts, null, 2));

    // Save deployment addresses
    const fs = require('fs');
    fs.writeFileSync(
        'deployment-addresses.json',
        JSON.stringify(deployedContracts, null, 2)
    );
    console.log("\nDeployment addresses saved to deployment-addresses.json");

    // ============ VERIFICATION ============
    console.log("\n=== VERIFICATION COMMANDS ===");
    console.log(`npx hardhat verify --network mainnet ${unifiedHSK.address}`);
    console.log(`npx hardhat verify --network mainnet ${synapseBridge.address} ${unifiedHSK.address} ${lzEndpoint}`);
    console.log(`npx hardhat verify --network mainnet ${modelNFT.address}`);
    console.log(`npx hardhat verify --network mainnet ${modelVerification.address} ${modelNFT.address}`);
    console.log(`npx hardhat verify --network mainnet ${modelRegistry.address} ${modelNFT.address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

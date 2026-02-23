import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("Model Marketplace", function () {
    let modelNFT: any;
    let modelVerification: any;
    let modelRegistry: any;
    let owner: Signer;
    let creator: Signer;
    let verifier: Signer;
    let buyer: Signer;

    beforeEach(async function () {
        [owner, creator, verifier, buyer] = await ethers.getSigners();

        // Deploy Model NFT
        const ModelNFT = await ethers.getContractFactory("ModelNFT");
        modelNFT = await ModelNFT.deploy();
        await modelNFT.deployed();

        // Deploy Verification
        const ModelVerification = await ethers.getContractFactory("ModelVerification");
        modelVerification = await ModelVerification.deploy(modelNFT.address);
        await modelVerification.deployed();

        // Deploy Registry
        const ModelRegistry = await ethers.getContractFactory("ModelRegistry");
        modelRegistry = await ModelRegistry.deploy(modelNFT.address);
        await modelRegistry.deployed();
    });

    describe("ModelNFT", function () {
        it("Should mint model NFT", async function () {
            const tx = await modelNFT.connect(creator).mintModel(
                "GPT-4 Clone",
                "A powerful language model",
                "1.0.0",
                ["llm", "nlp", "chat"],
                ethers.utils.formatBytes32String("modelhash123"),
                ethers.utils.formatBytes32String("confighash123"),
                1000000,
                "llm",
                "pytorch",
                ethers.utils.parseEther("0.1"),
                "MIT",
                "https://docs.example.com",
                [await creator.getAddress()],
                [100],
                500 // 5% royalty
            );

            await expect(tx)
                .to.emit(modelNFT, "ModelMinted")
                .withArgs(0, await creator.getAddress(), ethers.utils.formatBytes32String("modelhash123"), "GPT-4 Clone");
        });

        it("Should rate a model", async function () {
            // Mint model first
            await modelNFT.connect(creator).mintModel(
                "Test Model",
                "Description",
                "1.0",
                ["test"],
                ethers.utils.formatBytes32String("hash1"),
                ethers.utils.formatBytes32String("config1"),
                1000,
                "classification",
                "tensorflow",
                ethers.utils.parseEther("0.1"),
                "MIT",
                "",
                [await creator.getAddress()],
                [100],
                500
            );

            await modelNFT.connect(buyer).rateModel(0, 5);

            const stats = await modelNFT.getModelStats(0);
            expect(stats.rating).to.equal(5);
            expect(stats.ratingCount).to.equal(1);
        });

        it("Should distribute royalties", async function () {
            // Mint model
            await modelNFT.connect(creator).mintModel(
                "Test Model",
                "Description",
                "1.0",
                ["test"],
                ethers.utils.formatBytes32String("hash1"),
                ethers.utils.formatBytes32String("config1"),
                1000,
                "classification",
                "tensorflow",
                ethers.utils.parseEther("0.1"),
                "MIT",
                "",
                [await creator.getAddress()],
                [100],
                500
            );

            const royalty = ethers.utils.parseEther("0.01");
            await expect(
                modelNFT.connect(buyer).distributeRoyalties(0, { value: royalty })
            ).to.changeEtherBalance(creator, royalty);
        });
    });

    describe("ModelVerification", function () {
        beforeEach(async function () {
            // Mint a model
            await modelNFT.connect(creator).mintModel(
                "Test Model",
                "Description",
                "1.0",
                ["test"],
                ethers.utils.formatBytes32String("hash1"),
                ethers.utils.formatBytes32String("config1"),
                1000,
                "classification",
                "tensorflow",
                ethers.utils.parseEther("0.1"),
                "MIT",
                "",
                [await creator.getAddress()],
                [100],
                500
            );

            // Register verifier
            await modelVerification.connect(verifier).registerVerifier(
                "Test Verifier",
                "Certified AI Auditor"
            );
        });

        it("Should request verification", async function () {
            const tx = await modelVerification.connect(creator).requestVerification(0, {
                value: ethers.utils.parseEther("0.05")
            });

            await expect(tx).to.emit(modelVerification, "VerificationRequested");
        });

        it("Should complete verification", async function () {
            // Request verification
            await modelVerification.connect(creator).requestVerification(0, {
                value: ethers.utils.parseEther("0.05")
            });

            const requestId = await modelVerification.modelToRequest(0);

            // Assign verifier
            await modelVerification.connect(verifier).assignVerifier(requestId);

            // Submit results
            const tx = await modelVerification.connect(verifier).submitVerification(
                requestId,
                ethers.utils.formatBytes32String("results"),
                "https://report.example.com",
                80, // security score
                70, // performance score
                90, // accuracy score
                "All good!"
            );

            await expect(tx).to.emit(modelVerification, "VerificationCompleted");

            // Check model is verified
            const metadata = await modelNFT.getModelMetadata(0);
            expect(metadata.isVerified).to.be.true;
        });
    });

    describe("ModelRegistry", function () {
        beforeEach(async function () {
            // Mint and approve model
            await modelNFT.connect(creator).mintModel(
                "Test Model",
                "Description",
                "1.0",
                ["test"],
                ethers.utils.formatBytes32String("hash1"),
                ethers.utils.formatBytes32String("config1"),
                1000,
                "classification",
                "tensorflow",
                ethers.utils.parseEther("0.1"),
                "MIT",
                "",
                [await creator.getAddress()],
                [100],
                500
            );

            // Grant uploader role
            await modelRegistry.grantRole(await modelRegistry.UPLOADER_ROLE(), await owner.getAddress());
        });

        it("Should index model", async function () {
            await modelRegistry.indexModel(
                0,
                ["nlp", "classification"],
                "classification"
            );

            const models = await modelRegistry.searchByTag("nlp");
            expect(models).to.include(0);
        });

        it("Should register new version", async function () {
            await modelRegistry.connect(creator).registerVersion(
                0,
                "1.1.0",
                ethers.utils.formatBytes32String("newhash"),
                "Fixed bugs",
                { value: ethers.utils.parseEther("0.01") }
            );

            const versions = await modelRegistry.getModelVersions(0);
            expect(versions.length).to.equal(1);
            expect(versions[0].version).to.equal("1.1.0");
        });

        it("Should create bundle", async function () {
            // Mint second model
            await modelNFT.connect(creator).mintModel(
                "Second Model",
                "Description",
                "1.0",
                ["test"],
                ethers.utils.formatBytes32String("hash2"),
                ethers.utils.formatBytes32String("config2"),
                1000,
                "classification",
                "tensorflow",
                ethers.utils.parseEther("0.1"),
                "MIT",
                "",
                [await creator.getAddress()],
                [100],
                500
            );

            const tx = await modelRegistry.connect(creator).createBundle(
                "NLP Bundle",
                "Great models for NLP",
                [0, 1],
                ethers.utils.parseEther("0.15")
            );

            await expect(tx).to.emit(modelRegistry, "BundleCreated");
        });
    });
});

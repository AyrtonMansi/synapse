import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("Cross-Chain Bridge (Ethereum <> Arbitrum)", function () {
    let unifiedHSK: any;
    let synapseBridge: any;
    let owner: Signer;
    let user1: Signer;
    let user2: Signer;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy Unified HSK
        const UnifiedHSK = await ethers.getContractFactory("UnifiedHSK");
        unifiedHSK = await UnifiedHSK.deploy();
        await unifiedHSK.deployed();

        // Deploy Bridge (mock LayerZero endpoint)
        const SynapseBridge = await ethers.getContractFactory("SynapseBridge");
        synapseBridge = await SynapseBridge.deploy(
            unifiedHSK.address,
            ethers.constants.AddressZero
        );
        await synapseBridge.deployed();

        // Grant roles
        await unifiedHSK.grantRole(await unifiedHSK.BRIDGE_ROLE(), synapseBridge.address);
        await unifiedHSK.grantRole(await unifiedHSK.MINTER_ROLE(), synapseBridge.address);
        await unifiedHSK.grantRole(await unifiedHSK.BURNER_ROLE(), synapseBridge.address);
    });

    describe("UnifiedHSK", function () {
        it("Should mint initial supply", async function () {
            const totalSupply = await unifiedHSK.totalSupply();
            expect(totalSupply).to.equal(ethers.utils.parseEther("100000000"));
        });

        it("Should bridge tokens (mint)", async function () {
            const amount = ethers.utils.parseEther("100");
            await unifiedHSK.mint(await user1.getAddress(), amount, 1);
            
            const balance = await unifiedHSK.balanceOf(await user1.getAddress());
            expect(balance).to.equal(amount);
        });

        it("Should bridge tokens (burn)", async function () {
            // First mint
            const amount = ethers.utils.parseEther("100");
            await unifiedHSK.mint(await user1.getAddress(), amount, 1);
            
            // Then burn
            await unifiedHSK.burn(await user1.getAddress(), amount, 42161);
            
            const balance = await unifiedHSK.balanceOf(await user1.getAddress());
            expect(balance).to.equal(0);
        });

        it("Should track chain supply", async function () {
            const amount = ethers.utils.parseEther("100");
            await unifiedHSK.mint(await user1.getAddress(), amount, 1);
            
            const chainSupply = await unifiedHSK.getChainSupply(1);
            expect(chainSupply.bridgedIn).to.equal(amount);
        });

        it("Should only support Ethereum and Arbitrum", async function () {
            const chains = await unifiedHSK.getSupportedChains();
            expect(chains.length).to.equal(2);
            expect(chains[0]).to.equal(1);
            expect(chains[1]).to.equal(42161);
        });

        it("Should enforce blacklist", async function () {
            await unifiedHSK.setBlacklist(await user1.getAddress(), true);
            
            await expect(
                unifiedHSK.transfer(await user2.getAddress(), ethers.utils.parseEther("1"))
            ).to.be.revertedWith("Account blacklisted");
        });
    });

    describe("SynapseBridge", function () {
        it("Should initialize Ethereum config", async function () {
            const ethConfig = await synapseBridge.chainConfigs(1);
            expect(ethConfig.supported).to.be.true;
            expect(ethConfig.lzChainId).to.equal(101);
            expect(ethConfig.feeBasisPoints).to.equal(30);
        });

        it("Should initialize Arbitrum config", async function () {
            const arbConfig = await synapseBridge.chainConfigs(42161);
            expect(arbConfig.supported).to.be.true;
            expect(arbConfig.lzChainId).to.equal(110);
            expect(arbConfig.feeBasisPoints).to.equal(20);
        });

        it("Should reject unsupported chains", async function () {
            await expect(
                synapseBridge.bridge(
                    137, // Polygon
                    await user1.getAddress(),
                    ethers.utils.parseEther("100"),
                    "0x"
                )
            ).to.be.revertedWith("Only Ethereum/Arbitrum supported");
        });

        it("Should estimate bridge fees", async function () {
            const targetChain = 42161;
            const amount = ethers.utils.parseEther("100");
            
            // Just verify function doesn't revert
            await expect(
                synapseBridge.estimateBridgeFee(targetChain, amount)
            ).to.not.be.reverted;
        });

        it("Should reject amount below minimum", async function () {
            await expect(
                synapseBridge.bridge(
                    42161,
                    await user1.getAddress(),
                    ethers.utils.parseEther("0.0001"),
                    "0x"
                )
            ).to.be.revertedWith("Amount below minimum");
        });

        it("Should reject amount above maximum", async function () {
            await expect(
                synapseBridge.bridge(
                    42161,
                    await user1.getAddress(),
                    ethers.utils.parseEther("2000000"),
                    "0x"
                )
            ).to.be.revertedWith("Amount exceeds maximum");
        });

        it("Should allow admin to update chain config", async function () {
            await synapseBridge.updateChainConfig(
                42161,
                true,
                25, // new fee
                ethers.constants.AddressZero
            );

            const config = await synapseBridge.chainConfigs(42161);
            expect(config.feeBasisPoints).to.equal(25);
        });

        it("Should allow admin to pause", async function () {
            await synapseBridge.pause();
            expect(await synapseBridge.paused()).to.be.true;
        });

        it("Should allow admin to unpause", async function () {
            await synapseBridge.pause();
            await synapseBridge.unpause();
            expect(await synapseBridge.paused()).to.be.false;
        });
    });
});

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {JobRegistry} from "../contracts/JobRegistry.sol";
import {HSKToken} from "../contracts/HSKToken.sol";
import {PriceOracle} from "../contracts/PriceOracle.sol";
import {DisputeResolver} from "../contracts/DisputeResolver.sol";
import {TreasuryDAO} from "../contracts/TreasuryDAO.sol";
import {StreamingPayments} from "../contracts/StreamingPayments.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title DeployProxy
 * @notice Deployment script for Synapse contracts with UUPS proxies
 * @dev Ensures all contracts are upgradeable via DAO governance
 */
contract DeployProxy is Script {
    // Deployment addresses will be stored here
    struct Deployment {
        address timelock;
        address token;
        address tokenProxy;
        address jobRegistry;
        address jobRegistryProxy;
        address priceOracle;
        address priceOracleProxy;
        address disputeResolver;
        address disputeResolverProxy;
        address treasuryDAO;
        address streamingPayments;
        address streamingPaymentsProxy;
    }

    Deployment public deployment;

    // Configuration
    uint256 public constant MIN_DELAY = 2 days;
    address[] public proposers;
    address[] public executors;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Setup timelock proposers/executors
        proposers.push(deployer); // Initially deployer, will transfer to DAO
        executors.push(deployer);
        
        vm.startBroadcast(deployerPrivateKey);

        // ============================================
        // 1. Deploy Timelock Controller
        // ============================================
        TimelockController timelock = new TimelockController(
            MIN_DELAY,
            proposers,
            executors,
            deployer // admin
        );
        deployment.timelock = address(timelock);
        console.log("Timelock deployed:", deployment.timelock);

        // ============================================
        // 2. Deploy HSK Token with Proxy
        // ============================================
        HSKToken tokenImpl = new HSKToken();
        deployment.token = address(tokenImpl);
        
        bytes memory tokenInit = abi.encodeWithSelector(
            HSKToken.initialize.selector,
            address(timelock), // DAO controls token
            deployer // Initial mining controller
        );
        
        ERC1967Proxy tokenProxy = new ERC1967Proxy(
            deployment.token,
            tokenInit
        );
        deployment.tokenProxy = address(tokenProxy);
        console.log("HSK Token Proxy deployed:", deployment.tokenProxy);

        // ============================================
        // 3. Deploy Price Oracle with Proxy
        // ============================================
        PriceOracle oracleImpl = new PriceOracle();
        deployment.priceOracle = address(oracleImpl);
        
        bytes memory oracleInit = abi.encodeWithSelector(
            PriceOracle.initialize.selector,
            address(timelock) // DAO controls oracle
        );
        
        ERC1967Proxy oracleProxy = new ERC1967Proxy(
            deployment.priceOracle,
            oracleInit
        );
        deployment.priceOracleProxy = address(oracleProxy);
        console.log("Price Oracle Proxy deployed:", deployment.priceOracleProxy);

        // ============================================
        // 4. Deploy Dispute Resolver with Proxy
        // ============================================
        DisputeResolver disputeImpl = new DisputeResolver();
        deployment.disputeResolver = address(disputeImpl);
        
        bytes memory disputeInit = abi.encodeWithSelector(
            DisputeResolver.initialize.selector,
            address(timelock), // DAO controls disputes
            address(timelock) // Treasury for fees
        );
        
        ERC1967Proxy disputeProxy = new ERC1967Proxy(
            deployment.disputeResolver,
            disputeInit
        );
        deployment.disputeResolverProxy = address(disputeProxy);
        console.log("Dispute Resolver Proxy deployed:", deployment.disputeResolverProxy);

        // ============================================
        // 5. Deploy Job Registry with Proxy
        // ============================================
        JobRegistry jobImpl = new JobRegistry();
        deployment.jobRegistry = address(jobImpl);
        
        bytes memory jobInit = abi.encodeWithSelector(
            JobRegistry.initialize.selector,
            address(timelock), // Treasury
            address(timelock), // DAO
            address(timelock)  // Timelock
        );
        
        ERC1967Proxy jobProxy = new ERC1967Proxy(
            deployment.jobRegistry,
            jobInit
        );
        deployment.jobRegistryProxy = address(jobProxy);
        console.log("Job Registry Proxy deployed:", deployment.jobRegistryProxy);

        // ============================================
        // 6. Deploy Treasury DAO (non-proxy, self-governing)
        // ============================================
        address[] memory initialProposers = new address[](1);
        initialProposers[0] = deployer;
        
        TreasuryDAO treasury = new TreasuryDAO(
            deployment.tokenProxy,
            initialProposers
        );
        deployment.treasuryDAO = address(treasury);
        console.log("Treasury DAO deployed:", deployment.treasuryDAO);

        // ============================================
        // 7. Deploy Streaming Payments with Proxy
        // ============================================
        StreamingPayments streamingImpl = new StreamingPayments();
        deployment.streamingPayments = address(streamingImpl);
        
        bytes memory streamingInit = abi.encodeWithSelector(
            StreamingPayments.initialize.selector,
            address(timelock), // Treasury
            address(timelock)  // DAO
        );
        
        ERC1967Proxy streamingProxy = new ERC1967Proxy(
            deployment.streamingPayments,
            streamingInit
        );
        deployment.streamingPaymentsProxy = address(streamingProxy);
        console.log("Streaming Payments Proxy deployed:", deployment.streamingPaymentsProxy);

        // ============================================
        // 8. Setup Contract Relationships
        // ============================================
        
        // Grant DISPUTE_RESOLVER_ROLE to DisputeResolver in JobRegistry
        JobRegistry(payable(deployment.jobRegistryProxy)).setDisputeResolver(
            deployment.disputeResolverProxy
        );
        console.log("Dispute Resolver role granted in JobRegistry");

        // ============================================
        // 9. Transfer Timelock Admin to Treasury DAO
        // ============================================
        timelock.grantRole(timelock.TIMELOCK_ADMIN_ROLE(), deployment.treasuryDAO);
        timelock.grantRole(timelock.PROPOSER_ROLE(), deployment.treasuryDAO);
        timelock.grantRole(timelock.EXECUTOR_ROLE(), deployment.treasuryDAO);
        
        // Revoke deployer roles (optional - can do via governance proposal)
        // timelock.revokeRole(timelock.TIMELOCK_ADMIN_ROLE(), deployer);
        // timelock.revokeRole(timelock.PROPOSER_ROLE(), deployer);
        // timelock.revokeRole(timelock.EXECUTOR_ROLE(), deployer);
        
        console.log("Timelock roles configured");

        vm.stopBroadcast();

        // ============================================
        // 10. Output Deployment Summary
        // ============================================
        console.log("\n========================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("Timelock:", deployment.timelock);
        console.log("Treasury DAO:", deployment.treasuryDAO);
        console.log("HSK Token:", deployment.tokenProxy);
        console.log("Job Registry:", deployment.jobRegistryProxy);
        console.log("Price Oracle:", deployment.priceOracleProxy);
        console.log("Dispute Resolver:", deployment.disputeResolverProxy);
        console.log("Streaming Payments:", deployment.streamingPaymentsProxy);
        console.log("========================================");
        console.log("Implementation Addresses (for verification):");
        console.log("HSK Token Impl:", deployment.token);
        console.log("Job Registry Impl:", deployment.jobRegistry);
        console.log("Price Oracle Impl:", deployment.priceOracle);
        console.log("Dispute Resolver Impl:", deployment.disputeResolver);
        console.log("Streaming Payments Impl:", deployment.streamingPayments);
        console.log("========================================");
        console.log("NOTE: Contracts are upgradeable via DAO governance only");
        console.log("Min delay for upgrades:", MIN_DELAY, "seconds");
        console.log("========================================");
    }
}

/**
 * @title UpgradeContract
 * @notice Script for upgrading proxy contracts via timelock
 */
contract UpgradeContract is Script {
    function upgradeJobRegistry(address proxy, address newImplementation) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Schedule upgrade through timelock
        bytes memory data = abi.encodeWithSelector(
            UUPSUpgradeable.upgradeToAndCall.selector,
            newImplementation,
            "" // No initialization call
        );
        
        TimelockController timelock = TimelockController(payable(JobRegistry(payable(proxy)).timelock()));
        
        timelock.schedule(
            proxy,
            0, // value
            data,
            bytes32(0), // predecessor
            bytes32(0), // salt
            2 days // delay
        );
        
        console.log("Upgrade scheduled. Execute after delay.");
        
        vm.stopBroadcast();
    }
    
    function executeUpgrade(address proxy, address newImplementation) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        bytes memory data = abi.encodeWithSelector(
            UUPSUpgradeable.upgradeToAndCall.selector,
            newImplementation,
            ""
        );
        
        TimelockController timelock = TimelockController(payable(JobRegistry(payable(proxy)).timelock()));
        
        timelock.execute(
            proxy,
            0,
            data,
            bytes32(0),
            bytes32(0)
        );
        
        console.log("Upgrade executed successfully");
        
        vm.stopBroadcast();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/JobManager.sol";
import "../src/RateLimiter.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy JobManager
        JobManager jobManager = new JobManager(feeRecipient);
        console.log("JobManager deployed at:", address(jobManager));
        
        // Deploy RateLimiter
        RateLimiter rateLimiter = new RateLimiter();
        console.log("RateLimiter deployed at:", address(rateLimiter));
        
        vm.stopBroadcast();
        
        // Write deployment info
        string memory json = "{";
        json = string.concat(json, '"JobManager":"', vm.toString(address(jobManager)), '","');
        json = string.concat(json, '"RateLimiter":"', vm.toString(address(rateLimiter)), '"');
        json = string.concat(json, "}");
        
        vm.writeFile("artifacts/addresses.json", json);
    }
}
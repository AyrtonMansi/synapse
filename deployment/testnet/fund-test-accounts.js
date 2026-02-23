#!/usr/bin/env node
/**
 * Fund Test Accounts on Sepolia
 * Distributes ETH to test accounts for QA/testing
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Test account private keys (for Sepolia only - NOT real funds)
const TEST_ACCOUNTS = [
  {
    name: "test-operator-1",
    address: "0x...", // Replace with actual test address
    amount: "0.05",
  },
  {
    name: "test-operator-2",
    address: "0x...",
    amount: "0.05",
  },
  {
    name: "test-client-1",
    address: "0x...",
    amount: "0.05",
  },
  {
    name: "test-client-2",
    address: "0x...",
    amount: "0.05",
  },
  {
    name: "test-arbitrator",
    address: "0x...",
    amount: "0.05",
  },
];

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("           FUNDING TEST ACCOUNTS - SEPOLIA");
  console.log("═══════════════════════════════════════════════════════════\n");

  const [funder] = await ethers.getSigners();
  console.log(`💰 Funder: ${funder.address}`);
  
  const balance = await ethers.provider.getBalance(funder.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  const results = [];

  for (const account of TEST_ACCOUNTS) {
    if (account.address === "0x...") {
      console.log(`⚠️  Skipping ${account.name} - address not configured`);
      continue;
    }

    try {
      console.log(`Sending ${account.amount} ETH to ${account.name}...`);
      const tx = await funder.sendTransaction({
        to: account.address,
        value: ethers.parseEther(account.amount),
      });
      await tx.wait();
      
      results.push({
        name: account.name,
        address: account.address,
        amount: account.amount,
        txHash: tx.hash,
        status: "✅ Success",
      });
      
      console.log(`  ✅ ${tx.hash}`);
    } catch (error) {
      results.push({
        name: account.name,
        address: account.address,
        amount: account.amount,
        error: error.message,
        status: "❌ Failed",
      });
      console.log(`  ❌ Failed: ${error.message}`);
    }
  }

  // Save results
  const resultsPath = path.join(__dirname, "funding-results.json");
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  console.log(`\n✅ Results saved to: ${resultsPath}\n`);
  
  // Summary
  const successCount = results.filter(r => r.status === "✅ Success").length;
  console.log(`Summary: ${successCount}/${results.length} accounts funded`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

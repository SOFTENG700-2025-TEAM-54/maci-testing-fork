#!/usr/bin/env node
/**
 * Configuration generator for Caliper network configuration
 * Reads environment variables and generates test-network.json
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

// Import the Poll ABI
const pollAbi = require("../../abi/Poll.json");

// Network configuration template
const networkConfig = {
  name: process.env.ETHEREUM_NETWORK_NAME || "MACI-Ethereum-Test",
  version: "2.0.0",
  caliper: {
    blockchain: "ethereum",
  },
  ethereum: {
    url: process.env.ETHEREUM_RPC_URL,
    contractDeployerAddress: process.env.CONTRACT_DEPLOYER_ADDRESS,
    contractDeployerAddressPrivateKey: process.env.CONTRACT_DEPLOYER_PRIVATE_KEY,
    fromAddressSeed: process.env.FROM_ADDRESS_SEED,
    transactionConfirmationBlocks: parseInt(
      process.env.TRANSACTION_CONFIRMATION_BLOCKS || "1",
      10
    ),
    contracts: {
      Poll: {
        estimateGas: process.env.GAS_ESTIMATE_ENABLED === "true",
        gas: {
          query: parseInt(process.env.GAS_QUERY_LIMIT || "100000", 10),
          transfer: parseInt(process.env.GAS_TRANSFER_LIMIT || "70000", 10),
        },
        address: process.env.POLL_CONTRACT_ADDRESS,
        abi: pollAbi.abi || pollAbi,
      },
    },
  },
};

// Validate required environment variables
const requiredVars = [
  "ETHEREUM_RPC_URL",
  "CONTRACT_DEPLOYER_ADDRESS",
  "CONTRACT_DEPLOYER_PRIVATE_KEY",
  "FROM_ADDRESS_SEED",
  "POLL_CONTRACT_ADDRESS",
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error("\nPlease create a .env file based on .env.example and fill in all required values.");
  process.exit(1);
}

// Write the configuration file
const outputPath = path.resolve(__dirname, "../../networks/ethereum/test-network.json");
fs.writeFileSync(outputPath, JSON.stringify(networkConfig, null, 2));

console.log("✓ Network configuration generated successfully:");
console.log(`  ${outputPath}`);
console.log("\nConfiguration preview:");
console.log(`  Network: ${networkConfig.name}`);
console.log(`  RPC URL: ${networkConfig.ethereum.url}`);
console.log(`  Poll Contract: ${networkConfig.ethereum.contracts.Poll.address}`);

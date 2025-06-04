import { ethers } from "hardhat";
import { Keypair } from "@maci-protocol/domainobjs";
import fs from "fs";

async function main() {
  // Get the deployed MACI contract
  const deployedContracts = JSON.parse(fs.readFileSync("./deployed-contracts.json", "utf8"));
  const maciAddress = deployedContracts.localhost?.named?.MACI?.address;

  if (!maciAddress) {
    console.error("MACI contract not found in deployed-contracts.json");
    return;
  }

  console.log("MACI Address:", maciAddress);

  // Get the contract instance
  const maci = await ethers.getContractAt("MACI", maciAddress);

  // Check current number of signups BEFORE signing up
  console.log("\n📊 Checking current signups...");
  try {
    const currentSignups = await maci.totalSignups();
    console.log("Current total signups:", currentSignups.toString());

    // Get state tree root
    const stateTreeRoot = await maci.getStateTreeRoot();
    console.log("Current state tree root:", stateTreeRoot.toString());
  } catch (error) {
    console.error("Error checking current signups:", error.message);
  }

  // Generate keypair
  const keypair = new Keypair();
  const publicKeyX = keypair.publicKey.raw[0];
  const publicKeyY = keypair.publicKey.raw[1];

  console.log("\n🔑 Generated MACI Keypair:");
  console.log("Private Key:", keypair.privateKey.serialize());
  console.log("Public Key:", keypair.publicKey.serialize());
  console.log("X Coordinate:", publicKeyX.toString());
  console.log("Y Coordinate:", publicKeyY.toString());

  // Get signer (first account from Hardhat)
  const [signer] = await ethers.getSigners();

  console.log("\n👤 Signing up with address:", signer.address);
  console.log("Public Key Coordinates:", [publicKeyX.toString(), publicKeyY.toString()]);

  try {
    // Call signUp function
    const tx = await maci.connect(signer).signUp(
      [publicKeyX.toString(), publicKeyY.toString()],
      "0x", // empty signUpPolicyData for FreeForAllPolicy
    );

    console.log("\n📝 Transaction submitted:", tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

    // Check for SignUp event - Updated event signature based on MACI.sol
    const iface = new ethers.Interface([
      "event SignUp(uint256 _stateIndex, uint256 _timestamp, uint256 indexed _userPublicKeyX, uint256 indexed _userPublicKeyY)",
    ]);

    let signupFound = false;
    for (const log of receipt.logs) {
      try {
        const parsedLog = iface.parseLog(log);
        if (parsedLog.name === "SignUp") {
          console.log("\n🎉 SignUp successful!");
          console.log("State Index:", parsedLog.args._stateIndex.toString());
          console.log("Timestamp:", parsedLog.args._timestamp.toString());
          console.log("User Public Key X:", parsedLog.args._userPublicKeyX.toString());
          console.log("User Public Key Y:", parsedLog.args._userPublicKeyY.toString());
          signupFound = true;
        }
      } catch (e) {
        // Not a SignUp event, skip
      }
    }

    if (!signupFound) {
      console.log("⚠️ No SignUp event found in transaction logs");
    }

    // Check number of signups AFTER signing up
    console.log("\n📊 Checking updated signups...");
    const newSignups = await maci.totalSignups();
    console.log("New total signups:", newSignups.toString());

    // Get updated state tree root
    const newStateTreeRoot = await maci.getStateTreeRoot();
    console.log("New state tree root:", newStateTreeRoot.toString());

    // Calculate the hash of the public key to verify it was added
    const publicKeyHash = ethers.solidityPackedKeccak256(
      ["uint256", "uint256"],
      [publicKeyX.toString(), publicKeyY.toString()],
    );
    console.log("Public key hash:", publicKeyHash);

    // Try to get the state index for this user
    try {
      const stateIndex = await maci.getStateIndex(publicKeyHash);
      console.log("User's state index:", stateIndex.toString());
    } catch (error) {
      console.log("Could not retrieve state index (user might not be signed up)");
    }

    // Show signup summary
    console.log("\n📋 Signup Summary:");
    console.log("- User signed up successfully ✅");
    console.log("- State index:", signupFound ? "Found in event logs" : "Not found");
    console.log("- Total signups increased:", newSignups.toString());
  } catch (error) {
    console.error("\n❌ Error during signup:", error);

    // Try to get more details about the error
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    if (error.data) {
      console.error("Error data:", error.data);
    }

    // Still check current signups even if signup failed
    console.log("\n📊 Current signups after failed attempt:");
    try {
      const finalSignups = await maci.totalSignups();
      console.log("Total signups:", finalSignups.toString());
    } catch (e) {
      console.error("Could not check signups:", e.message);
    }
  }
}

main().catch(console.error);

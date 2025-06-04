import { Keypair, PublicKey, PrivateKey } from "@maci-protocol/domainobjs";
import fs from "fs";
import path from "path";

// Read the deployed contracts to get the correct MACI address
const deployedContracts = JSON.parse(fs.readFileSync(path.join(process.cwd(), "deployed-contracts.json"), "utf8"));
const maciAddress = deployedContracts.localhost?.named?.MACI?.address || "0x82D50AD3C1091866E258Fd0f1a7cC9674609D254";

console.log("🔑 MACI Keypair Information");
console.log("=" * 50);

// Show local testnet account addresses
console.log("\n📍 Local Testnet Addresses:");
console.log("Account 0 (Deployer/Coordinator): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
console.log("Account 1 (Voting User): 0x70997970C51812dc3A010C7d01b50e0d17dc79C8");

// Hardhat default private keys
const deployerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const votingUserPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

// Show coordinator keys from testing_setup.json
try {
  const testingSetup = JSON.parse(fs.readFileSync(path.join(process.cwd(), "testing_setup.json"), "utf8"));
  const coordinatorPrivateKeyStr = testingSetup["private-key"];
  const coordinatorPublicKeyStr = testingSetup["public-key"];

  if (coordinatorPrivateKeyStr && coordinatorPublicKeyStr) {
    console.log("\n📋 Coordinator Keys (from testing_setup.json):");
    console.log("Private Key:", coordinatorPrivateKeyStr);
    console.log("Public Key:", coordinatorPublicKeyStr);

    // Verify the keys match
    const coordinatorPrivateKey = PrivateKey.deserialize(coordinatorPrivateKeyStr);
    const coordinatorKeypair = new Keypair(coordinatorPrivateKey);
    const derivedPublicKey = coordinatorKeypair.publicKey.serialize();

    if (derivedPublicKey === coordinatorPublicKeyStr) {
      console.log("✅ Coordinator keys are valid and match");
    } else {
      console.log("❌ Coordinator keys don't match!");
    }

    const publicKeyX = coordinatorKeypair.publicKey.raw[0];
    const publicKeyY = coordinatorKeypair.publicKey.raw[1];

    console.log("X Coordinate:", publicKeyX.toString());
    console.log("Y Coordinate:", publicKeyY.toString());
  }
} catch (error) {
  console.log("❌ Could not load coordinator keys from testing_setup.json");
}

console.log("\n" + "=" * 50);

// Generate a new user keypair for demonstration
const keypair = new Keypair();

// Get the public key coordinates
const publicKeyX = keypair.publicKey.raw[0];
const publicKeyY = keypair.publicKey.raw[1];

console.log("\n🆕 New User Keypair (for signup):");
console.log("Private Key:", keypair.privateKey.serialize());
console.log("Public Key:", keypair.publicKey.serialize());
console.log("X Coordinate:", publicKeyX.toString());
console.log("Y Coordinate:", publicKeyY.toString());

console.log("\n📝 Complete cast command for signup (using voting user account 1):");
console.log(
  `cast send ${maciAddress} "signUp((uint256,uint256),bytes)" "(${publicKeyX.toString()},${publicKeyY.toString()})" "0x" --rpc-url http://localhost:8545 --private-key ${votingUserPrivateKey}`,
);

console.log("\n💡 Account Usage:");
console.log("- Account 0 (Deployer): Used for deploying contracts and coordinator role");
console.log("- Account 1 (Voting User): Used for signing up and voting");
console.log("- Coordinator keys from testing_setup.json: Used for message encryption/decryption");

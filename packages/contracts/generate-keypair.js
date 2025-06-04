import { Keypair } from "@maci-protocol/domainobjs";
import fs from "fs";

// Read the deployed contracts to get the correct MACI address
const deployedContracts = JSON.parse(fs.readFileSync("./deployed-contracts.json", "utf8"));
const maciAddress = deployedContracts.localhost?.named?.MACI?.address || "0x82D50AD3C1091866E258Fd0f1a7cC9674609D254";

// Generate a new keypair
const keypair = new Keypair();

// Get the public key coordinates
const publicKeyX = keypair.publicKey.raw[0];
const publicKeyY = keypair.publicKey.raw[1];

console.log("Generated MACI Keypair:");
console.log("Private Key:", keypair.privateKey.serialize());
console.log("Public Key:", keypair.publicKey.serialize());
console.log("X Coordinate:", publicKeyX.toString());
console.log("Y Coordinate:", publicKeyY.toString());

const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

console.log("\nComplete cast command:");
console.log(
  `cast send ${maciAddress} "signUp((uint256,uint256),bytes)" "(${publicKeyX.toString()},${publicKeyY.toString()})" "0x" --rpc-url http://localhost:8545 --private-key ${privateKey}`,
);

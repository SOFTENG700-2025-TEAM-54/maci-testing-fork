import { ethers } from "hardhat";
import { Keypair, VoteCommand, PublicKey } from "@maci-protocol/domainobjs";
import fs from "fs";
import path from "path";

async function main() {
  // Get the deployed MACI contract
  const deployedContracts = JSON.parse(fs.readFileSync(path.join(process.cwd(), "deployed-contracts.json"), "utf8"));
  const maciAddress = deployedContracts.localhost?.named?.MACI?.address;

  if (!maciAddress) {
    console.error("MACI contract not found in deployed-contracts.json");
    return;
  }

  console.log("MACI Address:", maciAddress);

  // Get signers - deployer (0) and voting user (1)
  const [deployer, votingUser] = await ethers.getSigners();
  console.log("Deployer/Coordinator address:", deployer.address);
  console.log("Voting user address:", votingUser.address);

  // Get the contract instance
  const maci = await ethers.getContractAt("MACI", maciAddress);

  // Get next poll ID (latest poll)
  const nextPollId = await maci.nextPollId();
  const pollId = nextPollId - 1n; // Latest poll

  if (pollId < 0) {
    console.error("❌ No polls found. Deploy a poll first with:");
    console.error("npx hardhat run deploy-poll.js --network localhost");
    return;
  }

  console.log("Poll ID:", pollId.toString());

  // Get the poll contract - handle both single address and array responses
  let pollAddress;
  try {
    const pollResult = await maci.polls(pollId);
    console.log("Poll result:", pollResult);

    // If it's an array, take the first element (main Poll contract)
    if (Array.isArray(pollResult)) {
      pollAddress = pollResult[0];
      console.log("Poll address (from array):", pollAddress);
    } else {
      pollAddress = pollResult;
      console.log("Poll address (single):", pollAddress);
    }
  } catch (error) {
    console.error("Error getting poll address:", error.message);
    return;
  }

  const poll = await ethers.getContractAt("Poll", pollAddress);

  // Check voting period - try different method names
  let startTime, duration, endTime;
  try {
    // Try newer method names first
    try {
      startTime = await poll.startDate();
      duration = await poll.duration();
    } catch (e) {
      // Try alternative method names
      try {
        startTime = await poll.startTime();
        duration = await poll.duration();
      } catch (e2) {
        // Try getting from config
        startTime = await poll.deployTime();
        const endDate = await poll.endDate();
        duration = endDate - startTime;
      }
    }

    endTime = startTime + duration;
    const currentTime = Math.floor(Date.now() / 1000);

    console.log("\n⏰ Poll Timing:");
    console.log("Current time:", new Date().toLocaleString());
    console.log("Start time:", new Date(Number(startTime) * 1000).toLocaleString());
    console.log("End time:", new Date(Number(endTime) * 1000).toLocaleString());

    if (currentTime < startTime) {
      console.error("❌ Voting has not started yet");
      return;
    }

    if (currentTime > endTime) {
      console.error("❌ Voting period has ended");
      return;
    }

    console.log("✅ Voting is currently active");
  } catch (error) {
    console.log("⚠️ Unable to check voting period timing, proceeding anyway...");
    console.log("Error:", error.message);
  }

  // Check if anyone is signed up
  try {
    const totalSignups = await maci.totalSignups();
    console.log("\n👥 Total signups:", totalSignups.toString());

    if (totalSignups === 0n) {
      console.log("❌ No users have signed up to MACI yet. Sign up first with:");
      console.log("npx hardhat run signup.js --network localhost");
      return;
    }

    // For direct voting, we need to know the user's state index in MACI
    // In this demo, we'll assume the user is the first real user (index 1, after PAD_KEY_HASH at index 0)
    const userStateIndex = 1; // First user after PAD_KEY_HASH

    // Generate voting keypair (same as user's MACI keypair in direct voting)
    // In production, you'd load the user's actual MACI keypair
    const userKeypair = new Keypair();

    console.log("\n🔑 Using Voting Keypair:");
    console.log("Private Key:", userKeypair.privateKey.serialize());
    console.log("Public Key:", userKeypair.publicKey.serialize());

    // Vote parameters
    const voteOptionIndex = 0; // Vote for option 0
    const voteWeight = 9; // Voice credits to spend (9 credits = 3 vote weight in QV)
    const nonce = 1; // First vote for this user

    console.log("\n📋 Vote Parameters:");
    console.log("State Index:", userStateIndex);
    console.log("Vote Option:", voteOptionIndex);
    console.log("Vote Weight:", voteWeight);
    console.log("Nonce:", nonce);
    console.log("Poll ID:", pollId);

    // Create vote command
    const command = new VoteCommand(
      BigInt(userStateIndex),
      userKeypair.publicKey, // User's public key
      BigInt(voteOptionIndex),
      BigInt(voteWeight),
      BigInt(nonce),
      BigInt(pollId),
    );

    // Sign the command
    const signature = command.sign(userKeypair.privateKey);

    // Load coordinator keys from testing_setup.json
    const testingSetup = JSON.parse(fs.readFileSync(path.join(process.cwd(), "testing_setup.json"), "utf8"));
    const coordinatorPublicKeyStr = testingSetup["public-key"];

    if (!coordinatorPublicKeyStr) {
      console.error("❌ Coordinator public key not found in testing_setup.json");
      return;
    }

    const coordinatorPublicKey = PublicKey.deserialize(coordinatorPublicKeyStr);
    console.log("\n🔑 Using Coordinator Public Key from testing_setup.json:");
    console.log("Public Key:", coordinatorPublicKeyStr);

    // Generate ephemeral keypair for message encryption
    const ephemeralKeypair = new Keypair();

    // Create shared key for encryption
    const sharedKey = Keypair.generateEcdhSharedKey(ephemeralKeypair.privateKey, coordinatorPublicKey);

    // Encrypt the command
    const message = command.encrypt(signature, sharedKey);

    console.log("\n🔐 Message encrypted and ready to publish");

    try {
      // Publish the message to the poll using voting user (account 1)
      console.log("🔄 Publishing vote message...");
      console.log("Using voting user address:", votingUser.address);

      const tx = await poll
        .connect(votingUser) // Use voting user (account 1) instead of deployer
        .publishMessage(message.asContractParam(), ephemeralKeypair.publicKey.asContractParam());

      console.log("Transaction submitted:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ Vote published successfully!");
      console.log("Block number:", receipt.blockNumber);
      console.log("Gas used:", receipt.gasUsed.toString());

      // Look for PublishMessage event
      const iface = new ethers.Interface([
        "event PublishMessage(tuple(uint256[10] data) _message, tuple(uint256 x, uint256 y) _encPubKey)",
      ]);

      for (const log of receipt.logs) {
        try {
          const parsedLog = iface.parseLog(log);
          if (parsedLog.name === "PublishMessage") {
            console.log("\n📧 Message Published Event:");
            console.log("Message data length:", parsedLog.args._message.data.length);
            console.log("Encryption public key:", [
              parsedLog.args._encPubKey.x.toString(),
              parsedLog.args._encPubKey.y.toString(),
            ]);
          }
        } catch (e) {
          // Not a PublishMessage event, skip
        }
      }
    } catch (error) {
      console.error("\n❌ Error publishing vote:", error.message);

      if (error.message.includes("VotingPeriodOver")) {
        console.log("\n💡 The voting period for this poll has ended");
      } else if (error.message.includes("InvalidPublicKey")) {
        console.log("\n💡 Invalid public key provided");
      } else if (error.message.includes("TooManyMessages")) {
        console.log("\n💡 Poll has reached maximum message limit");
      } else {
        console.log("Detailed error info:");
        if (error.reason) console.log("Reason:", error.reason);
        if (error.data) console.log("Data:", error.data);
      }
    }

    console.log("\n🚀 Next Steps:");
    console.log("1. Wait for voting period to end");
    console.log("2. Coordinator processes messages and generates proofs");
    console.log("3. Results are tallied and published on-chain");
    console.log("4. Check final results");
  } catch (error) {
    console.error("❌ Error in voting script:", error);
  }
}

main().catch(console.error);

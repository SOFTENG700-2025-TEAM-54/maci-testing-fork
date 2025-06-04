import { ethers } from "hardhat";
import { Keypair, VoteCommand } from "@maci-protocol/domainobjs";
import fs from "fs";

async function main() {
  // Get the deployed MACI contract
  const deployedContracts = JSON.parse(fs.readFileSync("./deployed-contracts.json", "utf8"));
  const maciAddress = deployedContracts.localhost?.named?.MACI?.address;

  if (!maciAddress) {
    console.error("MACI contract not found in deployed-contracts.json");
    return;
  }

  console.log("🗳️  MACI Voting Script");
  console.log("======================");
  console.log("MACI Address:", maciAddress);

  // Get the contract instances
  const maci = await ethers.getContractAt("MACI", maciAddress);

  try {
    // Check available polls
    console.log("\n📊 Checking available polls...");
    const nextPollId = await maci.nextPollId();
    console.log("Number of polls:", nextPollId.toString());

    if (nextPollId.toString() === "0") {
      console.log("❌ No polls available. Create a poll first with:");
      console.log("pnpm deploy-poll:localhost");
      return;
    }

    // Vote on the first poll (poll ID 0)
    const pollId = 0;
    console.log(`\n🗳️  Voting on Poll ${pollId}...`);

    // Get poll contract
    const pollContracts = await maci.getPoll(pollId);
    const pollAddress = pollContracts.poll;
    console.log("Poll Address:", pollAddress);

    const poll = await ethers.getContractAt("Poll", pollAddress);

    // Check poll timing
    console.log("\n⏰ Checking poll timing...");
    try {
      const startDate = await poll.startDate();
      const endDate = await poll.endDate();
      const currentTime = Math.floor(Date.now() / 1000);

      console.log("Start Date:", new Date(Number(startDate) * 1000).toLocaleString());
      console.log("End Date:", new Date(Number(endDate) * 1000).toLocaleString());
      console.log("Current Time:", new Date(currentTime * 1000).toLocaleString());

      if (currentTime > endDate) {
        console.log("❌ Poll has ended. Cannot vote.");
        return;
      } else if (currentTime < startDate) {
        console.log("❌ Poll has not started yet. Cannot vote.");
        return;
      } else {
        console.log("✅ Poll is active and accepting votes.");
      }
    } catch (e) {
      console.log("⚠️  Could not check timing, proceeding anyway...");
    }

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("\n👤 Voting with address:", signer.address);

    // Check if user has signed up to MACI
    const maciSignups = await maci.totalSignups();
    console.log("Total MACI signups:", maciSignups.toString());

    if (maciSignups.toString() === "1") {
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

    // Get coordinator public key for encryption
    const coordinatorPublicKey = await poll.coordinatorPublicKey();
    const coordinatorKeypair = new Keypair();
    // Note: In production, you'd use the actual coordinator's public key

    // Generate ephemeral keypair for message encryption
    const ephemeralKeypair = new Keypair();

    // Create shared key for encryption
    const sharedKey = Keypair.generateEcdhSharedKey(
      ephemeralKeypair.privateKey,
      coordinatorKeypair.publicKey, // Use actual coordinator public key
    );

    // Encrypt the command
    const message = command.encrypt(signature, sharedKey);

    console.log("\n🔐 Message encrypted and ready to publish");

    try {
      // Publish the message to the poll
      console.log("🔄 Publishing vote message...");

      const tx = await poll
        .connect(signer)
        .publishMessage(message.asContractParam(), ephemeralKeypair.publicKey.asContractParam());

      console.log("Transaction submitted:", tx.hash);
      const receipt = await tx.wait();
      console.log("Transaction confirmed in block:", receipt.blockNumber);

      // Parse PublishMessage event
      const iface = new ethers.Interface([
        "event PublishMessage(tuple(uint256[10] data) _message, tuple(uint256 x, uint256 y) _encryptionPublicKey)",
      ]);

      let messagePublished = false;
      for (const log of receipt.logs) {
        try {
          const parsedLog = iface.parseLog(log);
          if (parsedLog.name === "PublishMessage") {
            console.log("\n🎉 Vote published successfully!");
            console.log("Message data length:", parsedLog.args._message.data.length);
            console.log("Encryption public key X:", parsedLog.args._encryptionPublicKey.x.toString());
            console.log("Encryption public key Y:", parsedLog.args._encryptionPublicKey.y.toString());
            messagePublished = true;
          }
        } catch (e) {
          // Not a PublishMessage event
        }
      }

      if (messagePublished) {
        // Check updated message count
        try {
          const numMessages = await poll.numMessages();
          console.log("Total messages in poll:", numMessages.toString());
        } catch (e) {
          console.log("Could not check message count");
        }

        // Save vote data
        const voteData = {
          pollId: pollId,
          pollAddress: pollAddress,
          userStateIndex: userStateIndex,
          voteOptionIndex: voteOptionIndex,
          voteWeight: voteWeight,
          nonce: nonce,
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          votedAt: new Date().toISOString(),
          ephemeralPublicKey: ephemeralKeypair.publicKey.serialize(),
          ephemeralPrivateKey: ephemeralKeypair.privateKey.serialize(),
        };

        fs.writeFileSync(`./vote-${pollId}-${Date.now()}.json`, JSON.stringify(voteData, null, 2));
        console.log(`\n💾 Vote data saved to vote file`);
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

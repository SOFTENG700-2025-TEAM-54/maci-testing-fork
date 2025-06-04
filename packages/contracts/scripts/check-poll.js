import { ethers } from "hardhat";
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

  console.log("🗳️  MACI Poll Inspector");
  console.log("========================");
  console.log("MACI Address:", maciAddress);

  // Get the contract instance
  const maci = await ethers.getContractAt("MACI", maciAddress);

  try {
    // Get basic MACI info
    console.log("\n📊 MACI Overview:");
    const totalSignups = await maci.totalSignups();
    const nextPollId = await maci.nextPollId();
    const stateTreeRoot = await maci.getStateTreeRoot();

    console.log("Total signups:", totalSignups.toString());
    console.log("Next poll ID:", nextPollId.toString());
    console.log("State tree root:", stateTreeRoot.toString());

    if (nextPollId.toString() === "0") {
      console.log("❌ No polls have been created yet.");
      return;
    }

    console.log(`\n🗳️  Found ${nextPollId.toString()} poll(s). Checking details...\n`);

    // Check each poll
    for (let pollId = 0; pollId < nextPollId; pollId++) {
      console.log(`=================== POLL ${pollId} ===================`);

      try {
        // Get poll contracts
        const pollContracts = await maci.getPoll(pollId);
        const pollAddress = pollContracts.poll;
        const messageProcessorAddress = pollContracts.messageProcessor;
        const tallyAddress = pollContracts.tally;

        console.log("📍 Contract Addresses:");
        console.log("  Poll:", pollAddress);
        console.log("  MessageProcessor:", messageProcessorAddress);
        console.log("  Tally:", tallyAddress);

        // Get Poll contract instance
        const poll = await ethers.getContractAt("Poll", pollAddress);

        // Get poll basic info
        console.log("\n⚙️  Poll Configuration:");

        try {
          const coordinatorPublicKey = await poll.coordinatorPublicKey();
          console.log("  Coordinator Public Key:");
          console.log("    X:", coordinatorPublicKey.x.toString());
          console.log("    Y:", coordinatorPublicKey.y.toString());
        } catch (e) {
          console.log("  Coordinator Public Key: Unable to fetch");
        }

        // Try to get tree depths with better error handling
        console.log("  Tree Depths:");
        try {
          const treeDepths = await poll.treeDepths();
          if (treeDepths && typeof treeDepths === "object") {
            console.log("    intStateTreeDepth:", treeDepths.intStateTreeDepth?.toString() || "N/A");
            console.log("    messageTreeDepth:", treeDepths.messageTreeDepth?.toString() || "N/A");
            console.log("    messageTreeSubDepth:", treeDepths.messageTreeSubDepth?.toString() || "N/A");
            console.log("    voteOptionTreeDepth:", treeDepths.voteOptionTreeDepth?.toString() || "N/A");
          } else {
            // Try individual calls if the struct doesn't work
            try {
              const intStateTreeDepth = await poll.getStateTreeDepth();
              const messageTreeDepth = await poll.getMessageTreeDepth();
              const voteOptionTreeDepth = await poll.getVoteOptionTreeDepth();
              console.log("    intStateTreeDepth:", intStateTreeDepth.toString());
              console.log("    messageTreeDepth:", messageTreeDepth.toString());
              console.log("    voteOptionTreeDepth:", voteOptionTreeDepth.toString());
            } catch (e2) {
              console.log("    Tree depths: Unable to fetch individual values");
            }
          }
        } catch (e) {
          console.log("    Tree depths: Unable to fetch");
        }

        // Get batch sizes with error handling
        console.log("  Batch Sizes:");
        try {
          const messageBatchSize = await poll.messageBatchSize();
          console.log("    messageBatchSize:", messageBatchSize.toString());
        } catch (e) {
          console.log("    messageBatchSize: Unable to fetch");
        }

        try {
          const tallyBatchSize = await poll.tallyBatchSize();
          console.log("    tallyBatchSize:", tallyBatchSize.toString());
        } catch (e) {
          console.log("    tallyBatchSize: Unable to fetch");
        }

        // Get timing info
        console.log("\n⏰ Poll Timing:");
        try {
          const startTime = await poll.startTime();
          const duration = await poll.duration();
          const endTime = startTime + duration;
          const currentTime = Math.floor(Date.now() / 1000);

          console.log("  Start Time:", new Date(Number(startTime) * 1000).toLocaleString());
          console.log("  Duration:", Number(duration) / 3600, "hours");
          console.log("  End Time:", new Date(Number(endTime) * 1000).toLocaleString());
          console.log("  Current Time:", new Date(currentTime * 1000).toLocaleString());

          // Determine poll status
          let status;
          if (currentTime < startTime) {
            status = "⏳ Not Started";
          } else if (currentTime >= startTime && currentTime <= endTime) {
            status = "🟢 Active";
          } else {
            status = "🔴 Ended";
          }
          console.log("  Status:", status);
        } catch (e) {
          console.log("  Timing info: Unable to fetch");
        }

        // Get poll activity
        console.log("\n📈 Poll Activity:");
        try {
          const numMessages = await poll.numMessages();
          console.log("  Messages submitted:", numMessages.toString());
        } catch (e) {
          console.log("  Messages submitted: Unable to fetch");
        }

        try {
          const numSignups = await poll.numSignups();
          console.log("  Poll signups:", numSignups.toString());
        } catch (e) {
          console.log("  Poll signups: Unable to fetch");
        }

        // Get state info
        console.log("\n🌳 State Trees:");
        try {
          const currentMessageBatchIndex = await poll.currentMessageBatchIndex();
          console.log("  Current message batch index:", currentMessageBatchIndex.toString());
        } catch (e) {
          console.log("  Current message batch index: Unable to fetch");
        }

        // Check if poll has been processed
        try {
          const messageProcessor = await ethers.getContractAt("MessageProcessor", messageProcessorAddress);
          const processingComplete = await messageProcessor.processingComplete();
          console.log("  Message processing complete:", processingComplete);
        } catch (e) {
          console.log("  Message processing complete: Unable to fetch");
        }

        // Check tally
        try {
          const tallyContract = await ethers.getContractAt("Tally", tallyAddress);
          const tallyingComplete = await tallyContract.tallyingComplete();
          console.log("  Tallying complete:", tallyingComplete);

          // Get results if tally is complete
          if (tallyingComplete) {
            console.log("\n🏆 Results:");
            try {
              const results = await tallyContract.results();
              const totalSpent = await tallyContract.totalSpent();

              console.log("  Vote results:");
              for (let i = 0; i < results.length; i++) {
                console.log(`    Option ${i}: ${results[i].toString()} votes`);
              }
              console.log("  Total voice credits spent:", totalSpent.toString());
            } catch (e) {
              console.log("  Results not yet available");
            }
          }
        } catch (e) {
          console.log("  Tallying complete: Unable to fetch");
        }

        // Get deployed contract info from deployment
        const pollContractKey = `Poll-poll-${pollId}`;
        const messageProcessorKey = `MessageProcessor-poll-${pollId}`;
        const tallyKey = `Tally-poll-${pollId}`;

        if (deployedContracts.localhost?.named?.[pollContractKey]) {
          console.log("\n📋 Deployment Info:");
          console.log("  Poll deployed at:", deployedContracts.localhost.named[pollContractKey].address);
          console.log(
            "  MessageProcessor deployed at:",
            deployedContracts.localhost.named[messageProcessorKey]?.address || "N/A",
          );
          console.log("  Tally deployed at:", deployedContracts.localhost.named[tallyKey]?.address || "N/A");
        }

        console.log("\n" + "=".repeat(50));
      } catch (error) {
        console.error(`❌ Error checking poll ${pollId}:`, error.message);
        // Log more detailed error info
        if (error.data) {
          console.error("Error data:", error.data);
        }
        if (error.reason) {
          console.error("Error reason:", error.reason);
        }
      }
    }

    // Summary
    console.log("\n📝 Summary:");
    console.log(`Total polls created: ${nextPollId.toString()}`);
    console.log(`Total MACI signups: ${totalSignups.toString()}`);

    // Check if ready for voting
    if (totalSignups > 0) {
      console.log("✅ Users can sign up and vote");
    } else {
      console.log("⚠️  No users signed up yet");
    }
  } catch (error) {
    console.error("❌ Error inspecting polls:", error);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
  }
}

main().catch(console.error);

"use strict";

const { WorkloadModuleBase } = require("@hyperledger/caliper-core");
const {
  Keypair,
  VoteCommand,
  PublicKey,
} = require("/home/chris/maci-testing-fork/packages/domainobjs/build/ts/index.js");

class SimpleWorkload extends WorkloadModuleBase {
  async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
    await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
    this.user = new Keypair();

    this.pollId = 0;

    // Add debugging to check poll state
    await this.debugPollState();

    // Get the actual coordinator public key from the contract
    const coordKeyResult = await this.sutAdapter.sendRequests({
      contract: "Poll",
      verb: "coordinatorPublicKey",
      args: [],
      readOnly: true,
    });

    // Use the actual coordinator key from the contract
    this.coordinatorPubKey = new PublicKey([
      BigInt(coordKeyResult.status.result.x),
      BigInt(coordKeyResult.status.result.y),
    ]);

    console.log("Using contract coordinator key:", this.coordinatorPubKey);

    // Check if voting period is active
    const startDate = await this.sutAdapter.sendRequests({
      contract: "Poll",
      verb: "startDate",
      args: [],
      readOnly: true,
    });

    const endDate = await this.sutAdapter.sendRequests({
      contract: "Poll",
      verb: "endDate",
      args: [],
      readOnly: true,
    });

    const currentTime = Math.floor(Date.now() / 1000);
    const pollStart = parseInt(startDate.status.result);
    const pollEnd = parseInt(endDate.status.result);

    console.log(`Poll period: ${pollStart} to ${pollEnd}, current: ${currentTime}`);

    if (currentTime < pollStart) {
      console.warn("Voting period has not started yet!");
    } else if (currentTime > pollEnd) {
      console.warn("Voting period has ended!");
    } else {
      console.log("Voting period is active");
    }

    // Join the poll
    await this.joinPoll();

    console.log(`Worker ${workerIndex} ready`);
  }

  async joinPoll() {
    console.log("=== Joining Poll ===");
    // For now, just skip the actual join since it requires complex proof generation
    // In a real implementation, you'd need to call the contract's joinPoll function
    // with proper proofs
    console.log("Skipping actual poll join - using assumed state index");
    this.stateIndex = 1; // Assume we're at state index 1
    console.log("=== End Join Poll ===");
  }

  async debugPollState() {
    console.log("=== Debugging Poll State ===");

    // Check if poll exists and get basic info
    try {
      const pollInfoRequests = [
        { contract: "Poll", verb: "startDate", args: [], readOnly: true },
        { contract: "Poll", verb: "endDate", args: [], readOnly: true },
        { contract: "Poll", verb: "coordinatorPublicKey", args: [], readOnly: true },
        { contract: "Poll", verb: "numMessages", args: [], readOnly: true },
        { contract: "Poll", verb: "maxSignups", args: [], readOnly: true },
      ];

      for (const request of pollInfoRequests) {
        try {
          const result = await this.sutAdapter.sendRequests(request);
          console.log(`${request.verb}:`, result);
        } catch (error) {
          console.error(`Error getting ${request.verb}:`, error.message);
        }
      }

      // Check current timestamp
      const currentTime = Math.floor(Date.now() / 1000);
      console.log("Current timestamp:", currentTime);
    } catch (error) {
      console.error("Error in debugPollState:", error.message);
    }

    console.log("=== End Poll State Debug ===");
  }

  async submitTransaction() {
    // Try with state index 0 first (might be valid for first user)
    const stateIndex = 0;
    const voteOptionIndex = 0n; // Try vote option 0 instead of 1
    const voteWeight = 1n;
    const nonce = 1n;

    console.log(`Attempting vote with stateIndex: ${stateIndex}, voteOption: ${voteOptionIndex}`);

    const command = new VoteCommand(
      BigInt(stateIndex),
      this.user.publicKey,
      voteOptionIndex,
      voteWeight,
      nonce,
      BigInt(this.pollId),
    );
    const signature = command.sign(this.user.privateKey);

    // 2. Encrypt the command to create the message and ephemeral public key
    const ecdhKeypair = new Keypair();
    console.log("ecdhKeypair.privateKey =", ecdhKeypair.privateKey);
    const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, this.coordinatorPubKey);

    const message = command.encrypt(signature, sharedKey);
    const encryptionPublicKey = ecdhKeypair.publicKey;

    // 3. Convert to contract format
    const messageParam = message.asContractParam();
    const publicKeyParam = encryptionPublicKey.asContractParam();

    console.log("messageParam:", messageParam);
    console.log("publicKeyParam:", publicKeyParam);

    // 4. Prepare the request for Caliper with higher gas limit
    const request = {
      contract: "Poll",
      verb: "publishMessage",
      args: [messageParam, publicKeyParam],
      readOnly: false,
      options: {
        gas: 1000000, // Increased gas limit
        gasPrice: "20000000000", // 20 gwei
      },
    };

    try {
      return await this.sutAdapter.sendRequests(request);
    } catch (error) {
      console.error("publishMessage failed:", error.message);
      throw error;
    }
  }
}

function createWorkloadModule() {
  return new SimpleWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;

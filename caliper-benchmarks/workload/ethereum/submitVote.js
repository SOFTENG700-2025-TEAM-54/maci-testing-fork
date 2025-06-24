"use strict";

const { WorkloadModuleBase } = require("@hyperledger/caliper-core");

// Import MACI SDK modules for generating votes
const { Keypair, PrivateKey, PublicKey } = require("@maci-protocol/domainobjs");
const { generateRandomSalt } = require("@maci-protocol/crypto");
const { generateVote } = require("@maci-protocol/sdk");

class SubmitVoteWorkload extends WorkloadModuleBase {
  /**
   * Initialize the workload module.
   * This method is invoked once per round per worker.
   *
   * @param {number} workerIndex - The 0-based index of the worker.
   * @param {number} totalWorkers - Total number of worker processes.
   * @param {number} roundIndex - The 0-based index of the round.
   * @param {Object} roundArguments - The arguments provided in the benchmark config.
   * @param {BlockchainConnector} sutAdapter - The connector for the blockchain.
   * @param {Object} sutContext - The SUT context containing the benchmark address and web3 instance.
   */
  async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
    // Call the base class implementation to store parameters.
    await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

    // Read workload-specific parameters from roundArguments
    this.pollId = BigInt(roundArguments.pollId || 0);
    this.maxVoteOptions = BigInt(roundArguments.maxVoteOptions || 25);
    this.coordinatorPublicKey = roundArguments.coordinatorPublicKey || null;
    this.maxVoteWeight = BigInt(roundArguments.maxVoteWeight || 100);

    // Generate simulated user data for this worker
    // Each worker will simulate a unique set of users to avoid conflicts
    this.users = [];
    const usersPerWorker = roundArguments.usersPerWorker || 10;

    // Generate users with unique state indices for this worker
    for (let i = 0; i < usersPerWorker; i++) {
      const userIndex = workerIndex * usersPerWorker + i + 1; // +1 to avoid 0 (blank leaf)
      const keypair = new Keypair();

      this.users.push({
        keypair: keypair,
        stateIndex: BigInt(userIndex),
        nonce: 1n, // Start with nonce 1 for first vote
        privateKey: keypair.privateKey,
        publicKey: keypair.publicKey,
      });
    }

    // Parse coordinator public key if provided as string
    if (this.coordinatorPublicKey && typeof this.coordinatorPublicKey === "string") {
      try {
        this.coordinatorPublicKey = PublicKey.deserialize(this.coordinatorPublicKey);
      } catch (error) {
        console.warn("Failed to deserialize coordinator public key, using default");
        // Create a dummy coordinator public key for testing
        this.coordinatorPublicKey = new Keypair().publicKey;
      }
    } else {
      // Create a dummy coordinator public key for testing
      this.coordinatorPublicKey = new Keypair().publicKey;
    }

    console.log(`Worker ${workerIndex} initialized with ${this.users.length} users`);
  }

  /**
   * Submit a single vote transaction.
   * This method is on the hot path and is invoked based on the configured rate controller.
   */
  async submitTransaction() {
    try {
      // Select a random user from this worker's user pool
      const userIndex = Math.floor(Math.random() * this.users.length);
      const user = this.users[userIndex];

      // Generate random vote parameters
      const voteOptionIndex = BigInt(Math.floor(Math.random() * Number(this.maxVoteOptions)));
      const voteWeight = BigInt(Math.floor(Math.random() * Number(this.maxVoteWeight)) + 1);
      const salt = generateRandomSalt();

      // Generate the MACI vote using the SDK
      const vote = generateVote({
        pollId: this.pollId,
        voteOptionIndex: voteOptionIndex,
        salt: salt,
        nonce: user.nonce,
        privateKey: user.privateKey,
        stateIndex: user.stateIndex,
        voteWeight: voteWeight,
        coordinatorPublicKey: this.coordinatorPublicKey,
        maxVoteOption: this.maxVoteOptions,
        newPublicKey: user.publicKey, // Keep same public key (no key change)
      });

      // Increment user's nonce for next vote
      user.nonce += 1n;

      // Build the request settings according to the adapter API
      const request = {
        contract: "Poll",
        readOnly: false,
        verb: "publishMessage",
        args: [
          // Message object - this is the encrypted vote
          vote.message.asContractParam(),
          // Ephemeral public key for ECDH
          vote.ephemeralKeypair.publicKey.asContractParam(),
        ],
        invokerIdentity: "User1", // Use a default identity
      };

      // Submit the transaction using Caliper's adapter
      const responses = await this.sutAdapter.sendRequests(request);

      // Log successful vote for debugging
      if (responses && responses.length > 0 && responses[0].status === "success") {
        console.log(`Vote submitted: User ${user.stateIndex}, Option ${voteOptionIndex}, Weight ${voteWeight}`);
      }

      return responses;
    } catch (error) {
      console.error("Error submitting vote:", error);
      throw error;
    }
  }

  /**
   * Cleanup resources after the round.
   */
  async cleanupWorkloadModule() {
    // Optionally implement cleanup logic.
    console.log("Cleaning up MACI vote workload module");
  }
}

/**
 * Factory function that creates an instance of the workload module.
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
  return new SubmitVoteWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;

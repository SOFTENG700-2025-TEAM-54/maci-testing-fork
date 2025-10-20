"use strict";

const { WorkloadModuleBase } = require("@hyperledger/caliper-core");
const path = require("path");
const { ethers } = require("ethers");

// Load environment variables
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

// Import MACI components from configured paths
const DOMAINOBJS_PATH = process.env.MACI_DOMAINOBJS_PATH || 
  path.resolve(__dirname, "../../../packages/domainobjs/build/ts/index.js");

const { Keypair, VoteCommand, PublicKey, PrivateKey } = require(DOMAINOBJS_PATH);

// Configuration
const CONFIG = {
  workerPrivateKeys: process.env.WORKER_PRIVATE_KEYS 
    ? process.env.WORKER_PRIVATE_KEYS.split(",") 
    : [],
  pollId: parseInt(process.env.BENCHMARK_POLL_ID || "0", 10),
  maxRetries: 3,
  retryDelay: 1000, // ms
};

/**
 * SimpleWorkload - Handles MACI vote submission benchmark
 * 
 * This workload module manages the submission of encrypted votes to a MACI Poll contract.
 * It handles worker initialization, poll state verification, and vote message creation.
 */
class SimpleWorkload extends WorkloadModuleBase {
  /**
   * Initialize the workload module for a specific worker
   * @param {number} workerIndex - Index of the current worker
   * @param {number} totalWorkers - Total number of workers
   * @param {number} roundIndex - Current round index
   * @param {object} roundArguments - Arguments for the current round
   * @param {object} sutAdapter - System Under Test adapter
   * @param {object} sutContext - System Under Test context
   */
  async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
    await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
    
    try {
      // Validate worker private keys configuration
      if (CONFIG.workerPrivateKeys.length === 0) {
        throw new Error("No worker private keys configured. Please set WORKER_PRIVATE_KEYS in .env file");
      }

      // Initialize worker identity
      const privKey = CONFIG.workerPrivateKeys[workerIndex % CONFIG.workerPrivateKeys.length];
      const wallet = new ethers.Wallet(privKey);
      this.ethAddress = wallet.address;
      this.ethPrivateKey = privKey;
      this.user = new Keypair(new PrivateKey(privKey));
      
      console.log(`[Worker ${workerIndex}] Initialized with address: ${this.ethAddress}`);

      this.pollId = CONFIG.pollId;

      // Debug poll state
      await this.debugPollState();

      // Fetch coordinator public key from contract
      await this.fetchCoordinatorPublicKey();

      // Verify voting period is active
      await this.verifyVotingPeriod();

      // Join the poll (simplified for benchmark)
      await this.joinPoll();

      console.log(`[Worker ${workerIndex}] Initialization complete`);
    } catch (error) {
      console.error(`[Worker ${workerIndex}] Initialization failed:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch the coordinator public key from the Poll contract
   */
  async fetchCoordinatorPublicKey() {
    try {
      const coordKeyResult = await this.sutAdapter.sendRequests({
        contract: "Poll",
        verb: "coordinatorPublicKey",
        args: [],
        readOnly: true,
      });

      this.coordinatorPubKey = new PublicKey([
        BigInt(coordKeyResult.status.result.x),
        BigInt(coordKeyResult.status.result.y),
      ]);

      console.log(`Coordinator public key retrieved: (${coordKeyResult.status.result.x}, ${coordKeyResult.status.result.y})`);
    } catch (error) {
      console.error("Failed to fetch coordinator public key:", error.message);
      throw error;
    }
  }

  /**
   * Verify that the voting period is currently active
   */
  async verifyVotingPeriod() {
    try {
      const [startDateResult, endDateResult] = await Promise.all([
        this.sutAdapter.sendRequests({
          contract: "Poll",
          verb: "startDate",
          args: [],
          readOnly: true,
        }),
        this.sutAdapter.sendRequests({
          contract: "Poll",
          verb: "endDate",
          args: [],
          readOnly: true,
        }),
      ]);

      const currentTime = Math.floor(Date.now() / 1000);
      const pollStart = parseInt(startDateResult.status.result, 10);
      const pollEnd = parseInt(endDateResult.status.result, 10);

      console.log(`Voting period: ${new Date(pollStart * 1000).toISOString()} to ${new Date(pollEnd * 1000).toISOString()}`);
      console.log(`Current time: ${new Date(currentTime * 1000).toISOString()}`);

      if (currentTime < pollStart) {
        throw new Error("Voting period has not started yet");
      } else if (currentTime > pollEnd) {
        throw new Error("Voting period has ended");
      }
      
      console.log("Voting period is active ✓");
    } catch (error) {
      console.error("Voting period verification failed:", error.message);
      throw error;
    }
  }

  /**
   * Join the poll (simplified for benchmarking purposes)
   * Note: In production, this would require proper zero-knowledge proof generation
   */
  async joinPoll() {
    console.log("Joining poll (simplified mode for benchmarking)");
    // Simplified join - assumes state index 1
    // In production, this would require calling contract's joinPoll with proper ZK proofs
    this.stateIndex = 1;
    console.log(`Assigned state index: ${this.stateIndex}`);
  }

  /**
   * Debug poll state by fetching and logging key information
   */
  async debugPollState() {
    console.log("Fetching poll state information...");

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
        const value = result.status?.result || result;
        console.log(`  ${request.verb}:`, typeof value === "object" ? JSON.stringify(value) : value);
      } catch (error) {
        console.warn(`  ${request.verb}: Error - ${error.message}`);
      }
    }

    console.log(`  Current timestamp: ${Math.floor(Date.now() / 1000)}`);
  }

  /**
   * Submit a vote transaction to the MACI Poll contract
   * Creates an encrypted vote message and publishes it
   * @returns {Promise} - Transaction result from Caliper
   */
  async submitTransaction() {
    try {
      // Vote parameters
      const stateIndex = 0;
      const voteOptionIndex = 0n;
      const voteWeight = 1n;
      const nonce = 1n;

      console.log(`Submitting vote: stateIndex=${stateIndex}, voteOption=${voteOptionIndex}, weight=${voteWeight}`);

      // Create vote command
      const command = new VoteCommand(
        BigInt(stateIndex),
        this.user.publicKey,
        voteOptionIndex,
        voteWeight,
        nonce,
        BigInt(this.pollId),
      );

      // Sign the command
      const signature = command.sign(this.user.privateKey);

      // Generate ephemeral keypair for encryption
      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(
        ecdhKeypair.privateKey, 
        this.coordinatorPubKey
      );

      // Encrypt the message
      const message = command.encrypt(signature, sharedKey);
      const encryptionPublicKey = ecdhKeypair.publicKey;

      // Convert to contract-compatible format
      const messageParam = message.asContractParam();
      const publicKeyParam = encryptionPublicKey.asContractParam();

      // Prepare transaction request
      const request = {
        contract: "Poll",
        verb: "publishMessage",
        args: [messageParam, publicKeyParam],
        readOnly: false,
        options: {
          from: this.ethAddress,
          signingCredential: {
            key: this.ethPrivateKey,
            type: "privateKeyHex",
          },
        },
      };

      // Submit transaction with retry logic
      return await this.submitWithRetry(request);
    } catch (error) {
      console.error("Vote submission failed:", error.message);
      throw error;
    }
  }

  /**
   * Submit a request with retry logic for transient failures
   * @param {object} request - The request to submit
   * @param {number} retries - Number of retries remaining
   * @returns {Promise} - Transaction result
   */
  async submitWithRetry(request, retries = CONFIG.maxRetries) {
    try {
      return await this.sutAdapter.sendRequests(request);
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        console.warn(`Transaction failed, retrying... (${retries} attempts left)`);
        await this.sleep(CONFIG.retryDelay);
        return this.submitWithRetry(request, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Determine if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} - True if error is retryable
   */
  isRetryableError(error) {
    const retryableMessages = [
      "network timeout",
      "connection refused",
      "ETIMEDOUT",
      "ECONNRESET",
      "nonce too low",
    ];
    return retryableMessages.some(msg => 
      error.message?.toLowerCase().includes(msg.toLowerCase())
    );
  }

  /**
   * Sleep for a specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} - Resolves after sleep duration
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create workload module instance
 * @returns {SimpleWorkload} - New workload instance
 */
function createWorkloadModule() {
  return new SimpleWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;

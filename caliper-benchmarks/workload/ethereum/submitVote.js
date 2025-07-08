"use strict";

const { WorkloadModuleBase } = require("@hyperledger/caliper-core");
const { Keypair, VoteCommand, Signature, PublicKey } = require("@maci-protocol/domainobjs");

class SimpleWorkload extends WorkloadModuleBase {
  async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
    await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
    this.user = new Keypair();

    // Create a coordinator keypair and use its public key
    // This ensures we have a properly formatted PublicKey object
    const coordinatorKeypair = new Keypair();
    this.coordinatorPubKey = coordinatorKeypair.publicKey;

    // Alternative: if you need specific coordinates, create from raw values
    // const x = BigInt("17392661484204959496580930106764958207212644848109387083812297145285218954");
    // const y = BigInt("21089223111864377026700862467117778108729938232933496112109095249769709832");
    // this.coordinatorPubKey = new PublicKey([x, y]);

    console.log("coordinatorPubKey =", this.coordinatorPubKey);

    this.pollId = 0;
    console.log(`Worker ${workerIndex} ready`);
  }

  async submitTransaction() {
    // 1. Create the VoteCommand
    const stateIndex = 1; // Use 1 instead of 0 - stateIndex 0 is usually reserved
    const voteOptionIndex = 1n;
    const voteWeight = 1n;
    const nonce = 1n; // Start with nonce 1

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

    return this.sutAdapter.sendRequests(request);
  }
}

function createWorkloadModule() {
  return new SimpleWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;

"use strict";

const { WorkloadModuleBase } = require("@hyperledger/caliper-core");

class SimpleWorkload extends WorkloadModuleBase {
  async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
    await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
    console.log(`Worker ${workerIndex} ready`);
  }

  async submitTransaction() {
    // Message struct: { data: uint256[10] }
    const message = {
      data: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    };

    // PublicKey struct: { x: uint256, y: uint256 }
    const publicKey = {
      x: "12345678901234567890",
      y: "98765432109876543210",
    };

    const request = {
      contract: "Poll",
      readOnly: false,
      verb: "publishMessage",
      args: [message, publicKey],
    };

    return this.sutAdapter.sendRequests(request);
  }
}

function createWorkloadModule() {
  return new SimpleWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;

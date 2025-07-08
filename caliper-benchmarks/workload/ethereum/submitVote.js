"use strict";

const { WorkloadModuleBase } = require("@hyperledger/caliper-core");
const Web3 = require("web3");

class SimpleWorkload extends WorkloadModuleBase {
  async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
    await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
    this.web3 = new Web3(); // Local instance for ABI encoding
    console.log(`Worker ${workerIndex} ready`);
  }

  async submitTransaction() {
    // The contract expects:
    // 1. tuple { data: uint256[10] }
    // 2. tuple { x: uint256, y: uint256 }

    const message = {
      data: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    };

    const publicKey = {
      x: "12345678901234567890",
      y: "98765432109876543210",
    };

    const request = {
      contract: "Poll",
      verb: "publishMessage",
      args: [message, publicKey],
      readOnly: false,
    };

    return this.sutAdapter.sendRequests(request);
  }
}

function createWorkloadModule() {
  return new SimpleWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;

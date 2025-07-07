"use strict";

const { WorkloadModuleBase } = require("@hyperledger/caliper-core");

class SimpleWorkload extends WorkloadModuleBase {
  async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
    await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
    console.log(`Worker ${workerIndex} ready`);
  }

  async submitTransaction() {
    const request = {
      contract: "Poll",
      readOnly: false,
      verb: "publishMessage",
      args: [123, 456], // dummy data matching Message & PublicKey calldata
      invokerIdentity: "User1",
    };

    return this.sutAdapter.sendRequests(request);
  }
}

function createWorkloadModule() {
  return new SimpleWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;

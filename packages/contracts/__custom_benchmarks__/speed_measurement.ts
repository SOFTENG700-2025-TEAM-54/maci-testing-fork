/* eslint-disable no-console */
import { EMode, MaciState, VOTE_OPTION_TREE_ARITY } from "@maci-protocol/core";
import { Keypair, Message, PublicKey, VoteCommand } from "@maci-protocol/domainobjs";

import { hash } from "crypto";
import fs, { existsSync, mkdirSync, rmdirSync } from "fs";

import { Proof, ProofGenerator } from "../ts";

import { loadCircuitInputs, saveCircuitInputs } from "./circuitToJson";

export const VOICE_CREDIT_BALANCE = 1n;
export const DURATION = 30;
export const MESSAGE_BATCH_SIZE = 50;
export const COORDINATOR_KEYPAIR = new Keypair();
export const STATE_TREE_DEPTH = 20;

export const TREE_DEPTHS = {
  tallyProcessingStateTreeDepth: 4,
  voteOptionTreeDepth: 2,
  stateTreeDepth: STATE_TREE_DEPTH,
};
export const MAX_VOTE_OPTIONS = BigInt(VOTE_OPTION_TREE_ARITY ** TREE_DEPTHS.voteOptionTreeDepth);

const mode = EMode.FULL;
const mpId = `MessageProcessorFull_${STATE_TREE_DEPTH}-${MESSAGE_BATCH_SIZE}-${TREE_DEPTHS.voteOptionTreeDepth}_test`;
const vtId = `VoteTallyNonQv_${STATE_TREE_DEPTH}-${TREE_DEPTHS.tallyProcessingStateTreeDepth}-${TREE_DEPTHS.voteOptionTreeDepth}_test`;
const mpZkey = `../testing/zkeys/${mpId}/${mpId}.0.zkey`;
const tvZkey = `../testing/zkeys/${vtId}/${vtId}.0.zkey`;
const mpWasm = `../testing/zkeys/${mpId}/${mpId}_js/${mpId}.wasm`;
const vtWasm = `../testing/zkeys/${vtId}/${vtId}_js/${vtId}.wasm`;

const TIMERS = {
  TOTAL_TIME: "TOTAL_TIME",
  SIGN_UP: "SIGN_UP",
  DEPLOY_POLL: "DEPLOY_POLL",
  UPDATE_POLL: "UPDATE_POLL",
  JOIN_POLL: "JOIN_POLL",
  TOTAL_VALID_VOTES: "TOTAL_VALID_VOTES",
  TOTAL_INVALID_VOTES: "TOTAL_INVALID_VOTES",
  PROCESS_MESSAGES: "PROCESS_MESSAGES",
  TALLY_RESULTS: "TALLY_RESULTS",
  MP_PROOFS: "MP_PROOFS",
  SAVE_MACI_STATE: "SAVE_MACI_STATE",
  LOAD_MACI_STATE: "LOAD_MACI_STATE",
  SAVE_CIRCUIT_INPUTS: "SAVE_CIRCUIT_INPUTS",
  LOAD_CIRCUIT_INPUTS: "LOAD_CIRCUIT_INPUTS",
  PREPARING_VALID_VOTES: "PREPARING_VALID_VOTES",
  VALIDATE_PROOFS: "VALIDATE_PROOFS",
  TALLY_PROOFS: "TALLY_PROOFS",
};

let timerStart: Record<string, [number, number] | undefined> = {};
let timerDiffS: Record<string, number | undefined> = {};
const timerResultsS: Record<string, unknown> = {};
function startTimer(name: string) {
  if (timerStart[name]) {
    throw new Error(`Timer with name ${name} already exists.`);
  }
  timerStart[name] = process.hrtime();
}

function endTimer(name: string, displayName?: string) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!timerStart[name]) {
    throw new Error(`Timer with name ${name} does not exist.`);
  }
  if (timerDiffS[name]) {
    throw new Error(`Timer with name ${name} has already been ended.`);
  }
  const diff = process.hrtime(timerStart[name]);
  const timeMs = diff[0] * 1e3 + diff[1] / 1e6; // Convert to milliseconds
  timerDiffS[name] = timeMs / 1e3;
  console.log(`${displayName || name} took ${timeMs.toFixed(3)} ms (${diff[0]}s ${diff[1] / 1e6}ms)\n`);
}

function saveTimerResult(numUsers: number, numInvalidVotes: number) {
  const runName = `${numUsers}_users_${numInvalidVotes}_invalid_votes`;
  timerResultsS[runName] = {
    data: {
      numUsers,
      numInvalidVotes,
      maxVoteOptions: Number(MAX_VOTE_OPTIONS),
      treeDepths: TREE_DEPTHS,
    },
    ...timerDiffS,
  };
  console.log(`Timer results for run "${runName}":`, timerResultsS[runName]);
  timerStart = {}; // Reset the timerStart for the next run
  timerDiffS = {}; // Reset the timerDiff for the next run
}

function saveTimerResults() {
  const profileName = `Profile_${new Date().toISOString()}`;
  fs.writeFileSync(`./${profileName}.json`, JSON.stringify(timerResultsS, null, 2));
}

async function runProfile(numUsers: number, numInvalidVotes: number) {
  if (existsSync("./bench_proofs")) {
    console.log("Removing existing bench_proofs directory...");
    rmdirSync("./bench_proofs", { recursive: true });
  }
  mkdirSync("./bench_proofs");
  startTimer(TIMERS.TOTAL_TIME);
  const users: Keypair[] = [];

  const maciState = new MaciState(STATE_TREE_DEPTH);

  console.log("Signing up users...");
  startTimer(TIMERS.SIGN_UP);
  // Sign up and vote
  for (let i = 0; i < numUsers; i += 1) {
    const userKeypair = new Keypair();
    users.push(userKeypair);
    maciState.signUp(userKeypair.publicKey);
  }
  endTimer(TIMERS.SIGN_UP, "Total sign up time");

  console.log("Deploying poll...");
  startTimer(TIMERS.DEPLOY_POLL);
  const pollId = maciState.deployPoll(
    BigInt(Math.floor(Date.now() / 1000) + DURATION),
    TREE_DEPTHS,
    MESSAGE_BATCH_SIZE,
    COORDINATOR_KEYPAIR,
    MAX_VOTE_OPTIONS,
    mode,
  );
  endTimer(TIMERS.DEPLOY_POLL, `Deploy poll with ID ${pollId}`);

  console.log("Updating poll...");
  startTimer(TIMERS.UPDATE_POLL);
  const poll = maciState.polls.get(pollId)!;
  poll.updatePoll(BigInt(maciState.publicKeys.length));
  endTimer(TIMERS.UPDATE_POLL, `Update poll with ID ${pollId}`);

  console.log("Joining poll...");
  startTimer(TIMERS.JOIN_POLL);
  for (let i = 0; i < numUsers; i += 1) {
    const user = users[i];
    const privateKeyHash = hash("sha256", user.privateKey.raw.toString());
    // Convert the privateKeyHash (Buffer) to a bigint
    const privateKeyHashBigInt = BigInt(`0x${privateKeyHash}`);
    poll.joinPoll(privateKeyHashBigInt, user.publicKey, VOICE_CREDIT_BALANCE);
  }
  endTimer(TIMERS.JOIN_POLL, `Join poll with ID ${pollId}`);

  startTimer(TIMERS.PREPARING_VALID_VOTES);
  const messages: {
    message: Message;
    ecdhPublicKey: PublicKey;
  }[] = [];
  for (let i = 0; i < numUsers; i += 1) {
    const userKeypair = users[i];

    const voteWeight = VOICE_CREDIT_BALANCE;
    const command = new VoteCommand(
      BigInt(i + 1), // +1 because there is a padding user with index 0
      userKeypair.publicKey,
      BigInt(0), // vote option index
      voteWeight,
      1n,
      BigInt(pollId),
    );

    const signature = command.sign(userKeypair.privateKey);

    const ecdhKeypair = new Keypair();
    const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, COORDINATOR_KEYPAIR.publicKey);
    const message = command.encrypt(signature, sharedKey);
    messages.push({ message, ecdhPublicKey: ecdhKeypair.publicKey });
  }
  endTimer(TIMERS.PREPARING_VALID_VOTES, "Preparing valid votes");

  console.log("Publishing valid votes...");
  startTimer(TIMERS.TOTAL_VALID_VOTES);
  messages.forEach((message) => {
    poll.publishMessage(message.message, message.ecdhPublicKey);
  });
  endTimer(TIMERS.TOTAL_VALID_VOTES, "Total valid votes time");

  // startTimer(TIMERS.TOTAL_INVALID_VOTES);
  // for (let i = 0; i < numInvalidVotes; i += 1) {
  //   const userIndex = i % numUsers;
  //   const userKeypair = users[userIndex]; // Use modulo to avoid index out of bounds
  //   const command = new VoteCommand(
  //     BigInt(userIndex + 1),
  //     userKeypair.publicKey,
  //     1n,
  //     VOICE_CREDIT_BALANCE * 2n, // invalid vote weight
  //     1n,
  //     BigInt(pollId),
  //   );

  //   const signature = command.sign(userKeypair.privateKey);

  //   const ecdhKeypair = new Keypair();
  //   const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, COORDINATOR_KEYPAIR.publicKey);
  //   const message = command.encrypt(signature, sharedKey);
  //   poll.publishMessage(message, ecdhKeypair.publicKey);
  // }
  // endTimer(TIMERS.TOTAL_INVALID_VOTES, "Total invalid votes time");

  console.log("Processing all messages...");
  startTimer(TIMERS.PROCESS_MESSAGES);
  poll.processAllMessages();
  endTimer(TIMERS.PROCESS_MESSAGES, `Process all messages`);

  if (poll.ballots.length !== numUsers + 1) {
    throw new Error(`Expected ${numUsers + 1} ballots, but got ${poll.ballots.length}`);
  }

  // startTimer(TIMERS.TALLY_RESULTS);
  // while (poll.hasUntalliedBallots()) {
  //   poll.tallyVotes();
  // }
  // if (poll.tallyResult[0] !== BigInt(numUsers)) {
  //   throw new Error(`Expected tally result to be ${numUsers}, but got ${poll.tallyResult[0]}`);
  // }

  // endTimer(TIMERS.TALLY_RESULTS, `Tally results for poll ${pollId}`);

  // ---------------------------------------------------
  // 🆕  PROOF GENERATION BENCH SECTION
  // ---------------------------------------------------
  console.log("Generating ZK proofs...");

  startTimer(TIMERS.MP_PROOFS);

  const proofGen = new ProofGenerator({
    poll,
    maciContractAddress: "0x0000000000000000000000000000000000000000",
    tallyContractAddress: "0x0000000000000000000000000000000000000000",
    outputDir: "./bench_proofs",
    tallyOutputFile: "./bench_proofs/tally.json",
    rapidsnark: process.env.RAPIDSNARK, // or undefined to fall back to snarkjs
    mode,
    messageProcessor: { zkey: mpZkey, wasm: mpWasm },
    tally: { zkey: tvZkey, wasm: vtWasm },
  });

  await proofGen.generateMpProofs(); // message-processing proofs
  endTimer(TIMERS.MP_PROOFS, "MP proof gen");

  startTimer(TIMERS.SAVE_CIRCUIT_INPUTS);
  const circuitInputsMem = proofGen.generateTallyCircuitInputs();
  saveCircuitInputs(circuitInputsMem, "./bench_proofs/circuit-inputs.json");
  endTimer(TIMERS.SAVE_CIRCUIT_INPUTS, "Save circuit inputs");

  startTimer(TIMERS.LOAD_CIRCUIT_INPUTS);
  const circuitInputs = loadCircuitInputs("./bench_proofs/circuit-inputs.json");
  endTimer(TIMERS.LOAD_CIRCUIT_INPUTS, "Load circuit inputs");

  function computeBatchBounds(total: number, numMachines: number): [number, number][] {
    // Never create more batches than we have work for
    const batches = Math.min(numMachines, total);

    const base = Math.floor(total / batches); // minimum size per batch
    const extra = total % batches; // first `extra` batches take one more
    const bounds: [number, number][] = [];

    let cursor = 0;
    for (let i = 0; i < batches; i += 1) {
      const size = base + (i < extra ? 1 : 0);
      bounds.push([cursor, cursor + size]);
      cursor += size;
    }
    return bounds;
  }

  const NUM_MACHINES = [1, 2, 4, 8, 16, 32];
  let proofs: Proof[] = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const numMachines of NUM_MACHINES) {
    proofs = [];

    // Pre-compute batch boundaries
    const bounds = computeBatchBounds(circuitInputs.length, numMachines);

    for (let i = 0; i < bounds.length; i += 1) {
      const [start, end] = bounds[i];
      const tallyCircuitInputs = circuitInputs.slice(start, end);
      startTimer(`TALLY_PROOFS_MACHINES_${numMachines}_BATCH_${i}_NUM_INPUTS_${tallyCircuitInputs.length}`);

      // eslint-disable-next-line no-await-in-loop
      const proofBatch = await proofGen.generateProofsForCircuitInputs(tallyCircuitInputs);
      proofs.push(...proofBatch);

      endTimer(
        `TALLY_PROOFS_MACHINES_${numMachines}_BATCH_${i}_NUM_INPUTS_${tallyCircuitInputs.length}`,
        `Tally proofs for ${numMachines} machines batch ${i}`,
      );
    }
  }

  startTimer(TIMERS.VALIDATE_PROOFS);
  await proofGen.validateProofs("benchmark", proofs, circuitInputs[circuitInputs.length - 1]);
  endTimer(TIMERS.VALIDATE_PROOFS, "Tally proof gen");

  endTimer(TIMERS.TOTAL_TIME, "Total time for the profile run");
  saveTimerResult(numUsers, numInvalidVotes);
}

async function runBenchmarks() {
  try {
    // await runProfile(5, 0);
    // await runProfile(10, 0);
    // await runProfile(20, 0);
    // await runProfile(50, 0);
    // await runProfile(100, 0);
    // await runProfile(200, 0);
    // await runProfile(400, 0);
    // await runProfile(800, 0);
    // await runProfile(1600, 0);
    await runProfile(3200, 0);
    // await runProfile(6400, 0);
  } finally {
    saveTimerResults();
  }
}

runBenchmarks();

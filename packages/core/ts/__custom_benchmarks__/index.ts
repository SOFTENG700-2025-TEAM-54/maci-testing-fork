/* eslint-disable no-console */
import { Keypair, VoteCommand } from "@maci-protocol/domainobjs";

import { hash } from "crypto";
import fs from "fs";

import { EMode, MaciState, VOTE_OPTION_TREE_ARITY } from "..";

export const VOICE_CREDIT_BALANCE = 1n;
export const DURATION = 30;
export const MESSAGE_BATCH_SIZE = 5;
export const COORDINATOR_KEYPAIR = new Keypair();
export const STATE_TREE_DEPTH = 10;

export const TREE_DEPTHS = {
  tallyProcessingStateTreeDepth: 3,
  voteOptionTreeDepth: 2,
  stateTreeDepth: 20,
};
export const MAX_VOTE_OPTIONS = BigInt(VOTE_OPTION_TREE_ARITY ** TREE_DEPTHS.voteOptionTreeDepth);

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
      maxVoteOptions: MAX_VOTE_OPTIONS,
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

function runProfile(numUsers: number, numInvalidVotes: number) {
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
    EMode.FULL,
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

  console.log("Publishing valid votes...");
  startTimer(TIMERS.TOTAL_VALID_VOTES);
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

    poll.publishMessage(message, ecdhKeypair.publicKey);
  }
  endTimer(TIMERS.TOTAL_VALID_VOTES, "Total valid votes time");

  console.log("Publishing invalid votes...");

  startTimer(TIMERS.TOTAL_INVALID_VOTES);
  for (let i = 0; i < numInvalidVotes; i += 1) {
    const userIndex = i % numUsers;
    const userKeypair = users[userIndex]; // Use modulo to avoid index out of bounds
    const command = new VoteCommand(
      BigInt(userIndex + 1),
      userKeypair.publicKey,
      1n,
      VOICE_CREDIT_BALANCE * 2n, // invalid vote weight
      1n,
      BigInt(pollId),
    );

    const signature = command.sign(userKeypair.privateKey);

    const ecdhKeypair = new Keypair();
    const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, COORDINATOR_KEYPAIR.publicKey);
    const message = command.encrypt(signature, sharedKey);
    poll.publishMessage(message, ecdhKeypair.publicKey);
  }
  endTimer(TIMERS.TOTAL_INVALID_VOTES, "Total invalid votes time");

  console.log("Processing all messages...");
  startTimer(TIMERS.PROCESS_MESSAGES);
  poll.processAllMessages();
  endTimer(TIMERS.PROCESS_MESSAGES, `Process all messages`);

  if (poll.ballots.length !== numUsers + 1) {
    throw new Error(`Expected ${numUsers + 1} ballots, but got ${poll.ballots.length}`);
  }

  startTimer(TIMERS.TALLY_RESULTS);
  while (poll.hasUntalliedBallots()) {
    poll.tallyVotes();
  }
  if (poll.tallyResult[0] !== BigInt(numUsers)) {
    throw new Error(`Expected tally result to be ${numUsers}, but got ${poll.tallyResult[0]}`);
  }

  endTimer(TIMERS.TALLY_RESULTS, `Tally results for poll ${pollId}`);
  endTimer(TIMERS.TOTAL_TIME, "Total time for the profile run");
  saveTimerResult(numUsers, numInvalidVotes);
}

// runProfile(5, 0);
// runProfile(10, 0);
// runProfile(20, 0);
// runProfile(50, 0);
// runProfile(100, 0);
// runProfile(200, 0);
// runProfile(400, 0);
// runProfile(800, 0);
runProfile(1600, 0);
// runProfile(3200, 0);
saveTimerResults();

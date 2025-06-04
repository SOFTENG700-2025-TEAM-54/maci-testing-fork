/* eslint-disable no-console */
import { Keypair, VoteCommand } from "@maci-protocol/domainobjs";

import { hash } from "crypto";

import { EMode, MaciState, VOTE_OPTION_TREE_ARITY } from "..";

export const VOICE_CREDIT_BALANCE = 1n;
export const DURATION = 30;
export const MESSAGE_BATCH_SIZE = 5;
export const NUM_USERS = 100;
export const COORDINATOR_KEYPAIR = new Keypair();
export const STATE_TREE_DEPTH = 10;

export const MAX_VALUES = {
  maxUsers: 25,
};

export const TREE_DEPTHS = {
  tallyProcessingStateTreeDepth: 3,
  voteOptionTreeDepth: 2,
  stateTreeDepth: 10,
};
export const MAX_VOTE_OPTIONS = BigInt(VOTE_OPTION_TREE_ARITY ** TREE_DEPTHS.voteOptionTreeDepth);

const TIMERS = {
  NEW_MACI_STATE: "NEW_MACI_STATE",
  TOTAL_SIGN_UP: "TOTAL_SIGN_UP",
  SIGN_UP: "SIGN_UP",
  DEPLOY_POLL: "DEPLOY_POLL",
  UPDATE_POLL: "UPDATE_POLL",
  TOTAL_VALID_VOTES: "TOTAL_VALID_VOTES",
  VALID_VOTE: "VALID_VOTE",
  TOTAL_INVALID_VOTES: "TOTAL_INVALID_VOTES",
  INVALID_VOTE: "INVALID_VOTE",
  PROCESS_MESSAGES: "PROCESS_MESSAGES",
};

const timers: Record<string, [number, number]> = {};
function startTimer(name: string) {
  timers[name] = process.hrtime();
}

function endTimer(name: string, displayName?: string) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!timers[name]) {
    throw new Error(`Timer with name ${name} does not exist.`);
  }
  const diff = process.hrtime(timers[name]);
  const timeMs = diff[0] * 1e6 + diff[1] / 1e3; // Convert to milliseconds
  console.log(`${displayName || name} took ${timeMs.toFixed(3)} ms (${diff[0]}s ${diff[1] / 1e6}ms)`);
}

function runProfile() {
  const users: Keypair[] = [];

  console.log("Initializing MACI state...");
  startTimer(TIMERS.NEW_MACI_STATE);
  const maciState = new MaciState(STATE_TREE_DEPTH);
  endTimer(TIMERS.NEW_MACI_STATE, "MaciState initialization");
  console.log("MaciState initialized.\n");

  console.log("Public keys before signing up users: ", maciState.publicKeys.length);
  console.log("Signing up users...");
  startTimer(TIMERS.TOTAL_SIGN_UP);
  // Sign up and vote
  for (let i = 0; i < NUM_USERS; i += 1) {
    startTimer(TIMERS.SIGN_UP);
    const userKeypair = new Keypair();
    users.push(userKeypair);
    maciState.signUp(userKeypair.publicKey);
    endTimer(TIMERS.SIGN_UP, `Sign up user ${i}`);
  }
  endTimer(TIMERS.TOTAL_SIGN_UP, "Total sign up time");
  console.log("Public keys after signing up users: ", maciState.publicKeys.length);
  console.log("Users signed up.\n");

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
  console.log(`Poll deployed with ID ${pollId}.\n`);

  console.log("Updating poll...");
  startTimer(TIMERS.UPDATE_POLL);
  const poll = maciState.polls.get(pollId)!;
  console.log("Number of public keys:", maciState.publicKeys.length);
  poll.updatePoll(BigInt(maciState.publicKeys.length));
  endTimer(TIMERS.UPDATE_POLL, `Update poll with ID ${pollId}`);
  console.log(`Poll with ID ${pollId} updated.\n`);

  for (let i = 0; i < NUM_USERS; i += 1) {
    const user = users[i];
    const privateKeyHash = hash("sha256", user.privateKey.raw.toString());
    // Convert the privateKeyHash (Buffer) to a bigint
    const privateKeyHashBigInt = BigInt(`0x${privateKeyHash}`);
    poll.joinPoll(privateKeyHashBigInt, user.publicKey, VOICE_CREDIT_BALANCE);
  }

  console.log("Publishing valid votes...");
  startTimer(TIMERS.TOTAL_VALID_VOTES);
  for (let i = 0; i < NUM_USERS; i += 1) {
    startTimer(TIMERS.VALID_VOTE);
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

    // Debugging: Log the message being published
    // console.log(`Publishing message for user ${i}:`, message);

    poll.publishMessage(message, ecdhKeypair.publicKey);
    endTimer(TIMERS.VALID_VOTE, `Publish valid vote for user ${i}`);
  }
  endTimer(TIMERS.TOTAL_VALID_VOTES, "Total valid votes time");
  console.log("Valid votes published.\n");

  console.log("Processing all messages...");
  startTimer(TIMERS.PROCESS_MESSAGES);
  poll.processAllMessages();
  endTimer(TIMERS.PROCESS_MESSAGES, `Process all messages`);
  console.log("Messages processed.\n");

  // Debugging: Log the ballots after processing
  // console.log("Ballots after processing messages:", result.ballots);

  console.log("Profile completed.\n");

  if (poll.ballots.length !== NUM_USERS + 1) {
    throw new Error(`Expected ${NUM_USERS + 1} ballots, but got ${poll.ballots.length}`);
  }

  while (poll.hasUntalliedBallots()) {
    poll.tallyVotes();
  }
  console.log("TallyVotes processed:", poll.tallyResult);
}

runProfile();

import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

// Helper function to run commands and handle output
async function runCommand(command, description, cwd = process.cwd()) {
  console.log(`\n🚀 ${description}`);
  console.log(`📝 Running: ${command}`);
  console.log("=".repeat(60));

  try {
    const { stdout, stderr } = await execAsync(command, { cwd });

    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error("⚠️ Warnings/Errors:", stderr);
    }

    console.log(`✅ ${description} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    if (error.stdout) console.log("STDOUT:", error.stdout);
    if (error.stderr) console.error("STDERR:", error.stderr);
    return false;
  }
}

// Helper function to wait/sleep
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("🎯 MACI Full End-to-End Flow");
  console.log("=============================");
  console.log("This script will run the complete MACI workflow:");
  console.log("1. Load coordinator keys from testing_setup.json");
  console.log("2. Deploy MACI contracts");
  console.log("3. Sign up a user");
  console.log("4. Update poll times");
  console.log("5. Deploy a poll");
  console.log("6. Check poll status");
  console.log("7. Submit a vote");
  console.log();

  try {
    // Step 0: Load coordinator keys from testing_setup.json
    console.log("🔑 Loading coordinator keys from testing_setup.json");
    const testingSetupPath = path.join(process.cwd(), "testing_setup.json");

    if (!fs.existsSync(testingSetupPath)) {
      console.error("❌ testing_setup.json not found! Please create it with coordinator keys.");
      return;
    }

    const testingSetup = JSON.parse(fs.readFileSync(testingSetupPath, "utf8"));
    const coordinatorPubKey = testingSetup["public-key"];
    const coordinatorPrivKey = testingSetup["private-key"];

    if (!coordinatorPubKey || !coordinatorPrivKey) {
      console.error("❌ Coordinator keys not found in testing_setup.json!");
      console.error("Expected format:");
      console.error(`{
  "public-key": "macipk.xxxxx",
  "private-key": "macisk.xxxxx"
}`);
      return;
    }

    console.log("✅ Coordinator keys loaded:");
    console.log(`   Public Key: ${coordinatorPubKey}`);
    console.log(`   Private Key: ${coordinatorPrivKey.substring(0, 20)}...`);

    await sleep(2000);

    // Step 1: Deploy MACI contracts
    const step1 = await runCommand("pnpm deploy:localhost", "Step 1: Deploying MACI contracts");
    if (!step1) {
      console.log("❌ Cannot continue without deployed MACI contracts");
      return;
    }

    await sleep(3000);

    // Step 2: Sign up user
    const step2 = await runCommand("pnpm maci:signup", "Step 2: Signing up user to MACI");
    if (!step2) {
      console.log("⚠️ Signup failed, but continuing...");
    }

    await sleep(2000);

    // Step 3: Update poll times
    const step3 = await runCommand("pnpm maci:update-poll-times", "Step 3: Updating poll times");
    if (!step3) {
      console.log("❌ Cannot continue without updated poll times");
      return;
    }

    await sleep(2000);

    // Step 4: Deploy poll
    const step4 = await runCommand("pnpm deploy-poll:localhost", "Step 4: Deploying new poll");
    if (!step4) {
      console.log("❌ Cannot continue without a deployed poll");
      return;
    }

    await sleep(3000);

    // Step 5: Check poll status
    const step5 = await runCommand("pnpm maci:check-poll", "Step 5: Checking poll status");

    await sleep(2000);

    // Step 6: Submit vote
    const step6 = await runCommand("pnpm maci:vote", "Step 6: Submitting vote");
    if (!step6) {
      console.log("⚠️ Vote submission failed, but continuing...");
    }

    await sleep(2000);

    // Step 7: Final poll check
    const step7 = await runCommand("pnpm maci:check-poll", "Step 7: Final poll status check");

    // Final summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 MACI Full End-to-End Flow Complete!");
    console.log("=".repeat(60));

    console.log("\n📊 Summary:");
    console.log(`✅ Coordinator keys loaded: SUCCESS`);
    console.log(`✅ MACI contracts deployed: ${step1 ? "SUCCESS" : "FAILED"}`);
    console.log(`✅ User signed up: ${step2 ? "SUCCESS" : "FAILED"}`);
    console.log(`✅ Poll times updated: ${step3 ? "SUCCESS" : "FAILED"}`);
    console.log(`✅ Poll deployed: ${step4 ? "SUCCESS" : "FAILED"}`);
    console.log(`✅ Poll checked: ${step5 ? "SUCCESS" : "FAILED"}`);
    console.log(`✅ Vote submitted: ${step6 ? "SUCCESS" : "FAILED"}`);
    console.log(`✅ Final check: ${step7 ? "SUCCESS" : "FAILED"}`);

    if (step1 && step4) {
      console.log("\n🚀 Next Steps (after voting period ends):");
      console.log("1. Run message processing: pnpm merge:localhost");
      console.log("2. Run vote proving: pnpm prove:localhost");
      console.log("3. Submit results on-chain: pnpm submitOnChain:localhost");
      console.log("4. Check final results: pnpm maci:check-poll");
    }

    console.log("\n💡 Useful commands:");
    console.log("- Check poll anytime: pnpm maci:check-poll");
    console.log("- Generate new keypair: pnpm maci:generate-keypair");
    console.log("- Sign up more users: pnpm maci:signup");
    console.log("- Submit more votes: pnpm maci:vote");

    console.log("\n🔑 Coordinator Keys Used:");
    console.log(`Public Key: ${coordinatorPubKey}`);
    console.log(`Private Key: ${coordinatorPrivKey}`);
  } catch (error) {
    console.error("\n❌ Fatal error in full run:", error);
    process.exit(1);
  }
}

// Handle script interruption
process.on("SIGINT", () => {
  console.log("\n\n⚠️ Script interrupted by user");
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("\n\n⚠️ Script terminated");
  process.exit(1);
});

main().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});

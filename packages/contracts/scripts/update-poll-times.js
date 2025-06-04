import fs from "fs";
import path from "path";

// Generate current timestamps
const now = Math.floor(Date.now() / 1000);
const startTime = now;
const endTime = startTime + 30000;

console.log("Updating poll times:");
console.log("Current time:", new Date().toLocaleString());
console.log("Poll start:", new Date(startTime * 1000).toLocaleString());
console.log("Poll end:", new Date(endTime * 1000).toLocaleString());
console.log("Start timestamp:", startTime);
console.log("End timestamp:", endTime);

// Read current config
const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "deploy-config.json"), "utf8"));

// Update localhost poll times
config.localhost.Poll.pollStartDate = startTime;
config.localhost.Poll.pollEndDate = endTime;

// Write back to file
fs.writeFileSync(path.join(process.cwd(), "deploy-config.json"), JSON.stringify(config, null, 2));

console.log("\n✅ Updated deploy-config.json");
console.log("Now run: pnpm deploy-poll:localhost");

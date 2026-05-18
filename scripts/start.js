/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Cross-platform production start script.
 * Runs the standalone Next.js server and logs to server.log.
 * Works on Windows, macOS, and Linux.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LOG_FILE = path.join(ROOT, "server.log");
const SERVER = path.join(ROOT, ".next", "standalone", "server.js");

// Clear previous log
fs.writeFileSync(LOG_FILE, "");

if (!fs.existsSync(SERVER)) {
  console.error("Error: Standalone server not found. Run `npm run build` first.");
  process.exit(1);
}

const isWin = process.platform === "win32";
const cmd = isWin ? "node.exe" : "node";
const env = { ...process.env, NODE_ENV: "production" };

console.log("Starting production server...");
console.log(`Log file: ${LOG_FILE}`);

const child = spawn(cmd, [SERVER], {
  cwd: ROOT,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

function writeLine(prefix, data) {
  const lines = data.toString().split("\n");
  for (const line of lines) {
    if (line.trim()) {
      const msg = `${prefix} ${line}`;
      process.stdout.write(msg + "\n");
      fs.appendFileSync(LOG_FILE, msg + "\n");
    }
  }
}

child.stdout.on("data", (data) => writeLine("[server]", data));
child.stderr.on("data", (data) => writeLine("[server]", data));

child.on("close", (code) => {
  const msg = `Server exited with code ${code}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, msg + "\n");
});

function shutdown() {
  console.log("\nShutting down server...");
  child.kill("SIGTERM");
  setTimeout(() => {
    child.kill("SIGKILL");
    process.exit(0);
  }, 5000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

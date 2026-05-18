/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Cross-platform dev server launcher.
 * Spawns `next dev -p 3000` and tees output to both stdout and dev.log.
 * Works on Windows, macOS, and Linux.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "..", "dev.log");
const PORT = process.env.PORT || 3000;

// Clear previous log
fs.writeFileSync(LOG_FILE, "");

// Determine the command based on OS
const isWin = process.platform === "win32";
const cmd = isWin ? "npx.cmd" : "npx";
const args = ["next", "dev", "-p", String(PORT)];

console.log(`Starting Next.js dev server on port ${PORT}...`);
console.log(`Log file: ${LOG_FILE}`);

const child = spawn(cmd, args, {
  cwd: path.join(__dirname, ".."),
  stdio: ["ignore", "pipe", "pipe"],
  shell: isWin,
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

child.stdout.on("data", (data) => writeLine("[dev]", data));
child.stderr.on("data", (data) => writeLine("[dev]", data));

child.on("close", (code) => {
  const msg = `Dev server exited with code ${code}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, msg + "\n");
});

// Graceful shutdown
function shutdown() {
  console.log("\nShutting down dev server...");
  child.kill("SIGTERM");
  setTimeout(() => {
    child.kill("SIGKILL");
    process.exit(0);
  }, 5000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

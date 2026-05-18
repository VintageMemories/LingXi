/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Cross-platform build script.
 * Runs `next build` then copies static files and public directory.
 * Works on Windows, macOS, and Linux.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");
const STATIC_SRC = path.join(ROOT, ".next", "static");
const STATIC_DST = path.join(STANDALONE, ".next", "static");
const PUBLIC_SRC = path.join(ROOT, "public");
const PUBLIC_DST = path.join(STANDALONE, "public");

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log("Building Next.js application...");
execSync("npx next build", { cwd: ROOT, stdio: "inherit" });

console.log("Copying static files...");
copyRecursiveSync(STATIC_SRC, STATIC_DST);

console.log("Copying public directory...");
copyRecursiveSync(PUBLIC_SRC, PUBLIC_DST);

console.log("Build complete!");

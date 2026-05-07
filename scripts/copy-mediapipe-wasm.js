/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const sourceDir = path.join(projectRoot, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const targetDir = path.join(projectRoot, "public", "wasm");

function copyWasmFiles() {
  if (!fs.existsSync(sourceDir)) {
    console.error("MediaPipe wasm source not found:", sourceDir);
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const files = fs.readdirSync(sourceDir);
  const wasmFiles = files.filter((name) => name.endsWith(".wasm") || name.endsWith(".js"));

  if (wasmFiles.length === 0) {
    console.error("No MediaPipe wasm files found in:", sourceDir);
    process.exitCode = 1;
    return;
  }

  for (const file of wasmFiles) {
    fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
  }

  console.log(`Copied ${wasmFiles.length} MediaPipe wasm files to ${targetDir}`);
}

copyWasmFiles();

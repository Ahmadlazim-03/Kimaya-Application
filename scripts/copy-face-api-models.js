/**
 * Copy face-api.js models from node_modules to public directory.
 * Only copies the 3 models needed for face recognition:
 * - ssd_mobilenetv1 (face detection) ~5.6MB
 * - face_landmark_68 (landmarks) ~350KB
 * - face_recognition (128-dim descriptor) ~6.4MB
 */
const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "node_modules", "@vladmandic", "face-api", "model");
const destDir = path.join(__dirname, "..", "public", "models", "face-api");

// Only these 3 models are needed for identity verification
const requiredFiles = [
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model.bin",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model.bin",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model.bin",
];

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

let copied = 0;
for (const file of requiredFiles) {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(dest)) {
    console.log(`Model already exists: ${dest}`);
  } else if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${file}`);
    copied++;
  } else {
    console.warn(`WARNING: Source not found: ${src}`);
  }
}

console.log(`Done. ${copied} files copied to ${destDir}`);

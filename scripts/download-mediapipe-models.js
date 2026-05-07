/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const https = require("https");

const projectRoot = path.join(__dirname, "..");
const targetDir = path.join(projectRoot, "public", "models", "mediapipe");

const models = [
  {
    name: "face_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  },
  {
    name: "blaze_face_short_range.tflite",
    url: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
  },
];

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        resolve(downloadFile(response.headers.location, destPath));
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Download failed (${response.statusCode}) for ${url}`));
        return;
      }

      response.pipe(file);
      file.on("finish", () => file.close(resolve));
    });

    request.on("error", (err) => {
      file.close();
      fs.unlink(destPath, () => reject(err));
    });
  });
}

async function ensureModels() {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const model of models) {
    const destPath = path.join(targetDir, model.name);

    if (fs.existsSync(destPath)) {
      console.log(`Model already exists: ${destPath}`);
      continue;
    }

    console.log(`Downloading ${model.name}...`);
    await downloadFile(model.url, destPath);
    console.log(`Saved ${model.name} to ${destPath}`);
  }
}

ensureModels().catch((err) => {
  console.error("Failed to download MediaPipe models:", err);
  process.exitCode = 1;
});

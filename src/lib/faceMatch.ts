/**
 * Client-side face comparison using MediaPipe Face Landmarker.
 * Extracts 478 3D facial landmarks and computes geometric distance
 * between two face embeddings for identity verification.
 *
 * This is significantly more accurate than histogram comparison
 * because it compares facial GEOMETRY (eye distance, nose shape,
 * jaw line, etc.) rather than pixel colors.
 */

interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}

const MAX_IMAGE_DIM = 640;

// Singleton landmarker instance
let landmarkerInstance: unknown = null;
let landmarkerLoading = false;
let landmarkerResolvers: Array<(value: unknown) => void> = [];

async function getLandmarker() {
  if (landmarkerInstance) return landmarkerInstance;
  
  if (landmarkerLoading) {
    // Wait for existing loading to complete
    return new Promise((resolve) => {
      landmarkerResolvers.push(resolve);
    });
  }

  landmarkerLoading = true;

  const vision = await import("@mediapipe/tasks-vision");
  const { FaceLandmarker, FilesetResolver } = vision;

  const wasmBasePath = "/wasm";
  const wasmFileset = await FilesetResolver.forVisionTasks(wasmBasePath);

  const landmarker = await FaceLandmarker.createFromOptions(wasmFileset, {
    baseOptions: {
      modelAssetPath: "/models/mediapipe/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "IMAGE",
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  landmarkerInstance = landmarker;
  landmarkerLoading = false;

  // Resolve all pending waiters
  for (const resolve of landmarkerResolvers) {
    resolve(landmarker);
  }
  landmarkerResolvers = [];

  return landmarker;
}

/**
 * Extract normalized facial landmarks from an image.
 * Returns 478 3D points representing the face mesh.
 */
async function extractLandmarks(imageBase64: string): Promise<FaceLandmark[] | null> {
  const img = await loadImage(imageBase64);
  
  const landmarker = await getLandmarker() as {
    detect: (image: CanvasImageSource) => { faceLandmarks: FaceLandmark[][] };
  };

  const source = resizeImageIfNeeded(img, MAX_IMAGE_DIM);
  const result = landmarker.detect(source);

  if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
    return null;
  }

  return result.faceLandmarks[0];
}

/**
 * Normalize landmarks to be scale/position invariant.
 * Centers on nose tip and scales by inter-eye distance.
 */
function normalizeLandmarks(landmarks: FaceLandmark[]): FaceLandmark[] {
  // Key indices (MediaPipe Face Mesh):
  // 1 = nose tip, 33 = left eye inner, 263 = right eye inner
  const noseTip = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];

  // Compute inter-eye distance for scale normalization
  const eyeDist = Math.sqrt(
    Math.pow(rightEye.x - leftEye.x, 2) +
    Math.pow(rightEye.y - leftEye.y, 2) +
    Math.pow(rightEye.z - leftEye.z, 2)
  );

  if (eyeDist < 0.001) return landmarks; // Avoid division by zero

  // Normalize: translate to nose tip, scale by eye distance
  return landmarks.map((lm) => ({
    x: (lm.x - noseTip.x) / eyeDist,
    y: (lm.y - noseTip.y) / eyeDist,
    z: (lm.z - noseTip.z) / eyeDist,
  }));
}

/**
 * Key landmark indices that are most discriminative for face identity.
 * Using a subset of stable landmarks reduces noise from expressions.
 */
const KEY_LANDMARK_INDICES = [
  // Jawline contour (defines face shape)
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
  // Eyebrow shape (stable across expressions)
  66, 107, 336, 296,
  // Eye corners (very stable)
  33, 133, 362, 263,
  // Nose bridge & tip (most identity-defining)
  1, 2, 4, 5, 6, 168, 197, 195,
  // Nose wings
  48, 278,
  // Cheekbone landmarks
  123, 352, 116, 345,
  // Chin
  199, 175,
];

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

/**
 * Convert key landmarks to a flat feature vector.
 */
function landmarksToFeatureVector(normalized: FaceLandmark[]): number[] {
  const features: number[] = [];
  for (const idx of KEY_LANDMARK_INDICES) {
    if (idx < normalized.length) {
      features.push(normalized[idx].x, normalized[idx].y, normalized[idx].z);
    }
  }
  return features;
}

/**
 * Compare two face photos and return a similarity score (0-100).
 * Uses MediaPipe Face Landmarker for geometric face matching.
 */
export async function compareFaces(
  registeredFaceBase64: string,
  capturedFaceBase64: string
): Promise<{ score: number; match: boolean }> {
  const MATCH_THRESHOLD = 70; // Minimum similarity % to consider a match

  try {
    // Extract landmarks from both images
    const [landmarks1, landmarks2] = await Promise.all([
      extractLandmarks(registeredFaceBase64),
      extractLandmarks(capturedFaceBase64),
    ]);

    if (!landmarks1 || !landmarks2) {
      console.warn("Could not detect face in one or both images");
      return { score: 0, match: false };
    }

    // Normalize landmarks (scale & position invariant)
    const norm1 = normalizeLandmarks(landmarks1);
    const norm2 = normalizeLandmarks(landmarks2);

    // Extract feature vectors from key landmarks
    const features1 = landmarksToFeatureVector(norm1);
    const features2 = landmarksToFeatureVector(norm2);

    // Compute cosine similarity
    const similarity = cosineSimilarity(features1, features2);

    // Convert to percentage (cosine similarity range for faces is typically 0.7-1.0)
    // Map [0.7, 1.0] -> [0, 100] with some adjustment
    const rawPercent = Math.max(0, (similarity - 0.5) / 0.5) * 100;
    const scorePercent = Math.min(100, Math.round(rawPercent));

    return {
      score: scorePercent,
      match: scorePercent >= MATCH_THRESHOLD,
    };
  } catch (error) {
    console.error("Face comparison error:", error);
    return { score: 0, match: false };
  }
}

export async function warmUpFaceMatcher(): Promise<void> {
  if (typeof document === "undefined") return;
  try {
    const landmarker = await getLandmarker() as {
      detect: (image: CanvasImageSource) => { faceLandmarks: FaceLandmark[][] };
    };
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.fillRect(0, 0, canvas.width, canvas.height);
    landmarker.detect(canvas);
  } catch (error) {
    console.warn("Face matcher warmup failed:", error);
  }
}

function loadImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64;
  });
}

function resizeImageIfNeeded(image: HTMLImageElement, maxDim: number): CanvasImageSource {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width <= maxDim && height <= maxDim) return image;

  const scale = maxDim / Math.max(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return image;

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Client-side face recognition using face-api.js (vladmandic fork).
 * 
 * Uses a deep learning model (ResNet) to extract 128-dimensional
 * face descriptors — the same approach used by iPhone Face ID
 * and Android face recognition.
 * 
 * Unlike geometric landmark comparison, this creates a unique
 * mathematical "fingerprint" for each face that accurately
 * distinguishes between different people.
 * 
 * Runs 100% client-side — zero server CPU load.
 */

// Singleton state
let faceApiLoaded = false;
let faceApiLoading = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceApiResolvers: Array<(value: any) => void> = [];

/**
 * Load face-api.js models (singleton, cached after first load).
 * Models: SSD MobileNet (detection) + 68-point landmarks + 128-dim face recognition
 */
async function loadFaceApi() {
  const faceapi = await import("@vladmandic/face-api");

  if (faceApiLoaded) return faceapi;

  if (faceApiLoading) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Promise<any>((resolve) => {
      faceApiResolvers.push(resolve);
    });
  }

  faceApiLoading = true;
  console.log("[FaceMatch] Loading face-api.js models...");

  const MODEL_URL = "/models/face-api";

  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  faceApiLoaded = true;
  faceApiLoading = false;
  console.log("[FaceMatch] Models loaded successfully.");

  // Resolve pending waiters
  for (const resolve of faceApiResolvers) {
    resolve(faceapi);
  }
  faceApiResolvers = [];

  return faceapi;
}

/**
 * Load an image from base64 or URL string into an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
    img.src = src;
  });
}

/**
 * Extract a 128-dimensional face descriptor from an image.
 * This is the "fingerprint" of the face — unique per person.
 */
async function extractDescriptor(
  faceapi: typeof import("@vladmandic/face-api"),
  imageSrc: string
): Promise<Float32Array | null> {
  const img = await loadImage(imageSrc);

  // Detect face + landmarks + descriptor in one pass
  const detection = await faceapi
    .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    console.warn("[FaceMatch] No face detected in image");
    return null;
  }

  console.log("[FaceMatch] Face descriptor extracted (128-dim), detection score:", detection.detection.score.toFixed(3));
  return detection.descriptor;
}

/**
 * Compare two face photos and return a similarity score (0-100).
 * Uses 128-dimensional face descriptors for accurate identity matching.
 * 
 * How it works:
 * 1. Extract face descriptor (128-dim vector) from both images
 * 2. Compute Euclidean distance between descriptors
 * 3. Same person: distance typically < 0.4
 *    Different person: distance typically > 0.6
 * 4. Convert distance to percentage score
 */
export async function compareFaces(
  registeredFaceSrc: string,
  capturedFaceSrc: string
): Promise<{ score: number; match: boolean }> {
  // Distance threshold: lower = stricter
  // < 0.45 = same person (high confidence)
  // 0.45-0.55 = uncertain
  // > 0.55 = different person
  const DISTANCE_THRESHOLD = 0.5;

  try {
    console.log("[FaceMatch] Starting face recognition comparison...");

    const faceapi = await loadFaceApi();

    // Extract 128-dim descriptors from both faces
    const [desc1, desc2] = await Promise.all([
      extractDescriptor(faceapi, registeredFaceSrc),
      extractDescriptor(faceapi, capturedFaceSrc),
    ]);

    if (!desc1) {
      console.warn("[FaceMatch] Could not detect face in REGISTERED image");
      return { score: 0, match: false };
    }
    if (!desc2) {
      console.warn("[FaceMatch] Could not detect face in CAPTURED image");
      return { score: 0, match: false };
    }

    // Compute Euclidean distance between face descriptors
    const distance = faceapi.euclideanDistance(desc1, desc2);

    // Convert distance to percentage score (0-100)
    // Distance range for faces: 0.0 (identical) to ~1.5 (very different)
    // Map: 0.0 → 100%, 0.5 → 50%, 1.0 → 0%
    const scorePercent = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));
    const isMatch = distance <= DISTANCE_THRESHOLD;

    console.log("[FaceMatch] ═══════════════════════════════");
    console.log("[FaceMatch] Euclidean distance:", distance.toFixed(4));
    console.log("[FaceMatch] Score:", scorePercent + "%");
    console.log("[FaceMatch] Threshold:", DISTANCE_THRESHOLD);
    console.log("[FaceMatch] Result:", isMatch ? "✅ MATCH" : "❌ NOT MATCH");
    console.log("[FaceMatch] ═══════════════════════════════");

    return {
      score: scorePercent,
      match: isMatch,
    };
  } catch (error) {
    console.error("[FaceMatch] Comparison error:", error);
    return { score: 0, match: false };
  }
}

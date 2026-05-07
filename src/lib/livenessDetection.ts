/**
 * Liveness Detection System using MediaPipe Face Landmarker.
 * 
 * Detects facial actions to prove the user is a live person:
 * - Head turn (left/right) via landmark geometry
 * - Eye blink via blendshapes or Eye Aspect Ratio (EAR)
 * - Mouth open via blendshapes or Mouth Aspect Ratio (MAR)
 * - Smile via blendshapes or mouth width ratio
 */

export type ChallengeType = "turn_right" | "turn_left" | "blink" | "open_mouth" | "smile";

export interface ChallengeConfig {
  type: ChallengeType;
  label: string;
  instruction: string;
  emoji: string;
  /** How long the action must be held (ms) to count as completed */
  holdDurationMs: number;
}

interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface BlendshapeCategory {
  categoryName: string;
  score: number;
}

const ALL_CHALLENGES: ChallengeConfig[] = [
  { type: "turn_right", label: "Tengok Kanan", instruction: "Tengok ke KANAN", emoji: "👉", holdDurationMs: 600 },
  { type: "turn_left", label: "Tengok Kiri", instruction: "Tengok ke KIRI", emoji: "👈", holdDurationMs: 600 },
  { type: "blink", label: "Kedipkan Mata", instruction: "Tutup KEDUA mata", emoji: "😌", holdDurationMs: 300 },
  { type: "open_mouth", label: "Buka Mulut", instruction: "Buka mulut LEBAR", emoji: "😮", holdDurationMs: 500 },
  { type: "smile", label: "Tersenyum", instruction: "Berikan SENYUMAN", emoji: "😁", holdDurationMs: 500 },
];

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Get challenge sequence for registration (all 5, shuffled) */
export function getRegistrationChallenges(): ChallengeConfig[] {
  return shuffleArray(ALL_CHALLENGES);
}

/** Get challenge sequence for attendance (3 random) */
export function getAttendanceChallenges(): ChallengeConfig[] {
  return shuffleArray(ALL_CHALLENGES).slice(0, 3);
}

/**
 * Check if the user is performing the given challenge action.
 * Uses blendshapes when available, falls back to landmarks.
 * Returns { detected: boolean, debugValue: string } for debugging.
 */
export function checkChallenge(
  type: ChallengeType,
  landmarks: Landmark[],
  blendshapes?: BlendshapeCategory[]
): { detected: boolean; debug: string } {
  if (!landmarks || landmarks.length < 468) {
    return { detected: false, debug: "insufficient landmarks" };
  }

  const bs: Record<string, number> = {};
  if (blendshapes && blendshapes.length > 0) {
    for (const b of blendshapes) {
      bs[b.categoryName] = b.score;
    }
  }

  switch (type) {
    case "turn_right":
      return detectTurnRight(landmarks);
    case "turn_left":
      return detectTurnLeft(landmarks);
    case "blink":
      return detectBlink(landmarks, bs);
    case "open_mouth":
      return detectMouthOpen(landmarks, bs);
    case "smile":
      return detectSmile(landmarks, bs);
    default:
      return { detected: false, debug: "unknown" };
  }
}

// ── Head Turn Detection ──
// Landmark 234 = subject's left face contour
// Landmark 454 = subject's right face contour
// Landmark 1   = nose tip
//
// In the non-mirrored camera frame (what MediaPipe sees):
// - Subject's left (234) appears on RIGHT of image (higher x)
// - Subject's right (454) appears on LEFT of image (lower x)
//
// When user turns head to THEIR RIGHT (in mirrored selfie view):
// → In camera frame: nose moves toward landmark 454 (lower x)
// → leftDist increases, rightDist decreases → ratio > 1

function getHeadYawRatio(landmarks: Landmark[]): number {
  const noseTip = landmarks[1];
  const leftContour = landmarks[234];
  const rightContour = landmarks[454];

  const leftDist = Math.hypot(noseTip.x - leftContour.x, noseTip.y - leftContour.y);
  const rightDist = Math.hypot(noseTip.x - rightContour.x, noseTip.y - rightContour.y);

  if (rightDist < 0.001 || leftDist < 0.001) return 1;
  return leftDist / rightDist;
}

function detectTurnRight(landmarks: Landmark[]): { detected: boolean; debug: string } {
  const ratio = getHeadYawRatio(landmarks);
  // Lowered threshold: 1.25 means nose is 25% further from left ear than right
  return { detected: ratio > 1.25, debug: `yaw ratio=${ratio.toFixed(2)} (need >1.25)` };
}

function detectTurnLeft(landmarks: Landmark[]): { detected: boolean; debug: string } {
  const ratio = getHeadYawRatio(landmarks);
  return { detected: ratio < 0.80, debug: `yaw ratio=${ratio.toFixed(2)} (need <0.80)` };
}

// ── Eye Blink Detection ──

function eyeAspectRatio(
  outer: Landmark, upper1: Landmark, upper2: Landmark,
  inner: Landmark, lower1: Landmark, lower2: Landmark
): number {
  const v1 = Math.hypot(upper1.x - lower2.x, upper1.y - lower2.y);
  const v2 = Math.hypot(upper2.x - lower1.x, upper2.y - lower1.y);
  const h = Math.hypot(outer.x - inner.x, outer.y - inner.y);
  if (h < 0.001) return 1;
  return (v1 + v2) / (2 * h);
}

function detectBlink(landmarks: Landmark[], bs: Record<string, number>): { detected: boolean; debug: string } {
  // Try blendshapes first (more reliable)
  if (bs.eyeBlinkLeft !== undefined && bs.eyeBlinkRight !== undefined) {
    const left = bs.eyeBlinkLeft;
    const right = bs.eyeBlinkRight;
    return {
      detected: left > 0.3 && right > 0.3,
      debug: `BS blink L=${left.toFixed(2)} R=${right.toFixed(2)} (need >0.30)`,
    };
  }

  // Fallback: EAR-based detection
  const leftEAR = eyeAspectRatio(
    landmarks[33], landmarks[160], landmarks[158],
    landmarks[133], landmarks[153], landmarks[144]
  );
  const rightEAR = eyeAspectRatio(
    landmarks[362], landmarks[385], landmarks[387],
    landmarks[263], landmarks[373], landmarks[380]
  );

  return {
    detected: leftEAR < 0.22 && rightEAR < 0.22,
    debug: `EAR L=${leftEAR.toFixed(3)} R=${rightEAR.toFixed(3)} (need <0.22)`,
  };
}

// ── Mouth Open Detection ──

function detectMouthOpen(landmarks: Landmark[], bs: Record<string, number>): { detected: boolean; debug: string } {
  // Try blendshapes first
  if (bs.jawOpen !== undefined) {
    return {
      detected: bs.jawOpen > 0.30,
      debug: `BS jawOpen=${bs.jawOpen.toFixed(2)} (need >0.30)`,
    };
  }

  // Fallback: MAR-based
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];
  const mouthLeft = landmarks[61];
  const mouthRight = landmarks[291];
  const mouthHeight = Math.hypot(upperLip.x - lowerLip.x, upperLip.y - lowerLip.y);
  const mouthWidth = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
  if (mouthWidth < 0.001) return { detected: false, debug: "mouthWidth=0" };
  const mar = mouthHeight / mouthWidth;

  return {
    detected: mar > 0.25,
    debug: `MAR=${mar.toFixed(3)} (need >0.25)`,
  };
}

// ── Smile Detection ──

function detectSmile(landmarks: Landmark[], bs: Record<string, number>): { detected: boolean; debug: string } {
  // Try blendshapes first
  if (bs.mouthSmileLeft !== undefined && bs.mouthSmileRight !== undefined) {
    const left = bs.mouthSmileLeft;
    const right = bs.mouthSmileRight;
    return {
      detected: left > 0.35 && right > 0.35,
      debug: `BS smile L=${left.toFixed(2)} R=${right.toFixed(2)} (need >0.35)`,
    };
  }

  // Fallback: Landmark-based
  const mouthLeft = landmarks[61];
  const mouthRight = landmarks[291];
  const noseTip = landmarks[1];
  const chin = landmarks[152];

  const mouthWidth = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
  const faceHeight = Math.hypot(noseTip.x - chin.x, noseTip.y - chin.y);
  if (faceHeight < 0.001) return { detected: false, debug: "faceHeight=0" };

  const widthRatio = mouthWidth / faceHeight;

  return {
    detected: widthRatio > 0.78,
    debug: `smile ratio=${widthRatio.toFixed(3)} (need >0.78)`,
  };
}

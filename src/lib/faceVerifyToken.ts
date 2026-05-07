/**
 * Server-side face verification token system.
 * 
 * Flow:
 * 1. Client does face comparison (via MediaPipe in browser)
 * 2. Client calls /api/attendance/verify-face with selfie + match score
 * 3. Server validates user has facePhotoUrl, validates image data, creates signed token
 * 4. Client sends this token with the check-in request
 * 5. Attendance API validates the token before accepting check-in
 * 
 * This prevents bypassing face verification via direct API calls.
 */

import { SignJWT, jwtVerify } from "jose";

const FACE_VERIFY_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET
        ? process.env.JWT_SECRET + "-face-verify"
        : "kimaya-face-verify-secret-2026"
);

const TOKEN_EXPIRY = "5m"; // Token valid for 5 minutes only

export interface FaceVerifyPayload {
    userId: string;
    matchScore: number;
    selfieHash: string; // SHA-256 hash of selfie to prevent photo swap
    verifiedAt: number; // timestamp
}

/**
 * Create a short-lived face verification token after successful match.
 */
export async function createFaceVerifyToken(
    userId: string,
    matchScore: number,
    selfieBase64: string
): Promise<string> {
    const selfieHash = await hashString(selfieBase64.slice(0, 500)); // Hash first 500 chars for speed

    const token = await new SignJWT({
        userId,
        matchScore,
        selfieHash,
        verifiedAt: Date.now(),
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(TOKEN_EXPIRY)
        .sign(FACE_VERIFY_SECRET);

    return token;
}

/**
 * Verify a face verification token.
 * Returns the payload if valid, null otherwise.
 */
export async function verifyFaceToken(
    token: string,
    expectedUserId: string,
    selfieBase64?: string
): Promise<FaceVerifyPayload | null> {
    try {
        const { payload } = await jwtVerify(token, FACE_VERIFY_SECRET);

        const data = payload as unknown as FaceVerifyPayload;

        // Validate user matches
        if (data.userId !== expectedUserId) {
            console.warn("Face verify token: userId mismatch");
            return null;
        }

        // Validate match score is reasonable (anti-tampering)
        if (data.matchScore < 82 || data.matchScore > 100) {
            console.warn("Face verify token: suspicious match score", data.matchScore);
            return null;
        }

        // Validate token age (extra check beyond JWT expiry)
        const ageMs = Date.now() - data.verifiedAt;
        if (ageMs > 5 * 60 * 1000) {
            console.warn("Face verify token: too old", ageMs);
            return null;
        }

        // If selfie provided, verify hash matches
        if (selfieBase64) {
            const currentHash = await hashString(selfieBase64.slice(0, 500));
            if (currentHash !== data.selfieHash) {
                console.warn("Face verify token: selfie hash mismatch (photo swapped)");
                return null;
            }
        }

        return data;
    } catch (err) {
        console.warn("Face verify token: invalid or expired", err);
        return null;
    }
}

/**
 * Simple SHA-256 hash using Web Crypto API (works in both Edge & Node runtime).
 */
async function hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    // Use Node.js crypto in server environment
    if (typeof globalThis.crypto?.subtle !== "undefined") {
        const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    // Fallback: simple hash for environments without SubtleCrypto
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Validate that a base64 string looks like a real image.
 */
export function validateImageBase64(base64: string): { valid: boolean; reason?: string } {
    if (!base64 || base64.length < 100) {
        return { valid: false, reason: "Image data too short" };
    }

    // Check if it starts with data:image/ prefix
    if (!base64.startsWith("data:image/")) {
        return { valid: false, reason: "Not a valid image data URL" };
    }

    // Check reasonable size (at least 10KB, at most 5MB)
    const sizeEstimate = (base64.length * 3) / 4;
    if (sizeEstimate < 10_000) {
        return { valid: false, reason: "Image too small (possibly fake)" };
    }
    if (sizeEstimate > 5_000_000) {
        return { valid: false, reason: "Image too large (max 5MB)" };
    }

    return { valid: true };
}

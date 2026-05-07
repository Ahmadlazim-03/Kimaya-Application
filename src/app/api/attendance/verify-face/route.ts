import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
    createFaceVerifyToken,
    validateImageBase64,
} from "@/lib/faceVerifyToken";

/**
 * POST /api/attendance/verify-face
 * 
 * Called after client-side face comparison succeeds.
 * Validates user has registered face, validates selfie image,
 * and returns a short-lived verification token for check-in.
 */
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
        }

        const body = await request.json();
        const { selfiePhoto, matchScore } = body;

        // ── Validate match score ──
        if (typeof matchScore !== "number" || matchScore < 82 || matchScore > 100) {
            return NextResponse.json(
                { error: "Skor pencocokan wajah tidak valid atau terlalu rendah" },
                { status: 400 }
            );
        }

        // ── Validate selfie image ──
        const imageValidation = validateImageBase64(selfiePhoto);
        if (!imageValidation.valid) {
            return NextResponse.json(
                { error: `Foto selfie tidak valid: ${imageValidation.reason}` },
                { status: 400 }
            );
        }

        // ── Check user has registered face photo ──
        const user = await prisma.user.findUnique({
            where: { id: session.id },
            select: { id: true, facePhotoUrl: true, onboardingCompleted: true, fullName: true },
        });

        if (!user) {
            return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
        }

        if (!user.facePhotoUrl) {
            return NextResponse.json(
                { error: "Anda belum mendaftarkan foto wajah. Selesaikan onboarding terlebih dahulu." },
                { status: 403 }
            );
        }

        if (!user.onboardingCompleted) {
            return NextResponse.json(
                { error: "Onboarding belum selesai. Lengkapi profil terlebih dahulu." },
                { status: 403 }
            );
        }

        // ── Generate verification token ──
        const token = await createFaceVerifyToken(session.id, matchScore, selfiePhoto);

        // ── Audit log ──
        await prisma.auditLog.create({
            data: {
                userId: session.id,
                action: "FACE_VERIFIED",
                entityType: "Attendance",
                entityId: session.id,
                details: {
                    matchScore,
                    verifiedAt: new Date().toISOString(),
                    tokenExpiry: "5m",
                },
            },
        });

        return NextResponse.json({
            success: true,
            token,
            matchScore,
            message: `Wajah terverifikasi (${matchScore}%)`,
        });
    } catch (error) {
        console.error("Face verify error:", error);
        return NextResponse.json(
            { error: "Gagal memverifikasi wajah" },
            { status: 500 }
        );
    }
}

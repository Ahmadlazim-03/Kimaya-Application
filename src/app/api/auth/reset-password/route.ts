import { NextResponse } from "next/server";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

/**
 * POST /api/auth/reset-password
 *
 * Body: { token: string, newPassword: string, confirmPassword: string }
 *
 * Looks up the user by the SHA-256 hash of the token, verifies the token
 * has not expired, sets the new password hash, and clears the token so it
 * cannot be reused.
 */
export async function POST(request: Request) {
  try {
    const { token, newPassword, confirmPassword } = await request.json();
    const t = typeof token === "string" ? token : "";
    const np = typeof newPassword === "string" ? newPassword : "";
    const cp = typeof confirmPassword === "string" ? confirmPassword : "";

    if (!t) return NextResponse.json({ error: "Token tidak valid" }, { status: 400 });
    if (np.length < 8) return NextResponse.json({ error: "Kata sandi baru minimal 8 karakter" }, { status: 400 });
    if (np !== cp) return NextResponse.json({ error: "Konfirmasi kata sandi tidak cocok" }, { status: 400 });

    const tokenHash = createHash("sha256").update(t).digest("hex");

    const user = await prisma.user.findFirst({
      where: { resetTokenHash: tokenHash, resetTokenExpiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({
        error: "Link reset sudah kedaluwarsa atau tidak valid. Minta link baru.",
      }, { status: 400 });
    }

    const hashed = await bcrypt.hash(np, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashed, resetTokenHash: null, resetTokenExpiresAt: null },
    });

    return NextResponse.json({ message: "Kata sandi berhasil diatur ulang. Silakan login dengan kata sandi baru." });
  } catch (error) {
    console.error("[ResetPassword]", error);
    return NextResponse.json({ error: "Gagal memproses, coba lagi nanti" }, { status: 500 });
  }
}

/**
 * GET /api/auth/reset-password?token=...
 *
 * Quick validity check used by the reset-password page on load — so we can
 * show the form (if token is valid) or an error (if expired) without
 * exposing the user's email.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token") || "";
    if (!token) return NextResponse.json({ valid: false }, { status: 400 });

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const user = await prisma.user.findFirst({
      where: { resetTokenHash: tokenHash, resetTokenExpiresAt: { gt: new Date() } },
      select: { id: true },
    });
    return NextResponse.json({ valid: !!user });
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

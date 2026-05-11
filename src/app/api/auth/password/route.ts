import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * PUT /api/auth/password
 *
 * Change own password. Requires current password as a guard against session
 * hijacking (don't let a stolen cookie silently lock the user out).
 *
 * Body: { currentPassword, newPassword, confirmPassword }
 */
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Anda belum masuk" }, { status: 401 });

    const body = await request.json();
    const current = String(body.currentPassword || "");
    const next = String(body.newPassword || "");
    const confirm = String(body.confirmPassword || "");

    if (!current) return NextResponse.json({ error: "Kata sandi saat ini wajib diisi" }, { status: 400 });
    if (next.length < 8) return NextResponse.json({ error: "Kata sandi baru minimal 8 karakter" }, { status: 400 });
    if (next !== confirm) return NextResponse.json({ error: "Konfirmasi kata sandi tidak cocok" }, { status: 400 });
    if (next === current) return NextResponse.json({ error: "Kata sandi baru harus berbeda dari yang lama" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { passwordHash: true },
    });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Akun ini tidak menggunakan kata sandi" }, { status: 400 });
    }

    const ok = await bcrypt.compare(current, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Kata sandi saat ini salah" }, { status: 400 });

    const hashed = await bcrypt.hash(next, 12);
    await prisma.user.update({
      where: { id: session.id },
      data: {
        passwordHash: hashed,
        // Invalidate any pending password-reset token after a successful change.
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });

    return NextResponse.json({ message: "Kata sandi berhasil diubah" });
  } catch (error) {
    console.error("[Password PUT]", error);
    return NextResponse.json({ error: "Gagal mengubah kata sandi" }, { status: 500 });
  }
}

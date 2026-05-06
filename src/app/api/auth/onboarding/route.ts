import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    }

    const body = await request.json();
    const { facePhoto, avatarUrl, phone, address } = body;

    // ── Validation ──
    if (!facePhoto) {
      return NextResponse.json(
        { error: "Foto wajah wajib diambil untuk verifikasi identitas" },
        { status: 400 }
      );
    }

    if (!phone || phone.trim().length < 8) {
      return NextResponse.json(
        { error: "Nomor WhatsApp wajib diisi (minimal 8 digit)" },
        { status: 400 }
      );
    }

    if (!address || address.trim().length < 10) {
      return NextResponse.json(
        { error: "Alamat lengkap wajib diisi (minimal 10 karakter)" },
        { status: 400 }
      );
    }

    // ── Update user profile ──
    const user = await prisma.user.update({
      where: { id: session.id },
      data: {
        facePhotoUrl: facePhoto,
        avatarUrl: avatarUrl || facePhoto, // Use face photo as avatar if none provided
        phone: phone.trim(),
        address: address.trim(),
        onboardingCompleted: true,
      },
    });

    // ── Audit log ──
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ONBOARDING_COMPLETE",
        entityType: "User",
        entityId: user.id,
        details: {
          email: user.email,
          hasFacePhoto: true,
          hasAvatar: !!avatarUrl,
          phone: user.phone,
        },
      },
    });

    return NextResponse.json({
      message: `Onboarding selesai! Selamat datang, ${user.fullName}.`,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        onboardingCompleted: true,
      },
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat onboarding" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/auth";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fullName, email, phone, password, confirmPassword, facePhoto } = body;

    // ── Validation ──
    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Nama lengkap, email, dan password wajib diisi" },
        { status: 400 }
      );
    }

    if (!facePhoto) {
      return NextResponse.json(
        { error: "Foto wajah wajib diambil untuk verifikasi identitas" },
        { status: 400 }
      );
    }

    if (fullName.trim().length < 3) {
      return NextResponse.json(
        { error: "Nama lengkap minimal 3 karakter" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Format email tidak valid" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter" },
        { status: 400 }
      );
    }

    if (confirmPassword && password !== confirmPassword) {
      return NextResponse.json(
        { error: "Konfirmasi password tidak cocok" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Silakan login." },
        { status: 409 }
      );
    }

    // ── Create user with face photo ──
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        passwordHash: hashedPassword,
        facePhotoUrl: facePhoto,
        role: "THERAPIST",
        status: "ACTIVE",
      },
    });

    // ── Auto-login after registration ──
    const sessionUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      departmentId: undefined,
      locationId: undefined,
      avatarUrl: undefined,
      facePhotoUrl: user.facePhotoUrl || undefined,
    };

    const token = await createSession(sessionUser);
    await setSessionCookie(token);

    // ── Audit log ──
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "REGISTER",
        entityType: "User",
        entityId: user.id,
        details: { email: user.email, role: user.role, hasFacePhoto: true },
      },
    });

    return NextResponse.json(
      {
        message: `Registrasi berhasil! Selamat datang, ${user.fullName}.`,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat registrasi" },
      { status: 500 }
    );
  }
}

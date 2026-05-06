import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { department: { select: { name: true } }, location: { select: { name: true } } },
    });

    if (!user) {
      return NextResponse.json({ error: "Email tidak terdaftar" }, { status: 401 });
    }

    if (user.status === "TERMINATED" || user.status === "INACTIVE") {
      return NextResponse.json({ error: "Akun Anda tidak aktif. Hubungi HR." }, { status: 403 });
    }

    // Must have a password set (no more first-login auto-set)
    if (!user.passwordHash) {
      return NextResponse.json({ error: "Akun belum memiliki password. Silakan hubungi Admin." }, { status: 401 });
    }

    // Verify password with bcrypt
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Password salah" }, { status: 401 });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const sessionUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      departmentId: user.departmentId || undefined,
      locationId: user.locationId || undefined,
      avatarUrl: user.avatarUrl || undefined,
      facePhotoUrl: user.facePhotoUrl || undefined,
    };

    const token = await createSession(sessionUser);
    await setSessionCookie(token);

    return NextResponse.json({
      message: `Selamat datang, ${user.fullName}!`,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department?.name || "-",
        location: user.location?.name || "-",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan saat login" }, { status: 500 });
  }
}

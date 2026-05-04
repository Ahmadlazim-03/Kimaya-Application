import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/auth";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

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

    // Verify password
    const hashed = hashPassword(password);
    if (user.passwordHash && user.passwordHash !== hashed) {
      return NextResponse.json({ error: "Password salah" }, { status: 401 });
    }

    // If no password hash set yet (first-time/seed users), accept and set it
    if (!user.passwordHash) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashed, lastLoginAt: new Date() },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      departmentId: user.departmentId || undefined,
      locationId: user.locationId || undefined,
      avatarUrl: user.avatarUrl || undefined,
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

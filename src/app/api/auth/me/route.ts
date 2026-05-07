import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        departmentId: true,
        locationId: true,
        avatarUrl: true,
        facePhotoUrl: true,
        phone: true,
        address: true,
        onboardingCompleted: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });
    }

    return NextResponse.json({
      user,
      needsOnboarding: user.role === "DEVELOPER" ? false : !user.onboardingCompleted,
    });
  } catch {
    return NextResponse.json({ error: "Session tidak valid" }, { status: 401 });
  }
}

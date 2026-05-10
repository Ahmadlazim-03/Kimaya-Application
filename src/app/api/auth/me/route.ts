import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      // Surface why this 401 happened so admins can debug from container logs.
      try {
        const store = await cookies();
        const has = !!store.get("management-session");
        console.warn(
          `[Auth] /me 401: cookie ${
            has
              ? "present but JWT verify failed (likely JWT_SECRET changed across rebuilds, or token expired)"
              : "absent — browser did not send it. Most common cause: Secure cookie flag on a non-HTTPS origin. Set COOKIE_SECURE=false in .env if serving over plain HTTP (LAN/IP)."
          }`
        );
      } catch { /* best-effort logging */ }
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
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          }
        }
      },
    });

    if (!user) {
      console.warn(`[Auth] /me 401: session userId=${session.id} not found in DB (deleted?)`);
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });
    }

    return NextResponse.json({
      user,
      needsOnboarding: user.role === "THERAPIST" ? !user.onboardingCompleted : false,
    });
  } catch (err) {
    console.error("[Auth] /me unexpected error:", err);
    return NextResponse.json({ error: "Session tidak valid" }, { status: 401 });
  }
}

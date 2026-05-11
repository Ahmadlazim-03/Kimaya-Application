import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/reminders/therapists
 *
 * Returns the list of therapists the current admin is allowed to select
 * as reminder recipients. CS users are restricted to their own location;
 * Manager and Developer see all locations.
 *
 * Response includes `pushReady` so the UI can warn "this therapist hasn't
 * enabled notifications yet".
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Anda belum masuk" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Halaman ini hanya untuk admin" }, { status: 403 });
    }

    const where: Record<string, unknown> = {
      role: "THERAPIST",
      status: { in: ["ACTIVE", "PROBATION"] },
    };
    if (session.role === "CS" && session.locationId) {
      where.locationId = session.locationId;
    }

    const therapists = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        location: { select: { id: true, name: true } },
        _count: { select: { pushSubscriptions: true } },
      },
      orderBy: [{ location: { name: "asc" } }, { fullName: "asc" }],
    });

    return NextResponse.json(
      therapists.map((t) => ({
        id: t.id,
        name: t.fullName,
        phone: t.phone,
        avatarUrl: t.avatarUrl,
        location: t.location?.name || null,
        locationId: t.location?.id || null,
        pushReady: t._count.pushSubscriptions > 0,
      }))
    );
  } catch (error) {
    console.error("[Reminders Therapists]", error);
    return NextResponse.json({ error: "Gagal memuat daftar therapist" }, { status: 500 });
  }
}

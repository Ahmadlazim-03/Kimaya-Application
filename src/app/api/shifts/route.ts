import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/shifts
 *
 * Returns all shifts so the employee form (and any other UI) can render a
 * shift picker. Admins only — therapists/CS don't manage shift assignments.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Anda belum masuk" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Halaman ini hanya untuk admin" }, { status: 403 });
    }

    const shifts = await prisma.shift.findMany({
      orderBy: { startTime: "asc" },
      select: {
        id: true, name: true,
        checkInStart: true, startTime: true, endTime: true,
        description: true,
      },
    });
    return NextResponse.json(shifts);
  } catch (error) {
    console.error("[Shifts GET]", error);
    return NextResponse.json({ error: "Gagal memuat data shift" }, { status: 500 });
  }
}

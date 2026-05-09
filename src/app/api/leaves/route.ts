import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/leaves - Fetch current user's leave history
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requests = await prisma.leaveRequest.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("GET leaves error:", error);
    return NextResponse.json({ error: "Gagal mengambil data cuti" }, { status: 500 });
  }
}

// POST /api/leaves - Submit new leave request
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { type, startDate, endDate, reason } = body;

    if (!type || !startDate || !endDate || !reason) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        userId: session.id,
        type: type as any,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        status: "PENDING",
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "SUBMIT_LEAVE",
        entityType: "LeaveRequest",
        entityId: leave.id,
        details: { type, startDate, endDate },
      },
    });

    return NextResponse.json({ message: "Pengajuan berhasil dikirim", id: leave.id });
  } catch (error) {
    console.error("POST leaves error:", error);
    return NextResponse.json({ error: "Gagal mengirim pengajuan cuti" }, { status: 500 });
  }
}

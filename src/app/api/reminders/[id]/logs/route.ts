import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const logs = await prisma.reminderLog.findMany({
      where: { reminderId: id },
      include: { user: { select: { fullName: true, phone: true } } },
      orderBy: { sentAt: "desc" },
      take: 100,
    });

    const data = logs.map(l => ({
      id: l.id,
      userName: l.user.fullName,
      phone: l.user.phone || "-",
      status: l.status,
      channel: l.channel,
      sentAt: l.sentAt.toLocaleString("id-ID"),
      error: l.errorMessage || null,
    }));

    const stats = {
      total: logs.length,
      sent: logs.filter(l => l.status === "SENT").length,
      delivered: logs.filter(l => l.status === "DELIVERED").length,
      read: logs.filter(l => l.status === "READ").length,
      failed: logs.filter(l => l.status === "FAILED").length,
    };

    return NextResponse.json({ logs: data, stats });
  } catch (error) {
    console.error("Reminder logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const channelMap: Record<string, string> = {
  WHATSAPP: "WhatsApp", WHATSAPP_WEB: "WhatsApp + Web",
  WHATSAPP_EMAIL: "WhatsApp + Email", EMAIL: "Email",
};
const scheduleMap: Record<string, string> = {
  DAILY: "Setiap hari", WEEKLY: "Setiap minggu",
  IMMEDIATE: "Segera", CUSTOM_CRON: "Custom",
};

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const reminders = await prisma.reminder.findMany({
      where: { status: { not: "DELETED" } },
      include: {
        createdBy: { select: { fullName: true } },
        _count: { select: { logs: true, responses: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = reminders.map((r) => ({
      id: r.id,
      title: r.title,
      messageTemplate: r.messageTemplate,
      target: r.targetRole || "Semua Karyawan",
      targetRole: r.targetRole || "",
      schedule: `${scheduleMap[r.scheduleType] || r.scheduleType}, ${r.scheduledTime ? r.scheduledTime.toISOString().slice(11, 16) : "-"}`,
      scheduleType: r.scheduleType,
      scheduledTime: r.scheduledTime ? r.scheduledTime.toISOString().slice(11, 16) : null,
      channel: channelMap[r.channel] || r.channel,
      status: r.status.toLowerCase(),
      lastSent: r.lastSentAt
        ? r.lastSentAt.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) +
          " " + r.lastSentAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        : "-",
      lastSentRaw: r.lastSentAt?.toISOString() || null,
      totalSent: r._count.logs,
      totalResponded: r._count.responses,
      responseRate: r._count.logs > 0 ? Math.round((r._count.responses / r._count.logs) * 100) : 0,
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Reminders API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const body = await request.json();
    const reminder = await prisma.reminder.create({
      data: {
        title: body.title,
        messageTemplate: body.messageTemplate,
        channel: body.channel || "WHATSAPP",
        scheduleType: body.scheduleType || "DAILY",
        scheduledTime: body.scheduledTime ? new Date(`1970-01-01T${body.scheduledTime}:00Z`) : null,
        targetRole: body.targetRole || null,
        status: "ACTIVE",
        createdById: session.id,
      },
    });
    return NextResponse.json({ id: reminder.id }, { status: 201 });
  } catch (error) {
    console.error("Create reminder error:", error);
    return NextResponse.json({ error: "Gagal membuat reminder" }, { status: 500 });
  }
}

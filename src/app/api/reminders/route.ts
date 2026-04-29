import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const reminders = await prisma.reminder.findMany({
      where: { status: { not: "DELETED" } },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });

    const channelMap: Record<string, string> = {
      WHATSAPP: "WhatsApp", WHATSAPP_WEB: "WhatsApp + Web",
      WHATSAPP_EMAIL: "WhatsApp + Email", EMAIL: "Email",
    };
    const scheduleMap: Record<string, string> = {
      DAILY: "Setiap hari", WEEKLY: "Setiap minggu",
      IMMEDIATE: "Segera", CUSTOM_CRON: "Custom",
    };

    const data = reminders.map((r) => ({
      id: r.id,
      title: r.title,
      messageTemplate: r.messageTemplate,
      target: r.targetRole || "Semua Karyawan",
      schedule: `${scheduleMap[r.scheduleType] || r.scheduleType}, ${r.scheduledTime ? r.scheduledTime.toISOString().slice(11, 16) : "-"}`,
      channel: channelMap[r.channel] || r.channel,
      status: r.status.toLowerCase(),
      lastSent: r.lastSentAt
        ? r.lastSentAt.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) +
          " " + r.lastSentAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        : "-",
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Reminders API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
      },
    });
    return NextResponse.json({ id: reminder.id }, { status: 201 });
  } catch (error) {
    console.error("Create reminder error:", error);
    return NextResponse.json({ error: "Gagal membuat reminder" }, { status: 500 });
  }
}

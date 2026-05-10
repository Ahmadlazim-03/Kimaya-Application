import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/reminders/my?period=today|week|month
 *
 * Returns the current user's reminder kiriman within the period, grouped by
 * status (PENDING vs RESPONDED). Each item carries enough info for the list
 * UI: title, sentAt, rendered preview, and (if responded) thumbnail count.
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "today").toLowerCase();

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (period === "week") {
      // Indonesian convention: week starts Monday. Use ISO-ish: subtract days back to Monday.
      const dow = start.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const daysFromMonday = dow === 0 ? 6 : dow - 1;
      start.setDate(start.getDate() - daysFromMonday);
    } else if (period === "month") {
      start.setDate(1);
    } else {
      // "today" — already at 00:00 of today
    }

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const logs = await prisma.reminderLog.findMany({
      where: {
        userId: session.id,
        sentAt: { gte: start, lte: end },
      },
      include: {
        reminder: { select: { id: true, title: true, messageTemplate: true } },
        response: {
          select: {
            id: true,
            respondedAt: true,
            updatedAt: true,
            caption: true,
            images: {
              orderBy: { order: "asc" },
              select: { id: true, photoUrl: true },
              take: 4,
            },
          },
        },
      },
      orderBy: { sentAt: "desc" },
    });

    const items = logs.map((log) => ({
      logId: log.id,
      reminderId: log.reminderId,
      reminderTitle: log.reminder.title,
      sentAt: log.sentAt.toISOString(),
      renderedMessage: log.renderedMessage || log.reminder.messageTemplate,
      respondHref: `/dashboard/reminders/${log.reminderId}/respond?logId=${log.id}`,
      response: log.response
        ? {
            id: log.response.id,
            respondedAt: log.response.respondedAt.toISOString(),
            updatedAt: log.response.updatedAt.toISOString(),
            imageCount: log.response.images.length,
            thumbs: log.response.images.map((i) => i.photoUrl),
            caption: log.response.caption,
          }
        : null,
    }));

    const pending = items.filter((i) => !i.response);
    const responded = items.filter((i) => i.response);

    return NextResponse.json({
      period,
      range: { start: start.toISOString(), end: end.toISOString() },
      items,
      stats: {
        total: items.length,
        pending: pending.length,
        responded: responded.length,
      },
    });
  } catch (error) {
    console.error("My reminders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

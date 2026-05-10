import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/reminders/[id]/responses
 *   Admin endpoint — returns all responses for a single reminder, newest first.
 *   Includes user (avatar + name) and image gallery.
 *
 * Optional query: ?from=YYYY-MM-DD&to=YYYY-MM-DD to scope by respondedAt.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = { reminderId: id };
    if (from || to) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (from) dateFilter.gte = new Date(from + "T00:00:00.000Z");
      if (to) dateFilter.lte = new Date(to + "T23:59:59.999Z");
      where.respondedAt = dateFilter;
    }

    const reminder = await prisma.reminder.findUnique({
      where: { id },
      select: { id: true, title: true, messageTemplate: true, lastSentAt: true },
    });
    if (!reminder) return NextResponse.json({ error: "Reminder tidak ditemukan" }, { status: 404 });

    const [responses, totalLogs] = await Promise.all([
      prisma.reminderResponse.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              role: true,
              department: { select: { name: true } },
              location: { select: { name: true } },
            },
          },
          images: { orderBy: { order: "asc" } },
          log: { select: { id: true, sentAt: true } },
        },
        orderBy: { respondedAt: "desc" },
      }),
      prisma.reminderLog.count({ where: { reminderId: id } }),
    ]);

    const data = responses.map((r) => ({
      id: r.id,
      logId: r.reminderLogId,
      caption: r.caption,
      respondedAt: r.respondedAt,
      updatedAt: r.updatedAt,
      sentAt: r.log.sentAt,
      user: {
        id: r.user.id,
        name: r.user.fullName,
        avatarUrl: r.user.avatarUrl,
        role: r.user.role,
        department: r.user.department?.name || null,
        location: r.user.location?.name || null,
      },
      images: r.images.map((img) => ({
        id: img.id,
        photoUrl: img.photoUrl,
        description: img.description,
      })),
    }));

    return NextResponse.json({
      reminder,
      responses: data,
      stats: {
        responded: responses.length,
        totalSent: totalLogs,
        responseRate: totalLogs > 0 ? Math.round((responses.length / totalLogs) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("Responses list error:", error);
    return NextResponse.json({ error: "Gagal memuat tanggapan" }, { status: 500 });
  }
}

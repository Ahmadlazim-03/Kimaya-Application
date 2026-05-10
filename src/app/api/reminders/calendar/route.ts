import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/reminders/calendar?userId=<id|all>&month=YYYY-MM
 *
 * Two modes:
 *   1. Per therapist (userId=<uuid>) — returns one entry per day in the month
 *      with status RESPONDED / PENDING / MISSED / NOT_SCHEDULED, plus the
 *      response details if any.
 *   2. All therapists (userId=all) — returns aggregate stats per day:
 *      number of logs sent vs responded.
 *
 * Always returns the employee selector list as well so the UI can build the
 * "pilih therapist" dropdown without an extra round-trip.
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId") || "all";
    const monthStr = searchParams.get("month") || new Date().toISOString().slice(0, 7);

    const [year, month] = monthStr.split("-").map(Number);
    if (!year || !month) {
      return NextResponse.json({ error: "Format month tidak valid (YYYY-MM)" }, { status: 400 });
    }
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Therapist selector
    const employees = await prisma.user.findMany({
      where: { role: "THERAPIST", status: { in: ["ACTIVE", "PROBATION"] } },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        department: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: { fullName: "asc" },
    });
    const employeeList = employees.map((e) => ({
      id: e.id,
      name: e.fullName,
      dept: e.department?.name || "-",
      location: e.location?.name || "-",
      avatar: e.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
      avatarUrl: e.avatarUrl,
    }));

    // ── Mode 1: per-therapist day-by-day ──
    if (userIdParam !== "all") {
      const user = await prisma.user.findUnique({
        where: { id: userIdParam },
        select: {
          id: true, fullName: true, avatarUrl: true, role: true,
          department: { select: { name: true } },
          location: { select: { name: true } },
        },
      });
      if (!user) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });

      const logs = await prisma.reminderLog.findMany({
        where: {
          userId: userIdParam,
          sentAt: { gte: startDate, lte: endDate },
        },
        include: {
          reminder: { select: { id: true, title: true } },
          response: {
            include: { images: { orderBy: { order: "asc" }, take: 4 } },
          },
        },
        orderBy: { sentAt: "asc" },
      });

      // Bucket by day-of-month
      type DayBucket = {
        day: number; date: string;
        logs: number; responded: number; missed: number; pending: number;
        status: "RESPONDED" | "PENDING" | "MISSED" | "NOT_SCHEDULED";
        items: {
          logId: string; reminderId: string; reminderTitle: string;
          sentAt: string; respondedAt: string | null;
          imageCount: number; thumbs: string[]; caption: string | null;
          status: "RESPONDED" | "PENDING" | "MISSED";
        }[];
      };
      const buckets = new Map<number, DayBucket>();
      const today = new Date(); today.setHours(23, 59, 59, 999);

      for (const log of logs) {
        const d = new Date(log.sentAt);
        const dayNum = d.getDate();
        const dateStr = d.toISOString().split("T")[0];
        if (!buckets.has(dayNum)) {
          buckets.set(dayNum, { day: dayNum, date: dateStr, logs: 0, responded: 0, missed: 0, pending: 0, status: "NOT_SCHEDULED", items: [] });
        }
        const bucket = buckets.get(dayNum)!;
        bucket.logs++;
        const isResponded = !!log.response;
        const cellDate = new Date(year, month - 1, dayNum, 23, 59, 59);
        const isPastDay = cellDate < new Date(today);

        let itemStatus: "RESPONDED" | "PENDING" | "MISSED";
        if (isResponded) {
          bucket.responded++;
          itemStatus = "RESPONDED";
        } else if (isPastDay) {
          bucket.missed++;
          itemStatus = "MISSED";
        } else {
          bucket.pending++;
          itemStatus = "PENDING";
        }

        bucket.items.push({
          logId: log.id,
          reminderId: log.reminderId,
          reminderTitle: log.reminder.title,
          sentAt: log.sentAt.toISOString(),
          respondedAt: log.response?.respondedAt.toISOString() || null,
          imageCount: log.response?.images.length || 0,
          thumbs: log.response?.images.map((i) => i.photoUrl) || [],
          caption: log.response?.caption || null,
          status: itemStatus,
        });
      }

      // Resolve a single status per day cell.
      for (const b of buckets.values()) {
        if (b.responded > 0 && b.responded === b.logs) b.status = "RESPONDED";
        else if (b.missed > 0 && b.responded === 0 && b.pending === 0) b.status = "MISSED";
        else if (b.pending > 0) b.status = "PENDING";
        else if (b.responded > 0) b.status = "RESPONDED"; // partial — still shown green
      }

      const totalLogs = logs.length;
      const totalResponded = logs.filter((l) => l.response).length;
      const summary = {
        employee: {
          id: user.id, name: user.fullName, avatar: user.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
          avatarUrl: user.avatarUrl, role: user.role,
          dept: user.department?.name || "-",
          location: user.location?.name || "-",
        },
        month: monthStr,
        monthLabel: startDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
        totalLogs,
        totalResponded,
        totalMissed: logs.filter((l) => !l.response && new Date(l.sentAt) < new Date(today)).length,
        totalPending: logs.filter((l) => !l.response && new Date(l.sentAt) >= new Date(today)).length,
        responseRate: totalLogs > 0 ? Math.round((totalResponded / totalLogs) * 100) : 0,
      };

      return NextResponse.json({
        mode: "user",
        employees: employeeList,
        days: Array.from(buckets.values()),
        summary,
      });
    }

    // ── Mode 2: aggregate across all therapists ──
    const logs = await prisma.reminderLog.findMany({
      where: {
        sentAt: { gte: startDate, lte: endDate },
        user: { role: "THERAPIST" },
      },
      include: {
        response: {
          include: {
            images: { orderBy: { order: "asc" }, take: 1 },
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
        reminder: { select: { id: true, title: true } },
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { sentAt: "asc" },
    });

    type AggDay = {
      day: number; date: string;
      logs: number; responded: number; missed: number; pending: number;
      status: "RESPONDED" | "PENDING" | "MISSED" | "NOT_SCHEDULED";
      responses: {
        logId: string; reminderId: string;
        userId: string; userName: string; userAvatar: string | null;
        reminderTitle: string; respondedAt: string;
        firstImage: string | null; caption: string | null;
      }[];
    };
    const buckets = new Map<number, AggDay>();
    const today = new Date(); today.setHours(23, 59, 59, 999);

    for (const log of logs) {
      const d = new Date(log.sentAt);
      const dayNum = d.getDate();
      const dateStr = d.toISOString().split("T")[0];
      if (!buckets.has(dayNum)) {
        buckets.set(dayNum, { day: dayNum, date: dateStr, logs: 0, responded: 0, missed: 0, pending: 0, status: "NOT_SCHEDULED", responses: [] });
      }
      const bucket = buckets.get(dayNum)!;
      bucket.logs++;
      const cellDate = new Date(year, month - 1, dayNum, 23, 59, 59);
      const isPastDay = cellDate < new Date(today);

      if (log.response) {
        bucket.responded++;
        bucket.responses.push({
          logId: log.id,
          reminderId: log.reminderId,
          userId: log.response.user.id,
          userName: log.response.user.fullName,
          userAvatar: log.response.user.avatarUrl,
          reminderTitle: log.reminder.title,
          respondedAt: log.response.respondedAt.toISOString(),
          firstImage: log.response.images[0]?.photoUrl || null,
          caption: log.response.caption,
        });
      } else if (isPastDay) {
        bucket.missed++;
      } else {
        bucket.pending++;
      }
    }

    for (const b of buckets.values()) {
      if (b.responded > 0 && b.responded === b.logs) b.status = "RESPONDED";
      else if (b.responded > 0) b.status = "RESPONDED"; // partial
      else if (b.pending > 0) b.status = "PENDING";
      else if (b.missed > 0) b.status = "MISSED";
    }

    const totalLogs = logs.length;
    const totalResponded = logs.filter((l) => l.response).length;
    const totalMissed = logs.filter((l) => !l.response && new Date(l.sentAt) < new Date(today)).length;

    return NextResponse.json({
      mode: "all",
      employees: employeeList,
      days: Array.from(buckets.values()),
      summary: {
        month: monthStr,
        monthLabel: startDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
        totalLogs,
        totalResponded,
        totalMissed,
        totalPending: totalLogs - totalResponded - totalMissed,
        responseRate: totalLogs > 0 ? Math.round((totalResponded / totalLogs) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("Reminder calendar error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

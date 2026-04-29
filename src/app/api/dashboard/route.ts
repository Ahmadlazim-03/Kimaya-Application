import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalEmployees,
      todayAttendance,
      pendingReports,
      scores,
      recentAttendance,
      weeklyAttendance,
    ] = await Promise.all([
      // Total active employees
      prisma.user.count({ where: { status: { in: ["ACTIVE", "PROBATION"] }, role: "EMPLOYEE" } }),

      // Today's attendance
      prisma.attendance.findMany({
        where: { date: today },
        include: { user: { select: { fullName: true } } },
      }),

      // Pending reports
      prisma.report.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),

      // Current month scores
      prisma.employeeScore.findMany({
        where: {
          periodDate: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
          },
        },
        include: { user: { select: { fullName: true, department: { select: { name: true } } } } },
        orderBy: { totalScore: "desc" },
      }),

      // Recent attendance with user info
      prisma.attendance.findMany({
        where: { date: today },
        include: { user: { select: { fullName: true } } },
        orderBy: { checkInTime: "desc" },
        take: 6,
      }),

      // Weekly attendance (last 6 days + today)
      prisma.attendance.groupBy({
        by: ["date", "status"],
        where: {
          date: { gte: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000) },
        },
        _count: true,
        orderBy: { date: "asc" },
      }),
    ]);

    const presentToday = todayAttendance.filter(
      (a) => a.status === "ON_TIME" || a.status === "LATE"
    ).length;

    const avgScore =
      scores.length > 0
        ? Math.round(
            scores.reduce((s, e) => s + Number(e.totalScore), 0) / scores.length
          )
        : 0;

    // Build weekly data
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const weekMap = new Map<string, { hadir: number; tidakHadir: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      weekMap.set(key, { hadir: 0, tidakHadir: 0 });
    }
    for (const row of weeklyAttendance) {
      const key = new Date(row.date).toISOString().split("T")[0];
      const entry = weekMap.get(key);
      if (entry) {
        if (row.status === "ON_TIME" || row.status === "LATE" || row.status === "EARLY") {
          entry.hadir += row._count;
        } else {
          entry.tidakHadir += row._count;
        }
      }
    }
    const attendanceWeek = Array.from(weekMap.entries()).map(([dateStr, data]) => ({
      day: dayNames[new Date(dateStr).getDay()],
      ...data,
    }));

    // Top performers
    const topPerformers = scores.slice(0, 5).map((s) => ({
      name: s.user.fullName,
      dept: s.user.department?.name || "-",
      score: Number(s.totalScore),
      avatar: s.user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    }));

    // Recent activity
    const activity = recentAttendance.map((a) => ({
      name: a.user.fullName,
      action: a.checkInTime ? "Check-in" : "Absent",
      time: a.checkInTime
        ? new Date(a.checkInTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        : "-",
      status: a.status === "ON_TIME" ? "on-time" : a.status === "LATE" ? "late" : "absent",
      avatar: a.user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    }));

    return NextResponse.json({
      stats: {
        totalEmployees,
        presentToday,
        attendanceRate: totalEmployees > 0 ? ((presentToday / totalEmployees) * 100).toFixed(1) : "0",
        pendingReports,
        avgScore,
      },
      attendanceWeek,
      topPerformers,
      recentActivity: activity,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

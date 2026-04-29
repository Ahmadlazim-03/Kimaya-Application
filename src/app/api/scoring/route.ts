import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [scores, previousScores, config] = await Promise.all([
      prisma.employeeScore.findMany({
        where: { periodDate: currentMonth },
        include: { user: { select: { fullName: true, department: { select: { name: true } } } } },
        orderBy: { totalScore: "desc" },
      }),
      prisma.employeeScore.findMany({
        where: {
          periodDate: {
            gte: new Date(today.getFullYear(), today.getMonth() - 3, 1),
            lt: currentMonth,
          },
        },
        orderBy: { periodDate: "asc" },
      }),
      prisma.scoreConfig.findFirst({ where: { departmentId: null } }),
    ]);

    const employees = scores.map((s) => ({
      id: s.id,
      userId: s.userId,
      name: s.user.fullName,
      dept: s.user.department?.name || "-",
      avatar: s.user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
      attendance: Number(s.attendanceScore),
      reports: Number(s.reportCompletenessScore),
      quality: Number(s.reportQualityScore),
      response: Number(s.responseSpeedScore),
      initiative: Number(s.initiativeScore),
      total: Number(s.totalScore),
      grade: s.grade || "-",
    }));

    const avgScore = employees.length > 0
      ? Math.round(employees.reduce((s, e) => s + e.total, 0) / employees.length)
      : 0;
    const topScore = employees.length > 0 ? Math.max(...employees.map((e) => e.total)) : 0;
    const lowScore = employees.length > 0 ? Math.min(...employees.map((e) => e.total)) : 0;
    const belowThreshold = employees.filter((e) => e.total < (config?.thresholdAlert || 70)).length;

    // Monthly trend
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const trendMap = new Map<string, { total: number; count: number }>();
    for (const s of previousScores) {
      const key = new Date(s.periodDate).toISOString().slice(0, 7);
      const entry = trendMap.get(key) || { total: 0, count: 0 };
      entry.total += Number(s.totalScore);
      entry.count += 1;
      trendMap.set(key, entry);
    }
    // Add current month
    if (employees.length > 0) {
      const curKey = currentMonth.toISOString().slice(0, 7);
      trendMap.set(curKey, {
        total: employees.reduce((s, e) => s + e.total, 0),
        count: employees.length,
      });
    }
    const monthlyTrend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => ({
        month: monthNames[parseInt(key.split("-")[1]) - 1],
        avg: Math.round(data.total / data.count),
      }));

    const scoreComponents = [
      { name: "Kehadiran", weight: `${config?.attendanceWeight || 30}%`, emoji: "⏰" },
      { name: "Kelengkapan", weight: `${config?.reportCompletenessWeight || 25}%`, emoji: "📄" },
      { name: "Kualitas", weight: `${config?.reportQualityWeight || 20}%`, emoji: "⭐" },
      { name: "Respons", weight: `${config?.responseSpeedWeight || 15}%`, emoji: "⚡" },
      { name: "Inisiatif", weight: `${config?.initiativeWeight || 10}%`, emoji: "🎯" },
    ];

    return NextResponse.json({
      employees,
      stats: { avgScore, topScore, lowScore, belowThreshold },
      monthlyTrend,
      scoreComponents,
    });
  } catch (error) {
    console.error("Scoring API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

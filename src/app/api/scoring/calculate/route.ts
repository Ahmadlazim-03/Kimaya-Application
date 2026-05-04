import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST() {
  try {
    const now = new Date();
    const periodDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get score weights
    const scoreConfig = await prisma.scoreConfig.findFirst({ where: { departmentId: null } });
    const weights = {
      attendance: scoreConfig?.attendanceWeight || 30,
      reportCompleteness: scoreConfig?.reportCompletenessWeight || 25,
      reportQuality: scoreConfig?.reportQualityWeight || 20,
      responseSpeed: scoreConfig?.responseSpeedWeight || 15,
      initiative: scoreConfig?.initiativeWeight || 10,
    };

    // Get all active employees
    const employees = await prisma.user.findMany({
      where: { role: { in: ["THERAPIST", "DEVELOPER"] }, status: { in: ["ACTIVE", "PROBATION"] } },
      include: {
        attendances: { where: { date: { gte: startOfMonth, lte: endOfMonth } } },
        reports: { where: { createdAt: { gte: startOfMonth, lte: endOfMonth } } },
      },
    });

    // Count total working days in month (Mon-Fri)
    let workingDays = 0;
    const dayCheck = new Date(startOfMonth);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    while (dayCheck <= endOfMonth && dayCheck <= today) {
      const dow = dayCheck.getDay();
      if (dow > 0 && dow < 6) workingDays++;
      dayCheck.setDate(dayCheck.getDate() + 1);
    }
    if (workingDays === 0) workingDays = 1;

    const results: { name: string; total: number; grade: string }[] = [];

    for (const emp of employees) {
      // 1. Attendance Score (% on-time out of working days, late gets partial)
      const onTime = emp.attendances.filter(a => a.status === "ON_TIME").length;
      const late = emp.attendances.filter(a => a.status === "LATE").length;
      const attended = onTime + late;
      const attendanceRaw = workingDays > 0 ? ((onTime + late * 0.7) / workingDays) * 100 : 0;
      const attendanceScore = Math.min(100, Math.round(attendanceRaw));

      // 2. Report Completeness (has submitted any reports this month)
      const reportsSubmitted = emp.reports.filter(r => r.status !== "DRAFT").length;
      const expectedReports = Math.max(1, Math.ceil(workingDays / 5)); // ~1 per week
      const reportCompletenessRaw = (reportsSubmitted / expectedReports) * 100;
      const reportCompletenessScore = Math.min(100, Math.round(reportCompletenessRaw));

      // 3. Report Quality (approved vs total submitted)
      const approved = emp.reports.filter(r => r.status === "APPROVED").length;
      const submitted = emp.reports.filter(r => r.status !== "DRAFT").length;
      const reportQualityScore = submitted > 0 ? Math.round((approved / submitted) * 100) : 50; // default 50 if no reports

      // 4. Response Speed (% not late out of attended)
      const responseSpeedScore = attended > 0 ? Math.round((onTime / attended) * 100) : 50;

      // 5. Initiative (bonus: extra reports, no absences, cleanliness reports)
      let initiativeBonus = 50; // base
      if (reportsSubmitted > expectedReports) initiativeBonus += 20;
      if (late === 0 && attended >= workingDays * 0.8) initiativeBonus += 20;
      const cleanlinessReports = emp.reports.filter(r => {
        const meta = r.metadata as Record<string, unknown> | null;
        return meta && meta.cleanlinessScore;
      }).length;
      if (cleanlinessReports > 0) initiativeBonus += 10;
      const initiativeScore = Math.min(100, initiativeBonus);

      // Weighted total
      const totalScore = Math.round(
        (attendanceScore * weights.attendance +
          reportCompletenessScore * weights.reportCompleteness +
          reportQualityScore * weights.reportQuality +
          responseSpeedScore * weights.responseSpeed +
          initiativeScore * weights.initiative) / 100
      );

      const grade = totalScore >= 90 ? "A" : totalScore >= 80 ? "B" : totalScore >= 70 ? "C" : "D";

      // Upsert score
      const existing = await prisma.employeeScore.findFirst({
        where: { userId: emp.id, periodDate },
      });

      if (existing) {
        await prisma.employeeScore.update({
          where: { id: existing.id },
          data: {
            attendanceScore, reportCompletenessScore, reportQualityScore,
            responseSpeedScore, initiativeScore, totalScore, grade,
          },
        });
      } else {
        await prisma.employeeScore.create({
          data: {
            userId: emp.id, periodDate,
            attendanceScore, reportCompletenessScore, reportQualityScore,
            responseSpeedScore, initiativeScore, totalScore, grade,
          },
        });
      }

      results.push({ name: emp.fullName, total: totalScore, grade });
    }

    return NextResponse.json({
      message: `Skor ${results.length} karyawan berhasil dihitung`,
      period: periodDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      results: results.sort((a, b) => b.total - a.total),
    });
  } catch (error) {
    console.error("Auto-scoring error:", error);
    return NextResponse.json({ error: "Gagal menghitung skor" }, { status: 500 });
  }
}

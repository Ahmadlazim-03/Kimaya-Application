import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "";

    const where: Record<string, unknown> = {};
    if (category) where.category = category;

    const reports = await prisma.report.findMany({
      where,
      include: {
        user: { select: { fullName: true } },
        reviewedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const statusMap: Record<string, string> = {
      APPROVED: "approved", SUBMITTED: "submitted", UNDER_REVIEW: "submitted",
      REVISION_REQUIRED: "revision", DRAFT: "draft",
    };
    const categoryMap: Record<string, string> = {
      CLIENT_VISIT: "Kunjungan Klien", PROJECT_PROGRESS: "Progress Proyek",
      DAILY_REPORT: "Laporan Harian", EXPENSE_PROOF: "Bukti Pengeluaran",
    };

    const data = reports.map((r) => ({
      id: r.id,
      title: r.title,
      by: r.user.fullName,
      date: r.createdAt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
      category: categoryMap[r.category] || r.category,
      status: statusMap[r.status] || r.status.toLowerCase(),
      fileType: r.fileType || "PDF",
      avatar: r.user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    }));

    const stats = {
      total: reports.length,
      approved: reports.filter((r) => r.status === "APPROVED").length,
      pending: reports.filter((r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW").length,
      revision: reports.filter((r) => r.status === "REVISION_REQUIRED").length,
    };

    return NextResponse.json({ reports: data, stats });
  } catch (error) {
    console.error("Reports API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

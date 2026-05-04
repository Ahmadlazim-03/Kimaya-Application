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
      CLEANLINESS: "Laporan Kebersihan",
    };

    const data = reports.map((r) => ({
      id: r.id,
      title: r.title,
      by: r.user.fullName,
      date: r.createdAt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
      category: categoryMap[r.category] || r.category,
      rawCategory: r.category,
      status: statusMap[r.status] || r.status.toLowerCase(),
      fileType: r.fileType || "PDF",
      hasPhoto: !!(r.fileUrl),
      gpsLocation: r.metadata && typeof r.metadata === "object" && "latitude" in (r.metadata as Record<string, unknown>) ? true : false,
      cleanlinessScore: r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>).cleanlinessScore : null,
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, title, category, description, photoBase64, latitude, longitude, cleanlinessChecks } = body;

    // Validate cleanliness report
    let cleanlinessScore = 0;
    if (category === "CLEANLINESS" && cleanlinessChecks) {
      const checks = cleanlinessChecks as Record<string, boolean>;
      const total = Object.keys(checks).length;
      const passed = Object.values(checks).filter(Boolean).length;
      cleanlinessScore = total > 0 ? Math.round((passed / total) * 100) : 0;
    }

    // Validate photo exists for cleanliness report
    if (category === "CLEANLINESS" && !photoBase64) {
      return NextResponse.json({ error: "Foto bukti kebersihan wajib diupload" }, { status: 400 });
    }

    // Validate GPS for cleanliness report
    if (category === "CLEANLINESS" && (!latitude || !longitude)) {
      return NextResponse.json({ error: "Lokasi GPS wajib diaktifkan untuk laporan kebersihan" }, { status: 400 });
    }

    const metadata: Record<string, unknown> = {};
    if (latitude && longitude) {
      metadata.latitude = latitude;
      metadata.longitude = longitude;
    }
    if (cleanlinessChecks) {
      metadata.cleanlinessChecks = cleanlinessChecks;
      metadata.cleanlinessScore = cleanlinessScore;
    }
    if (photoBase64) {
      metadata.hasPhoto = true;
      metadata.photoTimestamp = new Date().toISOString();
    }

    const report = await prisma.report.create({
      data: {
        userId,
        title: title || (category === "CLEANLINESS" ? "Laporan Kebersihan Area" : "Laporan"),
        category: category === "CLEANLINESS" ? "DAILY_REPORT" : category,
        description: description || (category === "CLEANLINESS"
          ? `Laporan kebersihan area - Skor: ${cleanlinessScore}%`
          : ""),
        fileUrl: photoBase64 ? `data:image/jpeg;base64,${photoBase64.substring(0, 100)}...` : null,
        fileType: photoBase64 ? "IMAGE" : "PDF",
        status: "SUBMITTED",
        submittedAt: new Date(),
        metadata: metadata as any,
      },
    });

    return NextResponse.json({
      id: report.id,
      cleanlinessScore,
      message: category === "CLEANLINESS"
        ? cleanlinessScore >= 80
          ? `✅ Laporan kebersihan diterima! Skor: ${cleanlinessScore}%`
          : `⚠️ Laporan diterima tapi skor kebersihan rendah (${cleanlinessScore}%). Perlu perbaikan!`
        : "✅ Laporan berhasil disubmit",
    });
  } catch (error) {
    console.error("Reports POST error:", error);
    return NextResponse.json({ error: "Gagal mengirim laporan" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;
    await prisma.report.update({
      where: { id },
      data: { status, reviewedAt: new Date() },
    });
    return NextResponse.json({ message: "Laporan berhasil diupdate" });
  } catch (error) {
    console.error("Reports PUT error:", error);
    return NextResponse.json({ error: "Gagal mengupdate laporan" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendReminder } from "@/lib/waha";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reminder = await prisma.reminder.findUnique({ where: { id } });
    if (!reminder) return NextResponse.json({ error: "Reminder tidak ditemukan" }, { status: 404 });

    // Build employee filter based on targetRole
    const whereClause: Record<string, unknown> = {
      status: { in: ["ACTIVE", "PROBATION"] },
      phone: { not: null },
    };

    // If reminder targets a specific role, filter by that role
    if (reminder.targetRole) {
      whereClause.role = reminder.targetRole;
    } else {
      // Default: send to all THERAPISTs
      whereClause.role = "THERAPIST";
    }

    // If targeting a specific user
    if (reminder.targetUserId) {
      whereClause.id = reminder.targetUserId;
    }

    const employees = await prisma.user.findMany({
      where: whereClause,
      include: {
        scores: { orderBy: { periodDate: "desc" }, take: 1 },
        location: { select: { name: true } },
      },
    });

    if (employees.length === 0) {
      return NextResponse.json({
        message: "Tidak ada karyawan dengan nomor telepon yang terdaftar",
        results: [],
      });
    }

    const results: { name: string; phone: string; success: boolean; error?: string }[] = [];
    const today = new Date().toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    for (const emp of employees) {
      if (!emp.phone) continue;
      try {
        const score = emp.scores[0]?.totalScore?.toString() || "-";
        const location = emp.location?.name || "-";

        await sendReminder(emp.phone, reminder.messageTemplate, {
          nama: emp.fullName,
          skor: score,
          tanggal: today,
          lokasi: location,
        });

        // Log the sent reminder
        await prisma.reminderLog.create({
          data: { reminderId: id, userId: emp.id, status: "SENT", channel: reminder.channel },
        });

        results.push({ name: emp.fullName, phone: emp.phone, success: true });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        await prisma.reminderLog.create({
          data: { reminderId: id, userId: emp.id, status: "FAILED", channel: reminder.channel, errorMessage: errMsg },
        });
        results.push({ name: emp.fullName, phone: emp.phone, success: false, error: errMsg });
      }
    }

    // Update last sent time
    await prisma.reminder.update({ where: { id }, data: { lastSentAt: new Date() } });

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      message: `Reminder terkirim ke ${sent} karyawan${failed > 0 ? `, ${failed} gagal` : ""}`,
      results,
    });
  } catch (error) {
    console.error("Send reminder error:", error);
    const msg = error instanceof Error ? error.message : "Gagal mengirim reminder";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

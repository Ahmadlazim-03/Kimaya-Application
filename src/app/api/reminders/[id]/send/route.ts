import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendReminder } from "@/lib/waha";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reminder = await prisma.reminder.findUnique({ where: { id } });
    if (!reminder) return NextResponse.json({ error: "Reminder tidak ditemukan" }, { status: 404 });

    // Get all active employees
    const employees = await prisma.user.findMany({
      where: { role: "THERAPIST", status: { in: ["ACTIVE", "PROBATION"] }, phone: { not: null } },
      include: { scores: { orderBy: { periodDate: "desc" }, take: 1 } },
    });

    const results: { name: string; phone: string; success: boolean; error?: string }[] = [];

    for (const emp of employees) {
      if (!emp.phone) continue;
      try {
        const score = emp.scores[0]?.totalScore?.toString() || "-";
        await sendReminder(emp.phone, reminder.messageTemplate, {
          nama: emp.fullName,
          skor: score,
          tanggal: new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
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
    return NextResponse.json({ error: "Gagal mengirim reminder" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendText, phoneToWaChatId } from "@/lib/waha";
import { sendWebPushToUser } from "@/lib/notifications";
import { renderReminderMessage, formatTodayId } from "@/lib/reminderTemplate";

/**
 * POST /api/reminders/[id]/send
 *
 * Manual fan-out of a reminder to all matching recipients. For each recipient:
 *   1. Send WhatsApp via WAHA (templated)
 *   2. Persist a ReminderLog (with rendered message snapshot)
 *   3. Send Web Push pointing at /dashboard/reminders/[id]/respond?logId=...
 *      so the recipient lands directly on the response form when they tap it.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reminder = await prisma.reminder.findUnique({ where: { id } });
    if (!reminder) {
      return NextResponse.json({ error: "Reminder tidak ditemukan" }, { status: 404 });
    }

    const whereClause: Record<string, unknown> = {
      status: { in: ["ACTIVE", "PROBATION"] },
      phone: { not: null },
    };
    if (reminder.targetRole) {
      whereClause.role = reminder.targetRole;
    } else {
      whereClause.role = "THERAPIST";
    }
    if (reminder.targetUserId) {
      whereClause.id = reminder.targetUserId;
    }

    const employees = await prisma.user.findMany({
      where: whereClause,
      include: {
        scores: { orderBy: { periodDate: "desc" }, take: 1 },
        location: { select: { name: true } },
        department: { select: { name: true } },
        shift: { select: { name: true } },
      },
    });

    if (employees.length === 0) {
      return NextResponse.json({
        message: "Tidak ada karyawan dengan nomor telepon yang terdaftar",
        results: [],
      });
    }

    interface PerRecipientResult {
      name: string; phone: string;
      whatsapp: "SENT" | "FAILED";
      push: "DELIVERED" | "NO_SUBSCRIPTION" | "FAILED" | "SKIPPED";
      pushDelivered: number; pushAttempted: number;
      error?: string;
    }
    const results: PerRecipientResult[] = [];
    const today = formatTodayId();

    for (const emp of employees) {
      if (!emp.phone) continue;

      const vars = {
        nama: emp.fullName,
        tanggal: today,
        skor: emp.scores[0]?.totalScore?.toString() ?? null,
        lokasi: emp.location?.name ?? null,
        shift: emp.shift?.name ?? null,
        role: emp.role,
        departemen: emp.department?.name ?? null,
        telepon: emp.phone,
      };
      const renderedMessage = renderReminderMessage(reminder.messageTemplate, vars);

      let waStatus: "SENT" | "FAILED" = "SENT";
      let errorMessage: string | undefined;

      try {
        await sendText(phoneToWaChatId(emp.phone), renderedMessage);
      } catch (err) {
        waStatus = "FAILED";
        errorMessage = err instanceof Error ? err.message : "Unknown error";
      }

      // Persist log so we have a logId to embed in the push payload.
      const log = await prisma.reminderLog.create({
        data: {
          reminderId: id,
          userId: emp.id,
          status: waStatus,
          channel: reminder.channel,
          renderedMessage,
          errorMessage,
        },
      });

      // Web Push delivery — diagnostic result so we can report back accurately.
      let pushStatus: PerRecipientResult["push"] = "SKIPPED";
      let pushDelivered = 0, pushAttempted = 0;
      let pushSkipReason: string | undefined;
      try {
        const pushResult = await sendWebPushToUser(
          emp.id,
          reminder.title,
          renderedMessage,
          `/dashboard/reminders/${id}/respond?logId=${log.id}`
        );
        pushDelivered = pushResult.delivered;
        pushAttempted = pushResult.attempted;
        pushSkipReason = pushResult.skipReason;
        if (pushResult.skipReason === "no-subscription") {
          pushStatus = "NO_SUBSCRIPTION";
        } else if (pushResult.skipReason === "vapid-not-configured") {
          pushStatus = "FAILED"; // surface as failure, with explicit reason in summary
        } else if (pushResult.delivered > 0) {
          pushStatus = "DELIVERED";
        } else if (pushResult.attempted > 0) {
          pushStatus = "FAILED";
        }
      } catch (err) {
        pushStatus = "FAILED";
        pushSkipReason = err instanceof Error ? err.message : "Unknown error";
        console.error("[Push] reminder push failed for user", emp.id, err);
      }

      results.push({
        name: emp.fullName,
        phone: emp.phone,
        whatsapp: waStatus,
        push: pushStatus,
        pushDelivered,
        pushAttempted,
        error: errorMessage,
      });

      if (pushSkipReason) {
        (results[results.length - 1] as PerRecipientResult & { pushReason?: string }).pushReason = pushSkipReason;
      }
    }

    await prisma.reminder.update({ where: { id }, data: { lastSentAt: new Date() } });

    const waSent = results.filter((r) => r.whatsapp === "SENT").length;
    const waFailed = results.filter((r) => r.whatsapp === "FAILED").length;
    const pushDelivered = results.filter((r) => r.push === "DELIVERED").length;
    const noSub = results.filter((r) => r.push === "NO_SUBSCRIPTION").length;
    const pushFailed = results.filter((r) => r.push === "FAILED").length;

    // Detect the dominant failure reason for an admin-friendly hint.
    let hint: string | undefined;
    const vapidIssue = results.some((r) => (r as { pushReason?: string }).pushReason === "vapid-not-configured");
    if (vapidIssue) hint = "VAPID env belum dikonfigurasi di server";
    else if (pushFailed > 0 && pushDelivered === 0) {
      const firstReason = (results.find((r) => r.push === "FAILED") as { pushReason?: string })?.pushReason;
      if (firstReason) hint = `Error: ${firstReason}`;
    }

    const parts: string[] = [];
    parts.push(`WhatsApp: ${waSent}/${results.length} terkirim`);
    if (waFailed > 0) parts.push(`${waFailed} gagal`);
    parts.push(`Push: ${pushDelivered}/${results.length} sampai`);
    if (noSub > 0) parts.push(`${noSub} belum aktifkan notifikasi`);
    if (pushFailed > 0) parts.push(`${pushFailed} gagal`);
    if (hint) parts.push(hint);

    return NextResponse.json({
      message: parts.join(" • "),
      summary: { total: results.length, waSent, waFailed, pushDelivered, noSub, pushFailed, hint },
      results,
    });
  } catch (error) {
    console.error("Send reminder error:", error);
    const msg = error instanceof Error ? error.message : "Gagal mengirim reminder";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

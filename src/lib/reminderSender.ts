/**
 * Shared reminder sender.
 *
 * Both the manual "Kirim Sekarang" button and the embedded scheduler funnel
 * through this module so behavior is identical. Responsibilities:
 *   1. Resolve recipients (ALL_THERAPISTS scoped by location, or explicit list)
 *   2. Render the message per recipient (template substitution)
 *   3. Send WhatsApp text (image attachments are NOT sent via WAHA — pricing)
 *   4. Persist a ReminderLog (one per delivery, even retries)
 *   5. Send Web Push pointing at the respond page
 *
 * NOTE: Images are stored with the reminder and rendered in the respond page,
 * but never attached to the WhatsApp message.
 */

import prisma from "@/lib/prisma";
import { sendText, phoneToWaChatId } from "@/lib/waha";
import { sendWebPushToUser } from "@/lib/notifications";
import { renderReminderMessage, formatTodayId } from "@/lib/reminderTemplate";

export interface SendOptions {
  /**
   * If provided, deliver to exactly these user IDs (used by the retry pass to
   * re-send to one specific recipient who has not opened the reminder).
   * Otherwise, recipients are resolved from `reminder.targetMode` / `recipients`.
   */
  userIdsOverride?: string[];
  /**
   * Marks the log entries as retries (increments retryCount + lastRetryAt
   * instead of treating them as a fresh send).
   * Pair with `userIdsOverride` to target the existing log's user.
   * The retry passes an existing log ID via `existingLogId` so we don't create
   * a new row — we just bump the counter.
   */
  retry?: { existingLogId: string };
}

export interface PerRecipientResult {
  userId: string;
  name: string;
  phone: string;
  whatsapp: "SENT" | "FAILED" | "SKIPPED";
  push: "DELIVERED" | "NO_SUBSCRIPTION" | "FAILED" | "SKIPPED";
  pushDelivered: number;
  pushAttempted: number;
  logId?: string;
  error?: string;
  pushReason?: string;
}

export interface SendSummary {
  reminderId: string;
  total: number;
  waSent: number;
  waFailed: number;
  pushDelivered: number;
  noSub: number;
  pushFailed: number;
  hint?: string;
  results: PerRecipientResult[];
  /** Friendly human-readable summary line shown in toasts. */
  message: string;
}

/**
 * Resolve the list of recipient users for a reminder.
 *
 * Rules:
 *   - SELECTED  → use the rows in `reminder_recipients`.
 *   - ALL_THERAPISTS → every THERAPIST with status ACTIVE/PROBATION + phone.
 *   - If reminder.locationScopeId is set, restrict to that location only —
 *     this enforces "CS Surabaya only reaches Surabaya therapists" without
 *     leaking across branches.
 *   - Legacy single-target fields (targetUserId / targetRole) are honored
 *     for backward compat with rows created before the multi-recipient
 *     migration.
 */
async function resolveRecipients(
  reminderId: string,
  override?: string[]
) {
  if (override && override.length > 0) {
    return prisma.user.findMany({
      where: { id: { in: override }, phone: { not: null } },
      include: {
        scores: { orderBy: { periodDate: "desc" }, take: 1 },
        location: { select: { name: true } },
        department: { select: { name: true } },
        shift: { select: { name: true } },
      },
    });
  }

  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: { recipients: { select: { userId: true } } },
  });
  if (!reminder) return [];

  let where: Record<string, unknown> = {
    status: { in: ["ACTIVE", "PROBATION"] },
    phone: { not: null },
  };

  if (reminder.targetMode === "SELECTED" && reminder.recipients.length > 0) {
    where.id = { in: reminder.recipients.map((r) => r.userId) };
  } else if (reminder.targetUserId) {
    // Legacy single-user reminders.
    where.id = reminder.targetUserId;
  } else {
    // ALL_THERAPISTS (or legacy role-based).
    where.role = reminder.targetRole || "THERAPIST";
  }

  // Location scope (only applies to ALL_THERAPISTS — if you SELECTED a user
  // explicitly we trust the operator chose intentionally).
  if (reminder.targetMode === "ALL_THERAPISTS" && reminder.locationScopeId) {
    where.locationId = reminder.locationScopeId;
  }

  return prisma.user.findMany({
    where,
    include: {
      scores: { orderBy: { periodDate: "desc" }, take: 1 },
      location: { select: { name: true } },
      department: { select: { name: true } },
      shift: { select: { name: true } },
    },
  });
}

/**
 * Core sender — dispatches WhatsApp + Web Push to the given recipients,
 * persists ReminderLog rows, and returns a summary.
 */
export async function sendReminderToRecipients(
  reminderId: string,
  options: SendOptions = {}
): Promise<SendSummary> {
  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!reminder) {
    return {
      reminderId, total: 0, waSent: 0, waFailed: 0, pushDelivered: 0, noSub: 0, pushFailed: 0,
      results: [], message: "Pengingat tidak ditemukan",
    };
  }

  const employees = await resolveRecipients(reminderId, options.userIdsOverride);

  if (employees.length === 0) {
    return {
      reminderId, total: 0, waSent: 0, waFailed: 0, pushDelivered: 0, noSub: 0, pushFailed: 0,
      results: [], message: "Tidak ada karyawan dengan nomor WhatsApp terdaftar di cabang ini",
    };
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

    let waStatus: PerRecipientResult["whatsapp"] = "SENT";
    let errorMessage: string | undefined;

    try {
      await sendText(phoneToWaChatId(emp.phone), renderedMessage);
    } catch (err) {
      waStatus = "FAILED";
      errorMessage = err instanceof Error ? err.message : "Unknown error";
    }

    // Persist log (or update existing log if this is a retry).
    let log;
    if (options.retry?.existingLogId) {
      log = await prisma.reminderLog.update({
        where: { id: options.retry.existingLogId },
        data: {
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
          status: waStatus,
          errorMessage,
        },
      });
    } else {
      log = await prisma.reminderLog.create({
        data: {
          reminderId,
          userId: emp.id,
          status: waStatus,
          channel: reminder.channel,
          renderedMessage,
          errorMessage,
        },
      });
    }

    // Web push — link to the respond page (which will mark `readAt`).
    let pushStatus: PerRecipientResult["push"] = "SKIPPED";
    let pushDelivered = 0, pushAttempted = 0;
    let pushSkipReason: string | undefined;
    try {
      const pushResult = await sendWebPushToUser(
        emp.id,
        reminder.title,
        renderedMessage,
        `/dashboard/reminders/${reminderId}/respond?logId=${log.id}`
      );
      pushDelivered = pushResult.delivered;
      pushAttempted = pushResult.attempted;
      pushSkipReason = pushResult.skipReason;
      if (pushResult.skipReason === "no-subscription") pushStatus = "NO_SUBSCRIPTION";
      else if (pushResult.skipReason === "vapid-not-configured") pushStatus = "FAILED";
      else if (pushResult.delivered > 0) pushStatus = "DELIVERED";
      else if (pushResult.attempted > 0) pushStatus = "FAILED";
    } catch (err) {
      pushStatus = "FAILED";
      pushSkipReason = err instanceof Error ? err.message : "Unknown error";
      console.error("[Reminder] push failed for user", emp.id, err);
    }

    results.push({
      userId: emp.id, name: emp.fullName, phone: emp.phone,
      whatsapp: waStatus, push: pushStatus,
      pushDelivered, pushAttempted, logId: log.id,
      error: errorMessage, pushReason: pushSkipReason,
    });
  }

  await prisma.reminder.update({ where: { id: reminderId }, data: { lastSentAt: new Date() } });

  const waSent = results.filter((r) => r.whatsapp === "SENT").length;
  const waFailed = results.filter((r) => r.whatsapp === "FAILED").length;
  const pushDelivered = results.filter((r) => r.push === "DELIVERED").length;
  const noSub = results.filter((r) => r.push === "NO_SUBSCRIPTION").length;
  const pushFailed = results.filter((r) => r.push === "FAILED").length;

  let hint: string | undefined;
  const vapidIssue = results.some((r) => r.pushReason === "vapid-not-configured");
  if (vapidIssue) hint = "Notifikasi push belum diatur oleh tim teknis";
  else if (pushFailed > 0 && pushDelivered === 0) {
    const firstReason = results.find((r) => r.push === "FAILED")?.pushReason;
    if (firstReason) hint = `Catatan: ${firstReason}`;
  }

  const parts: string[] = [];
  parts.push(`WhatsApp ${waSent}/${results.length} terkirim`);
  if (waFailed > 0) parts.push(`${waFailed} gagal`);
  parts.push(`Notifikasi HP ${pushDelivered}/${results.length} sampai`);
  if (noSub > 0) parts.push(`${noSub} belum aktifkan notifikasi`);
  if (hint) parts.push(hint);

  return {
    reminderId, total: results.length, waSent, waFailed,
    pushDelivered, noSub, pushFailed, hint,
    results, message: parts.join(" • "),
  };
}

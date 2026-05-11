/**
 * Embedded reminder scheduler.
 *
 * Single setInterval loop running in the Next.js server process. Every minute
 * we:
 *   1. Find ACTIVE reminders whose schedule has just become due (WIB clock)
 *      and fire them.
 *   2. Walk recent un-read logs (sent ≥ 2h ago, retryCount < MAX_RETRIES) and
 *      re-send those.
 *
 * Why embedded and not a separate container?
 *   - User's deployment is a single docker-compose stack (no orchestration
 *     for multiple Next.js replicas), so concurrent firings aren't a concern.
 *   - "Just one process" keeps the operator surface minimal.
 *
 * Timezone: scheduled times are interpreted as Asia/Jakarta (WIB) regardless
 * of the server's local TZ. We compute the WIB wall clock by adding +7h to
 * UTC and reading the components.
 */

import prisma from "@/lib/prisma";
import { sendReminderToRecipients } from "@/lib/reminderSender";

const TICK_MS = 60_000; // 1 minute
const RETRY_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_RETRIES = 2; // initial send + 2 retries = 3 max attempts
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

let started = false;
let intervalHandle: NodeJS.Timeout | null = null;

/**
 * Return the WIB wall clock as plain numbers — DO NOT compare with `new Date()`
 * directly because that would be in the server's TZ.
 */
function wibNow(now = new Date()) {
  const wib = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  return {
    hh: wib.getUTCHours(),
    mm: wib.getUTCMinutes(),
    dayOfWeek: wib.getUTCDay(), // 0 = Sunday
    // Start of WIB day expressed as a UTC instant (for "sent today?" check).
    startOfDayUtc: new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate())).getTime() - JAKARTA_OFFSET_MS,
  };
}

/** Extract HH:MM from a Prisma @db.Time() field (stored as 1970-01-01THH:MM:00Z). */
function timeOfDay(d: Date | null): { hh: number; mm: number } | null {
  if (!d) return null;
  return { hh: d.getUTCHours(), mm: d.getUTCMinutes() };
}

async function tick() {
  const now = new Date();
  const wib = wibNow(now);

  try {
    // ────────────────────────────────────────────────────────────────
    // Pass 1 — schedule-driven firings
    // ────────────────────────────────────────────────────────────────
    const reminders = await prisma.reminder.findMany({
      where: {
        status: "ACTIVE",
        scheduleType: { in: ["ONE_TIME", "DAILY", "WEEKLY"] },
      },
      select: {
        id: true, scheduleType: true, scheduledTime: true,
        scheduledDay: true, scheduledAt: true, lastSentAt: true,
      },
    });

    for (const r of reminders) {
      let due = false;

      if (r.scheduleType === "ONE_TIME") {
        // Fire once when the scheduled instant has passed and nothing has
        // been sent yet for this reminder.
        if (r.scheduledAt && r.scheduledAt.getTime() <= now.getTime() && !r.lastSentAt) {
          due = true;
        }
      } else if (r.scheduleType === "DAILY") {
        const t = timeOfDay(r.scheduledTime);
        if (t && t.hh === wib.hh && t.mm === wib.mm) {
          // Avoid double-fire if we already sent this WIB-calendar day.
          if (!r.lastSentAt || r.lastSentAt.getTime() < wib.startOfDayUtc) {
            due = true;
          }
        }
      } else if (r.scheduleType === "WEEKLY") {
        const t = timeOfDay(r.scheduledTime);
        if (t && r.scheduledDay === wib.dayOfWeek && t.hh === wib.hh && t.mm === wib.mm) {
          if (!r.lastSentAt || r.lastSentAt.getTime() < wib.startOfDayUtc) {
            due = true;
          }
        }
      }

      if (due) {
        try {
          const result = await sendReminderToRecipients(r.id);
          console.log(`[Scheduler] Fired reminder ${r.id} (${r.scheduleType}): ${result.message}`);
          if (r.scheduleType === "ONE_TIME") {
            // One-time reminders auto-pause after firing so they don't sit
            // ACTIVE in the list forever.
            await prisma.reminder.update({
              where: { id: r.id }, data: { status: "PAUSED" },
            });
          }
        } catch (err) {
          console.error(`[Scheduler] Failed to fire reminder ${r.id}:`, err);
        }
      }
    }

    // ────────────────────────────────────────────────────────────────
    // Pass 2 — retry un-opened logs
    // ────────────────────────────────────────────────────────────────
    const cutoff = new Date(now.getTime() - RETRY_AFTER_MS);
    const staleLogs = await prisma.reminderLog.findMany({
      where: {
        readAt: null,
        retryCount: { lt: MAX_RETRIES },
        // Choose log time as the relevant timestamp: if we've retried, the
        // 2-hour wait counts from the last retry; else from initial sentAt.
        // Prisma can't OR on computed fields so we filter manually below.
        sentAt: { lte: cutoff },
        reminder: { status: "ACTIVE" },
      },
      select: {
        id: true, userId: true, reminderId: true, sentAt: true,
        retryCount: true, lastRetryAt: true,
      },
      take: 50, // protect against runaway batches
    });

    for (const log of staleLogs) {
      const lastTry = log.lastRetryAt ?? log.sentAt;
      if (now.getTime() - lastTry.getTime() < RETRY_AFTER_MS) continue;

      try {
        await sendReminderToRecipients(log.reminderId, {
          userIdsOverride: [log.userId],
          retry: { existingLogId: log.id },
        });
        console.log(`[Scheduler] Re-sent reminder ${log.reminderId} to user ${log.userId} (retry #${log.retryCount + 1})`);
      } catch (err) {
        console.error(`[Scheduler] Retry failed for log ${log.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[Scheduler] tick error:", err);
  }
}

/**
 * Boot the scheduler. Safe to call multiple times — only the first call
 * actually starts the interval.
 */
export function startReminderScheduler() {
  if (started) return;
  started = true;

  console.log(`[Scheduler] Reminder scheduler started — tick every ${TICK_MS / 1000}s, retry after ${RETRY_AFTER_MS / 1000 / 60}min, max ${MAX_RETRIES} retries`);

  // Kick off first tick after 10s so DB is fully ready post-boot.
  setTimeout(() => {
    tick().catch(() => {});
    intervalHandle = setInterval(() => { tick().catch(() => {}); }, TICK_MS);
  }, 10_000);
}

export function stopReminderScheduler() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  started = false;
}

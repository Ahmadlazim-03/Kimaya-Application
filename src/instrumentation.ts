/**
 * Next.js instrumentation hook — runs once per server process start.
 *
 * Used to bootstrap the reminder scheduler. By living in instrumentation.ts
 * (the canonical Next.js startup hook), the scheduler:
 *   - Only runs on the server (never the edge runtime, never the browser)
 *   - Starts after Next.js boots so the DB pool is ready
 *   - Survives hot-reloads in dev (only the nodejs runtime branch executes)
 *
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Don't run the scheduler during `next build` (where modules are imported
  // for static analysis). The build sets NEXT_PHASE accordingly.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Optional kill-switch for local dev or troubleshooting.
  if (process.env.REMINDER_SCHEDULER_DISABLED === "1") {
    console.log("[Instrumentation] REMINDER_SCHEDULER_DISABLED=1 — skipping scheduler boot");
    return;
  }

  const { startReminderScheduler } = await import("@/lib/reminderScheduler");
  startReminderScheduler();
}

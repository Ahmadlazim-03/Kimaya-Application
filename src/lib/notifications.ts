/**
 * WhatsApp Notification Service
 * Sends automated notifications for system events
 */
import prisma from "@/lib/prisma";
import { sendText, phoneToWaChatId } from "@/lib/waha";
import webpush from "web-push";

// Configure Web Push
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:admin@kimaya.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushDeliveryResult {
  /** Number of subscription rows we attempted to deliver to. */
  attempted: number;
  /** Number that succeeded (push service accepted, 2xx). */
  delivered: number;
  /** Number that failed (any non-2xx, including expired). */
  failed: number;
  /** Number of expired subscriptions cleaned up (410/404). */
  pruned: number;
  /** Reason this user got 0 deliveries — useful for debugging. */
  skipReason?: "no-subscription" | "vapid-not-configured" | "user-not-found";
}

/**
 * Send Web Push Notification to a User. Returns delivery diagnostics so the
 * caller can surface why a recipient didn't receive anything (the most common
 * cause is no active push subscription on their device).
 */
export async function sendWebPushToUser(
  userId: string,
  title: string,
  body: string,
  url: string = "/dashboard",
  vibrate?: number[]
): Promise<PushDeliveryResult> {
  const result: PushDeliveryResult = { attempted: 0, delivered: 0, failed: 0, pruned: 0 };

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error("[Push] VAPID keys not configured — push delivery disabled");
    result.skipReason = "vapid-not-configured";
    return result;
  }

  try {
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });

    if (!subscriptions.length) {
      console.warn(`[Push] User ${userId} has no active push subscription — skipping push delivery`);
      result.skipReason = "no-subscription";
      return result;
    }

    result.attempted = subscriptions.length;

    const payload = JSON.stringify({
      title,
      body,
      data: { url },
      vibrate: vibrate || [500, 250, 500, 250, 1000],
    });

    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        result.delivered++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Expired / unsubscribed at provider — clean up so we don't keep retrying.
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          result.pruned++;
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[Push] Send failed for sub ${sub.id} (status=${statusCode}):`, msg);
        }
        result.failed++;
      }
    }));

    return result;
  } catch (error) {
    console.error("[Push] sendWebPushToUser unexpected error:", error);
    return result;
  }
}

/**
 * Notify Manager/CS when a new report is submitted by a Therapist
 */
export async function notifyReportSubmitted(reportId: string, therapistName: string, reportTitle: string) {
  try {
    // Get all Manager and CS users with phone numbers
    const supervisors = await prisma.user.findMany({
      where: {
        role: { in: ["MANAGER", "CS"] as any },
        status: "ACTIVE",
        phone: { not: null },
      },
    });

    const today = new Date().toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric",
    });

    const message = [
      "📄 *Laporan Baru Masuk*",
      "",
      `Dari: *${therapistName}*`,
      `Judul: ${reportTitle}`,
      `Tanggal: ${today}`,
      "",
      "Silakan review di dashboard Kimaya Management.",
    ].join("\n");

    for (const sup of supervisors) {
      if (!sup.phone) continue;
      try {
        await sendText(phoneToWaChatId(sup.phone), message);
      } catch (err) {
        console.error(`[Notif] Failed to notify ${sup.fullName}:`, err);
      }
    }
  } catch (err) {
    console.error("[Notif] notifyReportSubmitted error:", err);
  }
}

/**
 * Notify Therapist when their report is reviewed (approved/revision)
 */
export async function notifyReportReviewed(userId: string, reportTitle: string, status: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone) return;

    const statusText = status === "APPROVED" ? "✅ Disetujui" : "🔄 Perlu Revisi";
    const message = [
      "📋 *Update Laporan*",
      "",
      `Judul: ${reportTitle}`,
      `Status: *${statusText}*`,
      "",
      status === "APPROVED"
        ? "Laporan kamu sudah disetujui. Terima kasih! 🙏"
        : "Laporan kamu perlu diperbaiki. Silakan cek detail di aplikasi.",
    ].join("\n");

    await sendText(phoneToWaChatId(user.phone), message);
  } catch (err) {
    console.error("[Notif] notifyReportReviewed error:", err);
  }
}

/**
 * Notify Therapist after successful attendance check-in/out
 */
export async function notifyAttendance(userId: string, type: "CHECK_IN" | "CHECK_OUT", time: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone) return;

    const emoji = type === "CHECK_IN" ? "🟢" : "🔴";
    const label = type === "CHECK_IN" ? "Check-in" : "Check-out";
    const message = [
      `${emoji} *${label} Berhasil*`,
      "",
      `Nama: ${user.fullName}`,
      `Waktu: ${time}`,
      `Tanggal: ${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}`,
    ].join("\n");

    await sendText(phoneToWaChatId(user.phone), message);
  } catch (err) {
    console.error("[Notif] notifyAttendance error:", err);
  }
}

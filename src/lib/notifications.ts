/**
 * WhatsApp Notification Service
 * Sends automated notifications for system events
 */
import prisma from "@/lib/prisma";
import { sendText, phoneToWaChatId } from "@/lib/waha";

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

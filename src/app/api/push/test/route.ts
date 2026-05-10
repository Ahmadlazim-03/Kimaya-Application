import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendWebPushToUser } from "@/lib/notifications";

/**
 * POST /api/push/test
 *
 * Send a Web Push notification to the CURRENT user via the same pipeline
 * used by the reminder fan-out. Returns the full delivery result so the
 * caller can distinguish:
 *   - VAPID not configured
 *   - No push subscription saved (user never enabled notifications)
 *   - Provider rejected (404/410 → expired; other → real failure)
 *   - Delivered successfully
 *
 * Usage from UI: an admin clicks "Test Push to me" and gets a modal showing
 * the result. This validates the end-to-end pipeline independent of the
 * reminder/recipient logic.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const targetUserId =
      typeof body.userId === "string" && body.userId.length > 0
        ? body.userId
        : session.id;

    // Only admins may push to other users; therapists only to themselves.
    if (targetUserId !== session.id && !["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const result = await sendWebPushToUser(
      targetUserId,
      "🔔 Test Push Notification",
      `Halo ${session.fullName}! Jika notifikasi ini muncul di HP, Web Push pipeline berfungsi normal. Dikirim ${new Date().toLocaleString("id-ID")}.`,
      "/dashboard"
    );

    let summary = "";
    if (result.skipReason === "vapid-not-configured") {
      summary = "❌ VAPID env tidak terbaca server. Cek NEXT_PUBLIC_VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY di .env, lalu restart container.";
    } else if (result.skipReason === "no-subscription") {
      summary = "❌ User belum subscribe. Buka /dashboard di HP, klik 'Aktifkan Notifikasi', lalu coba lagi.";
    } else if (result.delivered > 0) {
      summary = `✅ ${result.delivered}/${result.attempted} push terkirim ke device. Cek HP Anda.`;
    } else if (result.attempted > 0 && result.failed > 0) {
      summary = `❌ Push provider menolak ${result.failed}/${result.attempted}. Cek server log untuk detail.`;
    } else {
      summary = "⚠️ Tidak ada subscription aktif untuk user ini.";
    }

    return NextResponse.json({
      success: result.delivered > 0,
      summary,
      result,
    });
  } catch (error) {
    console.error("[Push] /test error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test push gagal" },
      { status: 500 }
    );
  }
}

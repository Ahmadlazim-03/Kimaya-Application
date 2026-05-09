import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * WAHA Webhook Handler
 * Receives incoming WhatsApp events from WAHA NoWeb container
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = body.event;

    console.log(`[WAHA Webhook] Event: ${event}`);

    switch (event) {
      case "message":
        await handleIncomingMessage(body);
        break;
      case "message.ack":
        await handleMessageAck(body);
        break;
      case "session.status":
        await handleSessionStatus(body);
        break;
      default:
        console.log(`[WAHA Webhook] Unhandled event: ${event}`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[WAHA Webhook] Error:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

// ---- Incoming Message Handler ----
async function handleIncomingMessage(payload: Record<string, unknown>) {
  const message = payload.payload as Record<string, unknown>;
  const from = message?.from as string;
  const msgBody = (message?.body as string)?.trim().toUpperCase();

  if (!from || !msgBody) return;

  // Extract phone number from chatId (e.g. "6281234567890@c.us" → "6281234567890")
  const phone = from.replace("@c.us", "").replace("@s.whatsapp.net", "");

  // Find user by phone number
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: phone },
        { phone: `+${phone}` },
        { phone: `0${phone.substring(2)}` }, // 628xxx → 08xxx
      ],
    },
  });

  if (!user) {
    console.log(`[WA] Unknown sender: ${from}`);
    return;
  }

  console.log(`[WA] Message from ${user.fullName} (${from}): ${msgBody}`);

  // Help command
  if (msgBody === "HELP" || msgBody === "BANTUAN") {
    const { sendText, phoneToWaChatId } = await import("@/lib/waha");
    await sendText(phoneToWaChatId(phone), [
      "🌿 *Kimaya Management Bot* 🌿",
      "",
      "Perintah yang tersedia:",
      "📊 *SKOR* — Cek skor performa terbaru",
      "❓ *BANTUAN* — Tampilkan menu ini",
      "",
      "Untuk absensi dan laporan, silakan gunakan aplikasi web.",
    ].join("\n"));
    return;
  }

  // Score check
  if (msgBody === "SKOR" || msgBody === "SCORE") {
    const { sendText, phoneToWaChatId } = await import("@/lib/waha");
    const latestScore = await prisma.employeeScore.findFirst({
      where: { userId: user.id },
      orderBy: { periodDate: "desc" },
    });

    const text = latestScore
      ? [
          `📊 *Skor Performa — ${user.fullName}*`,
          "",
          `Total: *${latestScore.totalScore}*`,
          `Kehadiran: ${latestScore.attendanceScore}`,
          `Kelengkapan: ${latestScore.reportCompletenessScore}`,
          `Kualitas: ${latestScore.reportQualityScore}`,
          `Respons: ${latestScore.responseSpeedScore}`,
          `Inisiatif: ${latestScore.initiativeScore}`,
          "",
          `Periode: ${latestScore.periodDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`,
        ].join("\n")
      : `Hai ${user.fullName}, belum ada data skor performa untuk kamu.`;

    await sendText(phoneToWaChatId(phone), text);
    return;
  }

  console.log(`[WA] Unrecognized command from ${user.fullName}: ${msgBody}`);
}

// ---- ACK Handler — Track delivery/read status ----
async function handleMessageAck(payload: Record<string, unknown>) {
  const ack = payload.payload as Record<string, unknown>;
  const messageId = ack?.id as string;
  const ackStatus = ack?.ack as number;

  if (!messageId) return;

  // Map WAHA ack codes: 1=sent, 2=delivered, 3=read
  let status: string | null = null;
  if (ackStatus === 2) status = "DELIVERED";
  if (ackStatus === 3) status = "READ";

  if (status) {
    // Update any reminder logs that match this message ID
    await prisma.reminderLog.updateMany({
      where: { wahaMessageId: messageId },
      data: { status },
    });
    console.log(`[WA] ACK: ${messageId} → ${status}`);
  }
}

// ---- Session Status Handler ----
async function handleSessionStatus(payload: Record<string, unknown>) {
  const session = payload.payload as Record<string, unknown>;
  const status = session?.status as string;
  console.log(`[WA] Session status changed: ${status}`);

  // Log to system config for monitoring
  try {
    await prisma.systemConfig.upsert({
      where: { key: "waha_session_status" },
      update: { value: status },
      create: { key: "waha_session_status", value: status },
    });
    await prisma.systemConfig.upsert({
      where: { key: "waha_last_status_change" },
      update: { value: new Date().toISOString() },
      create: { key: "waha_last_status_change", value: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[WA] Failed to log session status:", err);
  }
}

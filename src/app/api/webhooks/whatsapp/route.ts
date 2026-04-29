import { NextRequest, NextResponse } from "next/server";

/**
 * WAHA Webhook Handler
 * Receives incoming WhatsApp events from WAHA NoWeb container
 * 
 * Events handled:
 * - message          → Incoming messages (check-in commands, report uploads)
 * - message.ack      → Message delivery/read receipts
 * - session.status   → Session connection status changes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = body.event;

    console.log(`[WAHA Webhook] Event: ${event}`, JSON.stringify(body, null, 2));

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
    return NextResponse.json(
      { status: "error", message: "Internal webhook error" },
      { status: 500 }
    );
  }
}

// ---- Message Handler ----
async function handleIncomingMessage(payload: Record<string, unknown>) {
  const message = payload.payload as Record<string, unknown>;
  const from = message?.from as string;
  const body = (message?.body as string)?.trim().toUpperCase();

  if (!from || !body) return;

  console.log(`[WA] Message from ${from}: ${body}`);

  // Check-in flow
  if (body === "MASUK" || body === "HADIR" || body === "CHECK IN") {
    // TODO: Lookup user by phone number
    // TODO: Record attendance
    // TODO: Send confirmation via WAHA API
    console.log(`[WA] Check-in request from ${from}`);
    return;
  }

  // Check-out flow
  if (body === "PULANG" || body === "CHECK OUT") {
    console.log(`[WA] Check-out request from ${from}`);
    return;
  }

  // Help command
  if (body === "HELP" || body === "BANTUAN") {
    console.log(`[WA] Help request from ${from}`);
    return;
  }

  // Score check
  if (body === "SKOR" || body === "SCORE") {
    console.log(`[WA] Score check from ${from}`);
    return;
  }

  console.log(`[WA] Unknown command from ${from}: ${body}`);
}

// ---- ACK Handler ----
async function handleMessageAck(payload: Record<string, unknown>) {
  const ack = payload.payload as Record<string, unknown>;
  console.log(`[WA] Message ACK: ${ack?.id} → ${ack?.ack}`);
  // TODO: Update reminder_logs status (SENT → DELIVERED → READ)
}

// ---- Session Status Handler ----
async function handleSessionStatus(payload: Record<string, unknown>) {
  const session = payload.payload as Record<string, unknown>;
  const status = session?.status as string;
  console.log(`[WA] Session status: ${status}`);
  // TODO: Alert admin if session disconnected
}

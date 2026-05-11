import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendReminderToRecipients } from "@/lib/reminderSender";

/**
 * Manual fan-out: same code path as the scheduler — just triggered by a click.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Anda belum masuk" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Halaman ini hanya untuk admin" }, { status: 403 });
    }

    const { id } = await params;
    const summary = await sendReminderToRecipients(id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[Reminder Send]", error);
    const msg = error instanceof Error ? error.message : "Gagal mengirim pengingat";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

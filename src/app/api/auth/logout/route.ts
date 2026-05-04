import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ message: "Berhasil logout" });
  } catch {
    return NextResponse.json({ error: "Gagal logout" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.title) updateData.title = body.title;
    if (body.messageTemplate) updateData.messageTemplate = body.messageTemplate;
    if (body.channel) updateData.channel = body.channel;
    if (body.scheduleType) updateData.scheduleType = body.scheduleType;
    if (body.status) updateData.status = body.status;
    if (body.scheduledTime) updateData.scheduledTime = new Date(`1970-01-01T${body.scheduledTime}:00Z`);

    await prisma.reminder.update({ where: { id }, data: updateData });
    return NextResponse.json({ message: "Reminder berhasil diupdate" });
  } catch (error) {
    console.error("Update reminder error:", error);
    return NextResponse.json({ error: "Gagal mengupdate reminder" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.reminder.update({ where: { id }, data: { status: "DELETED" } });
    return NextResponse.json({ message: "Reminder berhasil dihapus" });
  } catch (error) {
    console.error("Delete reminder error:", error);
    return NextResponse.json({ error: "Gagal menghapus reminder" }, { status: 500 });
  }
}

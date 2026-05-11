import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function normalizeScheduleFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (!body.scheduleType) return out;
  out.scheduleType = body.scheduleType;
  out.scheduledTime = null;
  out.scheduledDay = null;
  out.scheduledAt = null;
  const t = body.scheduleType as string;
  if (t === "DAILY" && body.scheduledTime) {
    out.scheduledTime = new Date(`1970-01-01T${body.scheduledTime}:00Z`);
  }
  if (t === "WEEKLY") {
    if (body.scheduledTime) out.scheduledTime = new Date(`1970-01-01T${body.scheduledTime}:00Z`);
    if (typeof body.scheduledDay === "number") out.scheduledDay = body.scheduledDay;
  }
  if (t === "ONE_TIME" && body.scheduledAt) {
    out.scheduledAt = new Date(body.scheduledAt as string);
  }
  return out;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Anda belum masuk" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Halaman ini hanya untuk admin" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.messageTemplate !== undefined) updateData.messageTemplate = body.messageTemplate;
    if (body.channel !== undefined) updateData.channel = body.channel;
    if (body.status !== undefined) updateData.status = body.status;
    Object.assign(updateData, normalizeScheduleFields(body));

    const targetMode = body.targetMode as string | undefined;
    if (targetMode === "ALL_THERAPISTS" || targetMode === "SELECTED") {
      updateData.targetMode = targetMode;
    }

    // CS edit guard: can only modify their own location's reminders + their
    // recipient list must stay within their location.
    if (session.role === "CS" && session.locationId) {
      const existing = await prisma.reminder.findUnique({
        where: { id }, select: { locationScopeId: true, createdById: true },
      });
      if (!existing) return NextResponse.json({ error: "Pengingat tidak ditemukan" }, { status: 404 });
      if (existing.locationScopeId !== session.locationId && existing.createdById !== session.id) {
        return NextResponse.json({
          error: "Anda hanya bisa mengubah pengingat dari cabang Anda sendiri",
        }, { status: 403 });
      }
    }

    const recipientIds: string[] | undefined = Array.isArray(body.recipientIds) ? body.recipientIds : undefined;
    const images: Array<{ photoUrl: string; caption?: string }> | undefined = Array.isArray(body.images) ? body.images : undefined;

    if (recipientIds && targetMode === "SELECTED" && session.role === "CS" && session.locationId) {
      const allowed = await prisma.user.findMany({
        where: { id: { in: recipientIds }, locationId: session.locationId },
        select: { id: true },
      });
      if (allowed.length !== recipientIds.length) {
        return NextResponse.json({
          error: "Therapist yang dipilih harus dari cabang Anda sendiri",
        }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.reminder.update({ where: { id }, data: updateData });

      if (recipientIds !== undefined) {
        await tx.reminderRecipient.deleteMany({ where: { reminderId: id } });
        if (targetMode === "SELECTED" && recipientIds.length > 0) {
          await tx.reminderRecipient.createMany({
            data: recipientIds.map((userId) => ({ reminderId: id, userId })),
            skipDuplicates: true,
          });
        }
      }

      if (images !== undefined) {
        await tx.reminderImage.deleteMany({ where: { reminderId: id } });
        if (images.length > 0) {
          await tx.reminderImage.createMany({
            data: images.slice(0, 5).map((img, i) => ({
              reminderId: id,
              photoUrl: img.photoUrl,
              caption: img.caption || null,
              order: i,
            })),
          });
        }
      }
    });

    return NextResponse.json({ message: "Pengingat berhasil diperbarui" });
  } catch (error) {
    console.error("[Reminder PUT]", error);
    return NextResponse.json({ error: "Gagal memperbarui pengingat" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Anda belum masuk" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Halaman ini hanya untuk admin" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.reminder.update({ where: { id }, data: { status: "DELETED" } });
    return NextResponse.json({ message: "Pengingat berhasil dihapus" });
  } catch (error) {
    console.error("[Reminder DELETE]", error);
    return NextResponse.json({ error: "Gagal menghapus pengingat" }, { status: 500 });
  }
}

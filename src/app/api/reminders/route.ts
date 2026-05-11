import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const scheduleMap: Record<string, string> = {
  DAILY: "Setiap hari",
  WEEKLY: "Setiap minggu",
  ONE_TIME: "Sekali jalan",
  IMMEDIATE: "Manual",
  CUSTOM_CRON: "Kustom",
};

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function formatScheduleLine(r: {
  scheduleType: string;
  scheduledTime: Date | null;
  scheduledDay: number | null;
  scheduledAt: Date | null;
}) {
  const time = r.scheduledTime ? r.scheduledTime.toISOString().slice(11, 16) : null;
  switch (r.scheduleType) {
    case "DAILY":
      return time ? `Setiap hari, ${time} WIB` : "Setiap hari";
    case "WEEKLY":
      return time && r.scheduledDay != null
        ? `Setiap ${DAY_NAMES[r.scheduledDay]}, ${time} WIB`
        : "Setiap minggu";
    case "ONE_TIME":
      return r.scheduledAt
        ? `Sekali jalan, ${r.scheduledAt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} ${r.scheduledAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`
        : "Sekali jalan";
    case "IMMEDIATE":
      return "Kirim manual";
    default:
      return scheduleMap[r.scheduleType] || r.scheduleType;
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Anda belum masuk" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Halaman ini hanya untuk admin" }, { status: 403 });
    }

    // CS only sees reminders scoped to their own location. Manager + Developer
    // see everything (lokasi-aware filtering is for CS only — they have a
    // hard branch boundary).
    const where: Record<string, unknown> = { status: { not: "DELETED" } };
    if (session.role === "CS" && session.locationId) {
      where.OR = [
        { locationScopeId: session.locationId },
        { createdById: session.id },
      ];
    }

    const reminders = await prisma.reminder.findMany({
      where,
      include: {
        createdBy: { select: { fullName: true } },
        images: { select: { id: true, photoUrl: true, caption: true, order: true }, orderBy: { order: "asc" } },
        recipients: {
          select: {
            userId: true,
            user: { select: { id: true, fullName: true, location: { select: { name: true } } } },
          },
        },
        locationScope: { select: { id: true, name: true } },
        _count: { select: { logs: true, responses: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = reminders.map((r) => ({
      id: r.id,
      title: r.title,
      messageTemplate: r.messageTemplate,
      images: r.images,
      targetMode: r.targetMode,
      recipientIds: r.recipients.map((rp) => rp.userId),
      recipients: r.recipients.map((rp) => ({
        id: rp.user.id,
        name: rp.user.fullName,
        location: rp.user.location?.name || null,
      })),
      locationScope: r.locationScope ? { id: r.locationScope.id, name: r.locationScope.name } : null,
      target: r.targetMode === "SELECTED"
        ? `${r.recipients.length} therapist dipilih`
        : (r.locationScope ? `Semua therapist · ${r.locationScope.name}` : "Semua therapist"),
      scheduleType: r.scheduleType,
      scheduledTime: r.scheduledTime ? r.scheduledTime.toISOString().slice(11, 16) : null,
      scheduledDay: r.scheduledDay,
      scheduledAt: r.scheduledAt?.toISOString() || null,
      schedule: formatScheduleLine(r),
      status: r.status.toLowerCase(),
      lastSent: r.lastSentAt
        ? r.lastSentAt.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) +
          " " + r.lastSentAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        : "-",
      lastSentRaw: r.lastSentAt?.toISOString() || null,
      totalSent: r._count.logs,
      totalResponded: r._count.responses,
      responseRate: r._count.logs > 0 ? Math.round((r._count.responses / r._count.logs) * 100) : 0,
      createdByName: r.createdBy?.fullName || null,
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Reminders GET]", error);
    return NextResponse.json({ error: "Terjadi kesalahan saat memuat data" }, { status: 500 });
  }
}

/**
 * Build the Prisma data payload for create/update from a request body.
 *
 * Body shape:
 *   {
 *     title, messageTemplate,
 *     scheduleType: "IMMEDIATE" | "ONE_TIME" | "DAILY" | "WEEKLY",
 *     scheduledTime?: "HH:MM"   // DAILY / WEEKLY
 *     scheduledDay?:  0..6      // WEEKLY
 *     scheduledAt?:   ISO       // ONE_TIME
 *     targetMode: "ALL_THERAPISTS" | "SELECTED",
 *     recipientIds?: string[]   // when SELECTED
 *     images?: [{ photoUrl: base64, caption?: string }]
 *   }
 */
function normalizeScheduleFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const type = body.scheduleType as string | undefined;
  if (!type) return out;

  out.scheduleType = type;

  // Reset all schedule fields first so editing from "DAILY 08:00" to
  // "ONE_TIME 2026-05-12" doesn't leave a stale scheduledTime around.
  out.scheduledTime = null;
  out.scheduledDay = null;
  out.scheduledAt = null;

  if (type === "DAILY") {
    if (body.scheduledTime) {
      out.scheduledTime = new Date(`1970-01-01T${body.scheduledTime}:00Z`);
    }
  } else if (type === "WEEKLY") {
    if (body.scheduledTime) {
      out.scheduledTime = new Date(`1970-01-01T${body.scheduledTime}:00Z`);
    }
    if (typeof body.scheduledDay === "number") {
      out.scheduledDay = body.scheduledDay;
    }
  } else if (type === "ONE_TIME") {
    if (body.scheduledAt) out.scheduledAt = new Date(body.scheduledAt as string);
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Anda belum masuk" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Halaman ini hanya untuk admin" }, { status: 403 });
    }

    const body = await request.json();
    if (!body.title?.trim() || !body.messageTemplate?.trim()) {
      return NextResponse.json({ error: "Judul dan isi pesan wajib diisi" }, { status: 400 });
    }

    const targetMode = (body.targetMode as string) === "SELECTED" ? "SELECTED" : "ALL_THERAPISTS";
    const recipientIds: string[] = Array.isArray(body.recipientIds) ? body.recipientIds : [];

    // Branch isolation: CS can only target therapists in their own location.
    // For ALL_THERAPISTS we scope reminders to CS's locationId; for SELECTED
    // we validate every chosen user is in CS's location before saving.
    let locationScopeId: string | null = null;
    if (session.role === "CS" && session.locationId) {
      locationScopeId = session.locationId;
      if (targetMode === "SELECTED" && recipientIds.length > 0) {
        const allowed = await prisma.user.findMany({
          where: { id: { in: recipientIds }, locationId: session.locationId },
          select: { id: true },
        });
        if (allowed.length !== recipientIds.length) {
          return NextResponse.json({
            error: "Salah satu therapist yang dipilih bukan dari cabang Anda. Anda hanya bisa mengirim pengingat ke therapist di cabang sendiri."
          }, { status: 400 });
        }
      }
    } else if (body.locationScopeId) {
      // MANAGER / DEVELOPER may explicitly scope a reminder to a location.
      locationScopeId = body.locationScopeId as string;
    }

    const schedule = normalizeScheduleFields(body);
    const images: Array<{ photoUrl: string; caption?: string }> = Array.isArray(body.images) ? body.images : [];

    const reminder = await prisma.reminder.create({
      data: {
        title: body.title.trim(),
        messageTemplate: body.messageTemplate,
        channel: body.channel || "WHATSAPP",
        targetMode,
        locationScopeId,
        status: "ACTIVE",
        createdById: session.id,
        ...schedule,
        recipients: targetMode === "SELECTED" && recipientIds.length > 0
          ? { create: recipientIds.map((userId) => ({ userId })) }
          : undefined,
        images: images.length > 0
          ? {
              create: images.slice(0, 5).map((img, i) => ({
                photoUrl: img.photoUrl,
                caption: img.caption || null,
                order: i,
              })),
            }
          : undefined,
      },
    });
    return NextResponse.json({ id: reminder.id }, { status: 201 });
  } catch (error) {
    console.error("[Reminders POST]", error);
    return NextResponse.json({ error: "Gagal membuat pengingat" }, { status: 500 });
  }
}

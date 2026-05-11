import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * Therapist endpoint to read/create/update their response to a single
 * reminder kiriman (= ReminderLog).
 *
 * GET    /api/reminders/[id]/respond?logId=<logId>
 *   → returns the existing response (with images) or null. Also returns the
 *     log + reminder + user info needed to render the form header.
 *
 * POST   /api/reminders/[id]/respond?logId=<logId>
 *   → upsert response. Body: { caption?: string, images: [{ photoUrl, description? }] }
 *     Replaces all existing images. Idempotent — calling again edits.
 */

const MAX_IMAGES = 8;
const MAX_IMAGE_SIZE_BYTES = 3_500_000; // ~3.5MB per image (base64 expansion factor ~1.37)

interface ImageInput {
  photoUrl?: unknown;
  description?: unknown;
}

function validateImages(input: unknown): { ok: true; items: { photoUrl: string; description: string | null }[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "Field 'images' harus berupa array" };
  if (input.length === 0) return { ok: false, error: "Minimal 1 foto diperlukan" };
  if (input.length > MAX_IMAGES) return { ok: false, error: `Maksimal ${MAX_IMAGES} foto per response` };

  const items: { photoUrl: string; description: string | null }[] = [];
  for (let i = 0; i < input.length; i++) {
    const raw = input[i] as ImageInput;
    const photoUrl = typeof raw.photoUrl === "string" ? raw.photoUrl : "";
    if (!photoUrl.startsWith("data:image/")) {
      return { ok: false, error: `Foto ${i + 1}: format tidak valid (harus data URL gambar)` };
    }
    if (photoUrl.length > MAX_IMAGE_SIZE_BYTES) {
      return { ok: false, error: `Foto ${i + 1}: ukuran melebihi 3.5MB, kompres dulu` };
    }
    const description = typeof raw.description === "string" && raw.description.trim().length > 0
      ? raw.description.trim().slice(0, 500)
      : null;
    items.push({ photoUrl, description });
  }
  return { ok: true, items };
}

async function authorize(reminderId: string, logId: string | null) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 }) };
  if (!logId) return { error: NextResponse.json({ error: "logId diperlukan" }, { status: 400 }) };

  const log = await prisma.reminderLog.findUnique({
    where: { id: logId },
    include: {
      reminder: {
        select: {
          id: true, title: true, messageTemplate: true,
          images: { orderBy: { order: "asc" }, select: { id: true, photoUrl: true, caption: true, order: true } },
        },
      },
    },
  });
  if (!log) return { error: NextResponse.json({ error: "Pengiriman reminder tidak ditemukan" }, { status: 404 }) };
  if (log.reminderId !== reminderId) {
    return { error: NextResponse.json({ error: "logId tidak cocok dengan reminder" }, { status: 400 }) };
  }
  // Only the user the reminder was sent to can respond.
  if (log.userId !== session.id) {
    return { error: NextResponse.json({ error: "Anda tidak diizinkan membalas reminder orang lain" }, { status: 403 }) };
  }
  return { session, log };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const logId = searchParams.get("logId");

    const auth = await authorize(id, logId);
    if ("error" in auth) return auth.error;
    const { log } = auth;

    // Mark this log as "read" the first time the therapist opens the page.
    // The scheduler uses this to skip retry-sending opened reminders.
    if (!log.readAt) {
      await prisma.reminderLog.update({
        where: { id: log.id },
        data: { readAt: new Date() },
      }).catch(() => { /* non-fatal */ });
    }

    const response = await prisma.reminderResponse.findUnique({
      where: { reminderLogId: log.id },
      include: {
        images: { orderBy: { order: "asc" } },
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({
      log: {
        id: log.id,
        sentAt: log.sentAt,
        renderedMessage: log.renderedMessage,
        reminder: log.reminder,
      },
      response: response
        ? {
            id: response.id,
            caption: response.caption,
            respondedAt: response.respondedAt,
            updatedAt: response.updatedAt,
            user: response.user,
            images: response.images.map((img) => ({
              id: img.id,
              photoUrl: img.photoUrl,
              description: img.description,
              order: img.order,
            })),
          }
        : null,
    });
  } catch (error) {
    console.error("Get respond error:", error);
    return NextResponse.json({ error: "Gagal memuat data respond" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const logId = searchParams.get("logId");

    const auth = await authorize(id, logId);
    if ("error" in auth) return auth.error;
    const { session, log } = auth;

    const body = await request.json();
    const captionRaw = typeof body.caption === "string" ? body.caption.trim() : "";
    const caption = captionRaw.length > 0 ? captionRaw.slice(0, 1000) : null;

    const imgValidation = validateImages(body.images);
    if (!imgValidation.ok) {
      return NextResponse.json({ error: imgValidation.error }, { status: 400 });
    }

    // Upsert response, then replace images in a single transaction.
    const response = await prisma.$transaction(async (tx) => {
      const existing = await tx.reminderResponse.findUnique({
        where: { reminderLogId: log.id },
      });

      if (existing) {
        await tx.reminderResponseImage.deleteMany({ where: { responseId: existing.id } });
        const updated = await tx.reminderResponse.update({
          where: { id: existing.id },
          data: { caption },
        });
        await tx.reminderResponseImage.createMany({
          data: imgValidation.items.map((img, idx) => ({
            responseId: updated.id,
            photoUrl: img.photoUrl,
            description: img.description,
            order: idx,
          })),
        });
        return { id: updated.id, edited: true };
      }

      const created = await tx.reminderResponse.create({
        data: {
          reminderLogId: log.id,
          reminderId: log.reminderId,
          userId: session.id,
          caption,
        },
      });
      await tx.reminderResponseImage.createMany({
        data: imgValidation.items.map((img, idx) => ({
          responseId: created.id,
          photoUrl: img.photoUrl,
          description: img.description,
          order: idx,
        })),
      });
      return { id: created.id, edited: false };
    });

    return NextResponse.json({
      success: true,
      id: response.id,
      message: response.edited ? "Tanggapan berhasil diperbarui" : "Tanggapan berhasil dikirim",
    });
  } catch (error) {
    console.error("Post respond error:", error);
    return NextResponse.json({ error: "Gagal menyimpan tanggapan" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/push/diagnose
 *
 * Quickly inspect Web Push readiness from the SERVER perspective:
 *   - Are VAPID env vars present?
 *   - How many push subscriptions exist for the current user?
 *   - How many subscriptions exist across all THERAPIST accounts?
 *
 * Helps debug "Push: 0/N sampai" symptoms by isolating root cause.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidConfigured = !!(vapidPublic && vapidPrivate);

  const [mySubs, therapistAggregate] = await Promise.all([
    prisma.pushSubscription.count({ where: { userId: session.id } }),
    prisma.user.findMany({
      where: { role: "THERAPIST", status: { in: ["ACTIVE", "PROBATION"] } },
      select: {
        id: true,
        fullName: true,
        _count: { select: { pushSubscriptions: true } },
      },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const therapists = therapistAggregate.map((t) => ({
    id: t.id,
    name: t.fullName,
    subscriptions: t._count.pushSubscriptions,
    subscribed: t._count.pushSubscriptions > 0,
  }));
  const therapistsSubscribed = therapists.filter((t) => t.subscribed).length;

  return NextResponse.json({
    vapid: {
      configured: vapidConfigured,
      publicKeyPreview: vapidPublic ? `${vapidPublic.slice(0, 12)}…(${vapidPublic.length} chars)` : null,
      privateKeyPresent: !!vapidPrivate,
    },
    me: {
      userId: session.id,
      role: session.role,
      subscriptions: mySubs,
      subscribed: mySubs > 0,
    },
    therapists: {
      total: therapists.length,
      subscribed: therapistsSubscribed,
      list: therapists,
    },
  });
}

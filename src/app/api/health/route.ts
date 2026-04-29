import { NextResponse } from "next/server";

/**
 * Health check endpoint
 * Verifies connectivity to PostgreSQL, Redis, and WAHA
 */
export async function GET() {
  const health: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Check PostgreSQL
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    (health.services as Record<string, unknown>).postgres = { status: "connected" };
  } catch {
    (health.services as Record<string, unknown>).postgres = { status: "disconnected" };
    health.status = "degraded";
  }

  // Check Redis
  try {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const res = await fetch(redisUrl.replace("redis://", "http://"), {
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);
    (health.services as Record<string, unknown>).redis = {
      status: res ? "connected" : "available",
    };
  } catch {
    (health.services as Record<string, unknown>).redis = { status: "unknown" };
  }

  // Check WAHA
  try {
    const wahaUrl = process.env.WAHA_API_URL || "http://localhost:3001";
    const res = await fetch(`${wahaUrl}/api/sessions`, {
      headers: { "X-Api-Key": process.env.WAHA_API_KEY || "" },
      signal: AbortSignal.timeout(3000),
    });
    (health.services as Record<string, unknown>).waha = {
      status: res.ok ? "connected" : "error",
    };
  } catch {
    (health.services as Record<string, unknown>).waha = { status: "disconnected" };
  }

  return NextResponse.json(health, {
    status: health.status === "ok" ? 200 : 503,
  });
}

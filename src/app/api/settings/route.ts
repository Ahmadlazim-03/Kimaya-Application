import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const [configs, scoreConfig] = await Promise.all([
      prisma.systemConfig.findMany(),
      prisma.scoreConfig.findFirst({ where: { departmentId: null } }),
    ]);
    const configMap: Record<string, string> = {};
    for (const c of configs) configMap[c.key] = c.value;
    return NextResponse.json({ system: configMap, scoring: scoreConfig });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (body.system) {
      for (const [key, value] of Object.entries(body.system)) {
        await prisma.systemConfig.upsert({
          where: { key }, update: { value: String(value) }, create: { key, value: String(value) },
        });
      }
    }
    if (body.scoring) {
      const sc = body.scoring;
      const existing = await prisma.scoreConfig.findFirst({ where: { departmentId: null } });
      if (existing) {
        await prisma.scoreConfig.update({ where: { id: existing.id }, data: sc });
      }
    }
    return NextResponse.json({ message: "Pengaturan berhasil disimpan" });
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan" }, { status: 500 });
  }
}

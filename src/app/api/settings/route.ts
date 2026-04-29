import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const configs = await prisma.systemConfig.findMany();
    const configMap = configs.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
    
    const scoreConfig = await prisma.scoreConfig.findFirst({ where: { departmentId: null } });

    return NextResponse.json({
      systemConfig: configMap,
      scoreConfig: scoreConfig || {
        attendanceWeight: 30,
        reportCompletenessWeight: 25,
        reportQualityWeight: 20,
        responseSpeedWeight: 15,
        initiativeWeight: 10,
        thresholdAlert: 70
      }
    });
  } catch (error) {
    console.error("Settings API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { systemConfig, scoreConfig } = body;

    // Update system configs
    if (systemConfig) {
      for (const [key, value] of Object.entries(systemConfig)) {
        await prisma.systemConfig.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) }
        });
      }
    }

    // Update score config
    if (scoreConfig) {
      const existing = await prisma.scoreConfig.findFirst({ where: { departmentId: null } });
      if (existing) {
        await prisma.scoreConfig.update({
          where: { id: existing.id },
          data: scoreConfig
        });
      } else {
        await prisma.scoreConfig.create({
          data: scoreConfig
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings API POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json(locations);
  } catch (error) {
    console.error("Locations API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, address, latitude, longitude, geofenceRadiusM } = body;

    if (!id) {
      return NextResponse.json({ error: "ID lokasi wajib" }, { status: 400 });
    }

    await prisma.location.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(address !== undefined && { address }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(geofenceRadiusM !== undefined && { geofenceRadiusM: parseInt(geofenceRadiusM) }),
      },
    });

    return NextResponse.json({ message: "Lokasi berhasil diperbarui" });
  } catch (error) {
    console.error("Locations PUT error:", error);
    return NextResponse.json({ error: "Gagal memperbarui lokasi" }, { status: 500 });
  }
}

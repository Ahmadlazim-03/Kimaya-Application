import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const dept = searchParams.get("dept") || "";
    const loc = searchParams.get("loc") || "";

    const where: Record<string, unknown> = { role: { in: ["THERAPIST", "DEVELOPER"] } };
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (dept) where.department = { name: dept };
    if (loc) where.location = { name: loc };

    const employees = await prisma.user.findMany({
      where,
      include: {
        department: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: { fullName: "asc" },
    });

    const data = employees.map((e) => ({
      id: e.id,
      name: e.fullName,
      email: e.email,
      phone: e.phone || "-",
      dept: e.department?.name || "-",
      location: e.location?.name || "-",
      status: e.status.toLowerCase(),
      joinDate: e.joinDate?.toISOString().split("T")[0] || "-",
      avatar: e.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Employees API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, departmentName, locationName } = body;

    const dept = departmentName ? await prisma.department.findFirst({ where: { name: departmentName } }) : null;
    const loc = locationName ? await prisma.location.findFirst({ where: { name: locationName } }) : null;

    const user = await prisma.user.create({
      data: {
        fullName: name,
        email,
        phone,
        departmentId: dept?.id,
        locationId: loc?.id,
        role: "THERAPIST",
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ id: user.id, message: "Karyawan berhasil ditambahkan" }, { status: 201 });
  } catch (error) {
    console.error("Create employee error:", error);
    return NextResponse.json({ error: "Gagal menambahkan karyawan" }, { status: 500 });
  }
}

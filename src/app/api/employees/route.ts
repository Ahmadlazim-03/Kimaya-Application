import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role) where.role = role;

    const employees = await prisma.user.findMany({
      where,
      include: {
        location: { select: { name: true } },
      },
      orderBy: { fullName: "asc" },
    });

    const data = employees.map((e) => ({
      id: e.id,
      name: e.fullName,
      email: e.email,
      phone: e.phone || "-",
      role: e.role,
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

const DEFAULT_PASSWORD = "kimaya2026";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, role, locationName } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Nama dan email wajib diisi" }, { status: 400 });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }

    const loc = locationName ? await prisma.location.findFirst({ where: { name: locationName } }) : null;

    // Validate role
    const validRoles = ["THERAPIST", "CS", "DEVELOPER"];
    const userRole = validRoles.includes(role) ? role : "THERAPIST";

    // Hash default password
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

    // Non-therapist roles skip onboarding (no face verification needed)
    const needsOnboarding = userRole === "THERAPIST";

    const user = await prisma.user.create({
      data: {
        fullName: name,
        email: email.toLowerCase().trim(),
        locationId: loc?.id,
        role: userRole,
        status: "ACTIVE",
        passwordHash,
        onboardingCompleted: !needsOnboarding,
      },
    });

    return NextResponse.json({ 
      id: user.id, 
      message: `Karyawan berhasil ditambahkan. Password default: ${DEFAULT_PASSWORD}` 
    }, { status: 201 });
  } catch (error) {
    console.error("Create employee error:", error);
    return NextResponse.json({ error: "Gagal menambahkan karyawan" }, { status: 500 });
  }
}

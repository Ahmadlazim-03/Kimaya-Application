import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getSession, type UserRole } from "@/lib/auth";
import { canCreateRole } from "@/lib/employeeAuth";

const DEFAULT_PASSWORD = "kimaya2026";

// ─────────────────────────────────────────────────────────────────────────
// GET — list employees (scoped by viewer role)
// ─────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Anda belum masuk" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Halaman ini hanya untuk admin" }, { status: 403 });
    }

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

    // CS can only see THERAPISTs in their own location.
    if (session.role === "CS") {
      where.role = "THERAPIST";
      if (session.locationId) where.locationId = session.locationId;
      else return NextResponse.json([]); // CS without a location → nothing to manage
    }

    const employees = await prisma.user.findMany({
      where,
      select: {
        id: true, email: true, fullName: true, phone: true, role: true,
        status: true, joinDate: true, avatarUrl: true, facePhotoUrl: true,
        location: { select: { id: true, name: true } },
        shift: { select: { id: true, name: true } },
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
      locationId: e.location?.id || null,
      shift: e.shift?.name || "-",
      shiftId: e.shift?.id || null,
      status: e.status.toLowerCase(),
      joinDate: e.joinDate?.toISOString().split("T")[0] || "-",
      avatar: e.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
      avatarUrl: e.avatarUrl || e.facePhotoUrl || null,
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Employees GET]", error);
    return NextResponse.json({ error: "Gagal memuat data karyawan" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// POST — create employee with full role/location guard
// ─────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Anda belum masuk" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({
        error: "Hanya developer, manager, dan customer service yang bisa menambah karyawan",
      }, { status: 403 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const requestedRole = String(body.role || "THERAPIST") as UserRole;
    const locationName = body.locationName ? String(body.locationName) : null;
    const shiftId = body.shiftId ? String(body.shiftId) : null;

    if (!name) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
    }
    if (!["DEVELOPER", "MANAGER", "CS", "THERAPIST"].includes(requestedRole)) {
      return NextResponse.json({ error: "Role tidak dikenali" }, { status: 400 });
    }

    // Role-hierarchy guard.
    if (!canCreateRole(session.role, requestedRole)) {
      if (session.role === "CS") {
        return NextResponse.json({
          error: "Sebagai Customer Service, Anda hanya bisa menambah Therapist.",
        }, { status: 403 });
      }
      return NextResponse.json({
        error: `Anda tidak diizinkan membuat karyawan dengan role ${requestedRole}`,
      }, { status: 403 });
    }

    // Resolve location.
    let locationId: string | null = null;
    if (locationName) {
      const loc = await prisma.location.findFirst({ where: { name: locationName } });
      if (!loc) {
        return NextResponse.json({ error: `Lokasi "${locationName}" tidak ditemukan` }, { status: 400 });
      }
      locationId = loc.id;
    }

    // Location-scope guard: CS can ONLY add therapists at their own cabang.
    if (session.role === "CS") {
      if (!session.locationId) {
        return NextResponse.json({
          error: "Akun CS Anda belum punya cabang. Hubungi developer/manager untuk set lokasi dulu.",
        }, { status: 400 });
      }
      if (locationId && locationId !== session.locationId) {
        return NextResponse.json({
          error: "Anda hanya bisa menambah therapist di cabang Anda sendiri.",
        }, { status: 403 });
      }
      // CS doesn't get to choose — we force-set to their own location.
      locationId = session.locationId;
    }

    // Unique-email check.
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }

    // Validate shift if provided.
    if (shiftId) {
      const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
      if (!shift) {
        return NextResponse.json({ error: "Shift tidak ditemukan" }, { status: 400 });
      }
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    // Both THERAPIST and CS do face-scan attendance, so they must complete
    // the face-onboarding flow on first login. MANAGER and DEVELOPER skip it.
    const needsOnboarding = requestedRole === "THERAPIST" || requestedRole === "CS";

    const user = await prisma.user.create({
      data: {
        fullName: name,
        email,
        locationId,
        shiftId,
        role: requestedRole,
        status: "ACTIVE",
        passwordHash,
        onboardingCompleted: !needsOnboarding,
      },
      select: { id: true, fullName: true, email: true, role: true },
    });

    return NextResponse.json({
      id: user.id,
      message: `Karyawan ${user.fullName} berhasil ditambahkan. Kata sandi awal: ${DEFAULT_PASSWORD}`,
    }, { status: 201 });
  } catch (error) {
    console.error("[Employees POST]", error);
    return NextResponse.json({ error: "Gagal menambahkan karyawan" }, { status: 500 });
  }
}

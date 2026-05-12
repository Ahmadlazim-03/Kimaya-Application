import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, type UserRole } from "@/lib/auth";
import { canCreateRole, canManageEmployee } from "@/lib/employeeAuth";

/**
 * PUT /api/employees/[id]
 *
 * Edit name / email / role / location / status of an existing employee.
 *
 * Authorization rules:
 *   - DEVELOPER, MANAGER: may edit any employee, change to any role/location.
 *   - CS: may only edit THERAPISTs in their own location, and cannot promote
 *         them to a non-therapist role nor move them to another cabang.
 *
 * Anti-escalation: an actor cannot upgrade an employee to a role the actor
 * itself wouldn't be allowed to create. So CS cannot turn a therapist into
 * a manager, etc.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Anda belum masuk" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Halaman ini hanya untuk admin" }, { status: 403 });
    }

    const { id } = await params;
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, locationId: true },
    });
    if (!target) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });

    // Can the actor manage THIS employee at all?
    if (!canManageEmployee(
      { role: session.role, locationId: session.locationId },
      { role: target.role as UserRole, locationId: target.locationId }
    )) {
      return NextResponse.json({
        error: session.role === "CS"
          ? "Anda hanya bisa mengubah therapist di cabang Anda sendiri."
          : "Anda tidak diizinkan mengubah karyawan ini.",
      }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, role, locationName, status, shiftId } = body;

    const updateData: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim()) updateData.fullName = name.trim();
    if (typeof email === "string" && email.trim()) {
      const e = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
      }
      updateData.email = e;
    }
    if (typeof status === "string" && ["ACTIVE", "PROBATION", "INACTIVE", "TERMINATED"].includes(status)) {
      updateData.status = status;
    }

    // Role change: must obey the hierarchy (anti-escalation).
    let newRole: UserRole | null = null;
    if (typeof role === "string" && ["DEVELOPER", "MANAGER", "CS", "THERAPIST"].includes(role)) {
      newRole = role as UserRole;
      if (newRole !== target.role && !canCreateRole(session.role, newRole)) {
        return NextResponse.json({
          error: session.role === "CS"
            ? "Anda tidak bisa mengubah role karyawan."
            : `Anda tidak diizinkan mengubah role ke ${newRole}.`,
        }, { status: 403 });
      }
      updateData.role = newRole;
    }

    // Location change: CS can NEVER change a therapist's location.
    let newLocationId: string | null | undefined = undefined;
    if (locationName !== undefined) {
      if (locationName === null || locationName === "") {
        newLocationId = null;
      } else {
        const loc = await prisma.location.findFirst({ where: { name: locationName } });
        if (!loc) {
          return NextResponse.json({ error: `Lokasi "${locationName}" tidak ditemukan` }, { status: 400 });
        }
        newLocationId = loc.id;
      }
      if (session.role === "CS" && newLocationId !== session.locationId) {
        return NextResponse.json({
          error: "Anda tidak bisa memindahkan karyawan ke cabang lain.",
        }, { status: 403 });
      }
      updateData.locationId = newLocationId;
    }

    // Shift assignment (admin only — CS already restricted above)
    if (shiftId !== undefined) {
      if (shiftId === null || shiftId === "") {
        updateData.shiftId = null;
      } else {
        const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
        if (!shift) {
          return NextResponse.json({ error: "Shift tidak ditemukan" }, { status: 400 });
        }
        updateData.shiftId = shiftId;
      }
    }

    await prisma.user.update({ where: { id }, data: updateData });
    return NextResponse.json({ message: "Data karyawan berhasil diperbarui" });
  } catch (error) {
    console.error("[Employees PUT]", error);
    return NextResponse.json({ error: "Gagal mengubah data karyawan" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DELETE — hard delete with FK cleanup
// ─────────────────────────────────────────────────────────────────────────
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Anda belum masuk" }, { status: 401 });
    if (!["DEVELOPER", "MANAGER", "CS"].includes(session.role)) {
      return NextResponse.json({ error: "Halaman ini hanya untuk admin" }, { status: 403 });
    }

    const { id } = await params;

    // Self-delete prevention.
    if (id === session.id) {
      return NextResponse.json({ error: "Anda tidak bisa menghapus akun sendiri" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id }, select: { id: true, role: true, locationId: true },
    });
    if (!target) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });

    if (!canManageEmployee(
      { role: session.role, locationId: session.locationId },
      { role: target.role as UserRole, locationId: target.locationId }
    )) {
      return NextResponse.json({
        error: session.role === "CS"
          ? "Anda hanya bisa menghapus therapist di cabang Anda sendiri."
          : "Anda tidak diizinkan menghapus karyawan ini.",
      }, { status: 403 });
    }

    // First nullify references where this user is approver/reviewer,
    // then hard-delete the row. Cascade handles owned-data (attendances,
    // reports, scores, etc).
    await prisma.$transaction(async (tx) => {
      await tx.leaveRequest.updateMany({ where: { approvedById: id }, data: { approvedById: null } });
      await tx.report.updateMany({ where: { reviewedById: id }, data: { reviewedById: null } });
      await tx.attendance.updateMany({ where: { approvedById: id }, data: { approvedById: null } });
      await tx.reminder.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.initiativePoint.deleteMany({ where: { givenById: id } });
      await tx.user.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Karyawan berhasil dihapus" });
  } catch (error) {
    console.error("[Employees DELETE]", error);
    return NextResponse.json({ error: "Gagal menghapus karyawan" }, { status: 500 });
  }
}

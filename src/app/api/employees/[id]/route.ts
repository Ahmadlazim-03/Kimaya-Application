import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, role, locationName, status } = body;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.fullName = name;
    if (email) updateData.email = email;
    if (status) updateData.status = status;

    // Update role if valid
    const validRoles = ["THERAPIST", "CS", "DEVELOPER", "MANAGER"];
    if (role && validRoles.includes(role)) updateData.role = role;

    if (locationName) {
      const loc = await prisma.location.findFirst({ where: { name: locationName } });
      if (loc) updateData.locationId = loc.id;
    }

    await prisma.user.update({ where: { id }, data: updateData });
    return NextResponse.json({ message: "Karyawan berhasil diupdate" });
  } catch (error) {
    console.error("Update employee error:", error);
    return NextResponse.json({ error: "Gagal mengupdate karyawan" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Use a transaction: first clear FK references where this user is
    // approver/reviewer (non-cascade), then hard-delete the user record.
    await prisma.$transaction(async (tx) => {
      // Nullify references where this user approved/reviewed other records
      await tx.leaveRequest.updateMany({ where: { approvedById: id }, data: { approvedById: null } });
      await tx.report.updateMany({ where: { reviewedById: id }, data: { reviewedById: null } });
      await tx.attendance.updateMany({ where: { approvedById: id }, data: { approvedById: null } });
      await tx.reminder.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.initiativePoint.deleteMany({ where: { givenById: id } });

      // Hard delete the user — cascades to attendances, reports, scores, etc.
      await tx.user.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Karyawan berhasil dihapus" });
  } catch (error) {
    console.error("Delete employee error:", error);
    return NextResponse.json({ error: "Gagal menghapus karyawan" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, departmentName, locationName, status } = body;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.fullName = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (status) updateData.status = status;

    if (departmentName) {
      const dept = await prisma.department.findFirst({ where: { name: departmentName } });
      if (dept) updateData.departmentId = dept.id;
    }
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
    await prisma.user.update({ where: { id }, data: { status: "TERMINATED" } });
    return NextResponse.json({ message: "Karyawan berhasil dinonaktifkan" });
  } catch (error) {
    console.error("Delete employee error:", error);
    return NextResponse.json({ error: "Gagal menghapus karyawan" }, { status: 500 });
  }
}

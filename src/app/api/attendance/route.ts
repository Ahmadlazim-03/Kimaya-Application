import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const date = new Date(dateStr);

    const [attendances, leaveRequests, totalEmployees] = await Promise.all([
      prisma.attendance.findMany({
        where: { date },
        include: { user: { select: { fullName: true, department: { select: { name: true } } } } },
        orderBy: { checkInTime: "asc" },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: { in: ["PENDING", "APPROVED"] },
          startDate: { lte: date },
          endDate: { gte: date },
        },
        include: { user: { select: { fullName: true } }, approvedBy: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where: { role: "EMPLOYEE", status: { in: ["ACTIVE", "PROBATION"] } } }),
    ]);

    const records = attendances.map((a) => ({
      id: a.id,
      name: a.user.fullName,
      dept: a.user.department?.name || "-",
      checkIn: a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-",
      checkOut: a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-",
      status: a.status === "ON_TIME" ? "on-time" : a.status.toLowerCase(),
      avatar: a.user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    }));

    const leaves = leaveRequests.map((lr) => ({
      id: lr.id,
      name: lr.user.fullName,
      type: lr.type === "ANNUAL" ? "Cuti Tahunan" : lr.type === "SICK" ? "Sakit" : lr.type === "EMERGENCY" ? "Izin Mendadak" : lr.type,
      from: lr.startDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      to: lr.endDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      status: lr.status.toLowerCase(),
      avatar: lr.user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    }));

    const present = attendances.filter((a) => a.status === "ON_TIME" || a.status === "LATE").length;
    const late = attendances.filter((a) => a.status === "LATE").length;
    const absent = attendances.filter((a) => a.status === "ABSENT").length;
    const onLeave = leaveRequests.filter((l) => l.status === "APPROVED").length;

    return NextResponse.json({ records, leaves, stats: { present, late, absent, onLeave, total: totalEmployees } });
  } catch (error) {
    console.error("Attendance API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, action } = body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const checkInDeadline = new Date(today); checkInDeadline.setHours(8, 10, 0, 0);
    const status = action === "checkin" && now > checkInDeadline ? "LATE" : "ON_TIME";

    if (action === "checkin") {
      const att = await prisma.attendance.upsert({
        where: { userId_date: { userId, date: today } },
        create: { userId, date: today, checkInTime: now, status },
        update: { checkInTime: now, status },
      });
      return NextResponse.json({ id: att.id, status: att.status });
    } else {
      const att = await prisma.attendance.update({
        where: { userId_date: { userId, date: today } },
        data: { checkOutTime: now },
      });
      return NextResponse.json({ id: att.id });
    }
  } catch (error) {
    console.error("Attendance POST error:", error);
    return NextResponse.json({ error: "Gagal mencatat absensi" }, { status: 500 });
  }
}

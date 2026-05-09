import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/attendance/calendar?userId=xxx&month=2026-05
// Returns: employee info + array of attendance entries for the month
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const monthStr = searchParams.get("month") || new Date().toISOString().slice(0, 7);

    // Parse month → startDate, endDate
    const [year, month] = monthStr.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // last day of month

    // Get employee list for selector
    const employees = await prisma.user.findMany({
      where: { role: "THERAPIST", status: { in: ["ACTIVE", "PROBATION"] } },
      select: { id: true, fullName: true, phone: true, avatarUrl: true, department: { select: { name: true } }, location: { select: { name: true } } },
      orderBy: { fullName: "asc" },
    });

    const employeeList = employees.map(e => ({
      id: e.id,
      name: e.fullName,
      dept: e.department?.name || "-",
      location: e.location?.name || "-",
      avatar: e.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      avatarUrl: e.avatarUrl,
    }));

    // If no userId selected, return just the employee list
    if (!userId) {
      return NextResponse.json({ employees: employeeList, attendances: [], summary: null });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, phone: true, avatarUrl: true, department: { select: { name: true } }, location: { select: { name: true } } },
    });

    if (!user) {
      return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
    }

    // Get attendances for the month
    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      include: { shift: { select: { name: true } } },
      orderBy: { date: "asc" },
    });

    // Map to calendar entries
    const calendarEntries = attendances.map(a => ({
      id: a.id,
      date: a.date.toISOString().split("T")[0],
      day: a.date.getDate(),
      status: a.status,
      isEarlyDeparture: a.isEarlyDeparture,
      shiftName: a.shift?.name || "Default",
      checkInTime: a.checkInTime
        ? new Date(a.checkInTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : null,
      checkOutTime: a.checkOutTime
        ? new Date(a.checkOutTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : null,
      checkInLat: a.checkInLat ? Number(a.checkInLat) : null,
      checkInLng: a.checkInLng ? Number(a.checkInLng) : null,
      checkOutLat: a.checkOutLat ? Number(a.checkOutLat) : null,
      checkOutLng: a.checkOutLng ? Number(a.checkOutLng) : null,
      selfieUrl: a.checkInSelfie || null,
      checkOutSelfieUrl: a.checkOutSelfie || null,
      method: a.checkInMethod,
      notes: a.notes,
    }));

    // Summary stats
    const onTime = attendances.filter(a => a.status === "ON_TIME").length;
    const late = attendances.filter(a => a.status === "LATE").length;
    const absent = attendances.filter(a => a.status === "ABSENT").length;

    // Determine working days based on Spa business logic
    // Default: Mon-Sat (1-6), Sun(0) is off.
    // We'll use a bitmask or array from config eventually.
    const workingDaysMask = [1, 2, 3, 4, 5, 6]; // Mon-Sat
    
    let workingDays = 0;
    const today = new Date(); today.setHours(23, 59, 59, 999);
    const checkDay = new Date(startDate);
    while (checkDay <= endDate && checkDay <= today) {
      const dow = checkDay.getDay();
      if (workingDaysMask.includes(dow)) workingDays++;
      checkDay.setDate(checkDay.getDate() + 1);
    }

    const summary = {
      employee: {
        id: user.id,
        name: user.fullName,
        dept: user.department?.name || "-",
        location: user.location?.name || "-",
        avatar: user.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
        avatarUrl: user.avatarUrl,
      },
      month: monthStr,
      monthLabel: startDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      workingDays,
      onTime,
      late,
      absent,
      present: onTime + late,
      attendanceRate: workingDays > 0 ? Math.round(((onTime + late) / workingDays) * 100) : 0,
    };

    return NextResponse.json({ employees: employeeList, attendances: calendarEntries, summary });
  } catch (error) {
    console.error("Calendar API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

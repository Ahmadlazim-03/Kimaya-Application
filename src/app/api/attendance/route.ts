import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { verifyFaceToken } from "@/lib/faceVerifyToken";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const date = new Date(dateStr);

    const [attendances, leaveRequests, totalEmployees] = await Promise.all([
      prisma.attendance.findMany({
        where: { date },
        include: { user: { select: { fullName: true, avatarUrl: true, department: { select: { name: true } }, location: { select: { name: true } } } } },
        orderBy: { checkInTime: "asc" },
      }),
      prisma.leaveRequest.findMany({
        where: { status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: date }, endDate: { gte: date } },
        include: { user: { select: { fullName: true, avatarUrl: true } }, approvedBy: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where: { role: "THERAPIST", status: { in: ["ACTIVE", "PROBATION"] } } }),
    ]);

    const records = attendances.map((a) => ({
      id: a.id,
      name: a.user.fullName,
      dept: a.user.department?.name || "-",
      location: a.user.location?.name || "-",
      checkIn: a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-",
      checkOut: a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-",
      status: a.status === "ON_TIME" ? "on-time" : a.status.toLowerCase(),
      method: a.checkInMethod,
      gpsVerified: !!(a.checkInLat && a.checkInLng),
      distance: null as number | null,
      avatar: a.user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
      avatarUrl: a.user.avatarUrl,
    }));

    const leaves = leaveRequests.map((lr) => ({
      id: lr.id,
      name: lr.user.fullName,
      type: lr.type === "ANNUAL" ? "Cuti Tahunan" : lr.type === "SICK" ? "Sakit" : lr.type === "EMERGENCY" ? "Izin Mendadak" : lr.type,
      from: lr.startDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      to: lr.endDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      status: lr.status.toLowerCase(),
      avatar: lr.user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
      avatarUrl: lr.user.avatarUrl,
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

// Haversine distance in meters
function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Handle leave approval (no face check needed)
    if (body.leaveId && body.action === "approve") {
      await prisma.leaveRequest.update({ where: { id: body.leaveId }, data: { status: "APPROVED", approvedAt: new Date() } });
      return NextResponse.json({ message: "Cuti disetujui" });
    }

    // ── Authentication ──
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    }

    const { action, latitude, longitude, selfiePhoto, faceVerifyToken } = body;
    const userId = session.id; // Use session user ID, not from body (prevent spoofing)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const now = new Date();

    // ── Face verification for check-in (THERAPIST only) ──
    let faceMatchScore: number | null = null;
    if (action === "checkin" && session.role === "THERAPIST") {
      // Validate user has registered face
      const userFace = await prisma.user.findUnique({
        where: { id: userId },
        select: { facePhotoUrl: true, onboardingCompleted: true },
      });

      if (!userFace?.facePhotoUrl) {
        return NextResponse.json(
          { error: "Anda belum mendaftarkan foto wajah. Selesaikan onboarding terlebih dahulu." },
          { status: 403 }
        );
      }

      // Validate face verification token
      if (!faceVerifyToken) {
        return NextResponse.json(
          { error: "Token verifikasi wajah diperlukan. Lakukan scan wajah terlebih dahulu." },
          { status: 403 }
        );
      }

      const tokenData = await verifyFaceToken(faceVerifyToken, userId, selfiePhoto);
      if (!tokenData) {
        return NextResponse.json(
          { error: "Token verifikasi wajah tidak valid atau sudah kedaluwarsa. Scan wajah ulang." },
          { status: 403 }
        );
      }

      faceMatchScore = tokenData.matchScore;
    }

    // Get user's assigned location and SHIFT for GPS/Time validation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { location: true, shift: true },
    });

    let gpsValid = false;
    let distance = 0;
    let gpsRadius = user?.location?.geofenceRadiusM || 100;
    let targetLocationName = user?.location?.name || "Belum ditentukan";

    if (latitude && longitude) {
      if (user?.location?.latitude && user?.location?.longitude) {
        const officeLat = Number(user.location.latitude);
        const officeLng = Number(user.location.longitude);
        distance = calcDistance(latitude, longitude, officeLat, officeLng);
        gpsValid = distance <= gpsRadius;
      } else {
        // User has no location assigned, check all available locations (Roaming support)
        const allLocations = await prisma.location.findMany();
        let nearestLoc = null;
        let minDistance = Infinity;

        for (const loc of allLocations) {
          if (loc.latitude && loc.longitude) {
            const d = calcDistance(latitude, longitude, Number(loc.latitude), Number(loc.longitude));
            if (d < minDistance) {
              minDistance = d;
              nearestLoc = loc;
            }
            if (d <= loc.geofenceRadiusM) {
              gpsValid = true;
              distance = d;
              gpsRadius = loc.geofenceRadiusM;
              targetLocationName = loc.name;
              
              // If roaming, we don't necessarily update locationId permanently, 
              // but for this record it's valid. 
              // (Optional: update user if it was null)
              if (!user?.locationId) {
                await prisma.user.update({
                  where: { id: userId },
                  data: { locationId: loc.id }
                });
              }
              break;
            }
          }
        }

        if (!gpsValid && nearestLoc) {
          distance = minDistance;
          gpsRadius = nearestLoc.geofenceRadiusM;
          targetLocationName = nearestLoc.name;
        }
      }
    }

    // Determine check-in/out time based on SHIFT or Global Config
    const configRow = await prisma.systemConfig.findUnique({ where: { key: "late_tolerance_minutes" } });
    const tolerance = parseInt(configRow?.value || "10");

    // Use User's Shift if available, else fallback to global config
    let shiftStartTime = "08:00";
    let shiftEndTime = "17:00";

    if (user?.shift) {
      shiftStartTime = user.shift.startTime;
      shiftEndTime = user.shift.endTime;
    } else {
      const globalStart = await prisma.systemConfig.findUnique({ where: { key: "default_check_in_time" } });
      if (globalStart) shiftStartTime = globalStart.value;
    }

    const [sh, sm] = shiftStartTime.split(":").map(Number);
    const checkInDeadline = new Date(today);
    checkInDeadline.setHours(sh, sm + tolerance, 0, 0);

    const [eh, em] = shiftEndTime.split(":").map(Number);
    const checkOutStandard = new Date(today);
    checkOutStandard.setHours(eh, em, 0, 0);

    if (action === "checkin") {
      const status = now > checkInDeadline ? "LATE" : "ON_TIME";
      const att = await prisma.attendance.upsert({
        where: { userId_date: { userId, date: today } },
        create: {
          userId, date: today, checkInTime: now, status,
          shiftId: user?.shiftId,
          checkInLat: latitude || null, checkInLng: longitude || null,
          checkInMethod: latitude ? "GPS_FACE" : "WEB_FACE",
          checkInSelfie: selfiePhoto || null,
        },
        update: {
          checkInTime: now, status,
          shiftId: user?.shiftId,
          checkInLat: latitude || null, checkInLng: longitude || null,
          checkInMethod: latitude ? "GPS_FACE" : "WEB_FACE",
          checkInSelfie: selfiePhoto || null,
        },
      });

      // ── Audit log with shift info ──
      await prisma.auditLog.create({
        data: {
          userId,
          action: "CHECK_IN",
          entityType: "Attendance",
          entityId: att.id,
          details: {
            status: att.status,
            shiftName: user?.shift?.name || "Default",
            faceMatchScore,
            gpsValid,
            distance: Math.round(distance),
            locationName: targetLocationName,
            method: latitude ? "GPS_FACE" : "WEB_FACE",
          },
        },
      });

      return NextResponse.json({
        id: att.id, status: att.status,
        gpsValid, distance: Math.round(distance),
        gpsRadius, faceMatchScore,
        locationName: targetLocationName,
        message: gpsValid
          ? `✅ Check-in berhasil! Wajah ✓ • GPS ✓ (${targetLocationName}) • Shift: ${user?.shift?.name || 'Default'}`
          : latitude
            ? `⚠️ Check-in berhasil! Wajah ✓ • GPS di luar radius (${Math.round(distance)}m dari ${targetLocationName})`
            : `✅ Check-in berhasil! Wajah ✓`,
      });
    } else {
      // Check-out: Handle early departure
      const isEarly = now < checkOutStandard;

      // Therapist face verification (same as check-in)
      if (session.role === "THERAPIST") {
        if (!faceVerifyToken) return NextResponse.json({ error: "Token verifikasi wajah diperlukan." }, { status: 403 });
        const tokenData = await verifyFaceToken(faceVerifyToken, userId, selfiePhoto);
        if (!tokenData) return NextResponse.json({ error: "Token tidak valid." }, { status: 403 });
        faceMatchScore = tokenData.matchScore;
      }

      const att = await prisma.attendance.update({
        where: { userId_date: { userId, date: today } },
        data: {
          checkOutTime: now,
          checkOutLat: latitude || null, checkOutLng: longitude || null,
          checkOutSelfie: selfiePhoto || null,
          isEarlyDeparture: isEarly,
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: "CHECK_OUT",
          entityType: "Attendance",
          entityId: att.id,
          details: {
            isEarlyDeparture: isEarly,
            shiftEndTime,
            checkOutTime: now.toISOString(),
          },
        },
      });

      return NextResponse.json({ 
        id: att.id, 
        isEarly,
        message: isEarly 
          ? "⚠️ Check-out berhasil! (Peringatan: Pulang lebih awal dari jadwal shift)" 
          : "✅ Check-out berhasil! Sampai jumpa besok." 
      });
    }
  } catch (error) {
    console.error("Attendance POST error:", error);
    return NextResponse.json({ error: "Gagal mencatat absensi" }, { status: 500 });
  }
}

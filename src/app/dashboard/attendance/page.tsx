"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, MapPin, Users, UserX, AlertTriangle, Calendar, Loader2, Check, Navigation, Shield, ShieldCheck, ShieldAlert, CalendarDays, ScanFace, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import dynamic from "next/dynamic";

const FaceDetector = dynamic(() => import("@/app/components/FaceDetector"), { ssr: false });

interface AttRecord { id: string; name: string; dept: string; checkIn: string; checkOut: string; status: string; method: string; gpsVerified: boolean; avatar: string; avatarUrl?: string | null; }
interface LeaveRec { id: string; name: string; type: string; from: string; to: string; status: string; avatar: string; avatarUrl?: string | null; }
interface AttStats { present: number; late: number; absent: number; onLeave: number; total: number; }

const statusBadges: Record<string, { label: string; cls: string }> = {
  "on-time": { label: "Tepat Waktu", cls: "bg-kimaya-olive/10 text-kimaya-olive" },
  late: { label: "Terlambat", cls: "bg-amber-100 text-amber-700" },
  absent: { label: "Tidak Hadir", cls: "bg-red-50 text-red-500" },
};
const leaveBadges: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-orange-50 text-orange-600" },
  approved: { label: "Disetujui", cls: "bg-kimaya-olive/10 text-kimaya-olive" },
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function AttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRec[]>([]);
  const [stats, setStats] = useState<AttStats>({ present: 0, late: 0, absent: 0, onLeave: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [toast, setToast] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsResult, setGpsResult] = useState<{ distance: number; gpsValid: boolean; gpsRadius: number } | null>(null);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [faceMatchScore, setFaceMatchScore] = useState<number | null>(null);
  const [faceChecking, setFaceChecking] = useState(false);
  const [stampingPhoto, setStampingPhoto] = useState(false);
  const [faceVerifyToken, setFaceVerifyToken] = useState<string | null>(null);
  const [attendanceAction, setAttendanceAction] = useState<"checkin" | "checkout">("checkin");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  // Find today's record for the current logged-in user
  const myRecord = records.find(r => r.id === user?.id || (user?.fullName && r.name === user.fullName));
  const hasCheckedIn = !!myRecord?.checkIn && myRecord.checkIn !== "-";
  const hasCheckedOut = !!myRecord?.checkOut && myRecord.checkOut !== "-";

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/attendance?date=${date}`)
      .then(r => r.json())
      .then(d => { setRecords(d.records || []); setLeaves(d.leaves || []); setStats(d.stats || {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error("GPS tidak tersedia")); return; }
      setGpsStatus("loading");
      navigator.geolocation.getCurrentPosition(
        pos => { const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setGpsCoords(c); setGpsStatus("success"); resolve(c); },
        err => { setGpsStatus("error"); reject(err); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleAttendanceAction = async (
    userId?: string,
    tokenOverride?: string,
    photoOverride?: string,
    actionOverride?: "checkin" | "checkout",
  ) => {
    // Use explicit override when provided — button onClicks pass it directly to
    // avoid the React state-update race (calling setAttendanceAction then
    // handleAttendanceAction in the same tick reads STALE attendanceAction).
    const finalAction = actionOverride || attendanceAction;
    setCheckingIn(true);
    try {
      const coords = await getLocation();
      const targetUserId = userId || (records.length > 0 ? records[0].id : "");
      const finalPhoto = photoOverride || selfiePhoto || undefined;

      const res = await fetch("/api/attendance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          action: finalAction,
          latitude: coords.lat, longitude: coords.lng,
          selfiePhoto: finalPhoto,
          faceVerifyToken: tokenOverride || faceVerifyToken,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(`❌ ${data.error || `Gagal ${finalAction}`}`);
        if (res.status === 403) {
          setSelfiePhoto(null);
          setFaceVerified(false);
          setFaceMatchScore(null);
          setFaceVerifyToken(null);
        }
      } else {
        if (finalAction === "checkin") {
          setGpsResult({ distance: data.distance, gpsValid: data.gpsValid, gpsRadius: data.gpsRadius });
        }
        showToast(data.message);
        fetchData();
        setSelfiePhoto(null);
        setFaceVerified(false);
        setFaceMatchScore(null);
        setFaceVerifyToken(null);
      }
    } catch (err) {
      console.error("Attendance action error:", err);
      showToast("⚠️ Gagal mendapatkan lokasi GPS. Pastikan GPS aktif.");
    }
    setCheckingIn(false);
  };

  const handleFaceVerified = async (photo: string, matchScore?: number) => {
    setFaceChecking(true);
    setShowFaceCapture(false);

    const score = matchScore || 85;
    let photoToUse = photo;

    try {
      // 1. Stamp photo first (to ensure token hash matches the saved photo)
      setStampingPhoto(true);
      try {
        const coords = await getLocation();
        const { reverseGeocode, stampPhoto } = await import("@/lib/photoStamp");
        const addressLines = await reverseGeocode(coords.lat, coords.lng);
        photoToUse = await stampPhoto({
          photoBase64: photo,
          dateTime: new Date(),
          addressLines,
          userName: user?.fullName,
        });
      } catch (err) {
        console.error("Stamp photo error during verify:", err);
      }
      setStampingPhoto(false);
      setSelfiePhoto(photoToUse);

      // 2. Call server-side verify-face API to get signed token for the STAMPED photo
      const res = await fetch("/api/attendance/verify-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selfiePhoto: photoToUse,
          matchScore: score,
        }),
      });
      const data = await res.json();

      if (res.ok && data.token) {
        setFaceVerifyToken(data.token);
        setFaceVerified(true);
        setFaceMatchScore(data.matchScore);
        setFaceChecking(false);
        showToast(`✅ Wajah terverifikasi (${data.matchScore}%)! Memproses ${attendanceAction}...`);

        // 3. Auto-trigger attendance action (checkin/checkout) — explicit action
        // so the call doesn't race with the setAttendanceAction state update.
        const finalAction = attendanceAction;
        setTimeout(() => {
          handleAttendanceAction(undefined, data.token, photoToUse, finalAction);
        }, 500);
      } else {
        setFaceChecking(false);
        setFaceVerified(false);
        showToast(`❌ ${data.error || "Gagal verifikasi wajah di server"}`);
      }
    } catch (err) {
      console.error("Face verified handler error:", err);
      setFaceChecking(false);
      setFaceVerified(false);
      setStampingPhoto(false);
      showToast("❌ Gagal memproses verifikasi wajah");
    }
  };

  const handleApproveLeave = async (id: string) => {
    await fetch("/api/attendance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaveId: id, action: "approve" }),
    });
    showToast("✅ Cuti berhasil disetujui");
    fetchData();
  };

  const statCards = [
    { label: "Hadir", value: stats.present, icon: Users, cls: "bg-kimaya-olive/10 text-kimaya-olive" },
    { label: "Terlambat", value: stats.late, icon: Clock, cls: "bg-amber-50 text-amber-600" },
    { label: "Tidak Hadir", value: stats.absent, icon: UserX, cls: "bg-red-50 text-red-500" },
    { label: "Cuti/Izin", value: stats.onLeave, icon: AlertTriangle, cls: "bg-blue-50 text-blue-600" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>;

  return (
    <>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px] mx-auto">
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="fixed top-6 right-6 z-[60] bg-kimaya-olive text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm max-w-sm">
              <Check size={16} /> {toast}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif text-kimaya-brown">Absensi</h1>
            <p className="text-sm text-kimaya-brown-light/60 mt-1">Kehadiran {stats.present} dari {stats.total} karyawan</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/attendance/calendar"
              className="px-4 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center gap-2">
              <CalendarDays size={14} /> Kalender Monitoring
            </Link>
            <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 border border-kimaya-cream-dark/30">
              <Calendar size={14} className="text-kimaya-brown-light/40" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-sm text-kimaya-brown outline-none" />
            </div>
          </div>
        </motion.div>

        {/* Face + GPS Attendance Card — for THERAPIST and CS (both do face attendance) */}
        {(user?.role === "THERAPIST" || user?.role === "CS") && (
          <motion.div variants={item} className="bg-gradient-to-r from-kimaya-olive/10 to-kimaya-cream rounded-2xl p-6 border border-kimaya-olive/20">
            <div className="flex flex-col gap-5">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm flex-shrink-0">
                  <Navigation size={24} className="text-kimaya-olive" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-serif text-kimaya-brown">Absensi Hari Ini</h3>
                  {user?.shift ? (
                    <p className="text-xs text-kimaya-brown-light/60 mt-0.5">
                      Shift <strong>{user.shift.name}</strong> · masuk {user.shift.startTime} · pulang {user.shift.endTime}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 mt-0.5">⚠️ Belum ada shift — hubungi admin untuk set shift Anda.</p>
                  )}
                  {/* Status hints */}
                  <p className="text-xs text-kimaya-brown-light/60 mt-1.5">
                    {hasCheckedIn && hasCheckedOut
                      ? "✅ Sudah selesai absen masuk & pulang hari ini."
                      : !hasCheckedIn
                        ? "Langkah 1: verifikasi wajah → Langkah 2: Check-in"
                        : "Langkah 1: verifikasi wajah → Langkah 2: Check-out"}
                  </p>
                  {gpsStatus === "loading" && (
                    <p className="text-xs text-blue-600 mt-1">📡 Mendapatkan lokasi GPS…</p>
                  )}
                  {gpsStatus === "error" && (
                    <p className="text-xs text-red-500 mt-1">❌ GPS gagal. Aktifkan izin lokasi di browser/aplikasi.</p>
                  )}
                  {gpsResult && !hasCheckedOut && (
                    <p className="text-xs mt-1">
                      {gpsResult.gpsValid
                        ? <span className="text-kimaya-olive flex items-center gap-1"><ShieldCheck size={12} /> Lokasi terverifikasi ({gpsResult.distance}m)</span>
                        : <span className="text-amber-600 flex items-center gap-1"><ShieldAlert size={12} /> Di luar radius ({gpsResult.distance}m / max {gpsResult.gpsRadius}m)</span>
                      }
                    </p>
                  )}
                  {faceChecking && (
                    <p className="text-xs text-blue-500 flex items-center gap-1 mt-1"><Loader2 size={12} className="animate-spin" /> Membandingkan wajah…</p>
                  )}
                  {faceVerified && faceMatchScore !== null && (
                    <p className="text-xs text-kimaya-olive flex items-center gap-1 mt-1"><ScanFace size={12} /> Wajah cocok ({faceMatchScore}%) — siap absen</p>
                  )}
                </div>
              </div>

              {/* Verifikasi wajah row — disembunyikan kalau sudah selesai check-in+out */}
              {!(hasCheckedIn && hasCheckedOut) && (
                <div className="flex justify-start">
                  <motion.button whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      // Verifikasi wajah memicu aksi default: check-in jika belum, else check-out.
                      setAttendanceAction(!hasCheckedIn ? "checkin" : "checkout");
                      setShowFaceCapture(true);
                    }}
                    disabled={checkingIn || stampingPhoto}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all border",
                      faceVerified
                        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                        : "bg-white text-kimaya-olive border-kimaya-olive/30 hover:bg-kimaya-olive/5"
                    )}>
                    <ScanFace size={16} />
                    {faceVerified ? "Wajah Terverifikasi ✓" : "Verifikasi Wajah Dulu"}
                  </motion.button>
                </div>
              )}

              {/* Dua tombol terpisah: Check-in & Check-out */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* CHECK-IN */}
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => { setAttendanceAction("checkin"); handleAttendanceAction(undefined, undefined, undefined, "checkin"); }}
                  disabled={hasCheckedIn || !faceVerified || checkingIn || stampingPhoto}
                  className={cn(
                    "px-6 py-4 rounded-xl text-white text-sm font-semibold transition-all shadow-lg flex items-center justify-center gap-2",
                    "bg-kimaya-olive hover:bg-kimaya-olive-dark shadow-kimaya-olive/20",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
                  )}>
                  {checkingIn && attendanceAction === "checkin"
                    ? <Loader2 size={16} className="animate-spin" />
                    : hasCheckedIn ? <Check size={16} /> : <MapPin size={16} />}
                  {hasCheckedIn
                    ? `Sudah Masuk · ${myRecord?.checkIn}`
                    : checkingIn && attendanceAction === "checkin"
                      ? "Memproses Check-in…"
                      : "Check-in (Masuk)"}
                </motion.button>

                {/* CHECK-OUT */}
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => { setAttendanceAction("checkout"); handleAttendanceAction(undefined, undefined, undefined, "checkout"); }}
                  disabled={!hasCheckedIn || hasCheckedOut || !faceVerified || checkingIn || stampingPhoto}
                  className={cn(
                    "px-6 py-4 rounded-xl text-white text-sm font-semibold transition-all shadow-lg flex items-center justify-center gap-2",
                    "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
                  )}>
                  {checkingIn && attendanceAction === "checkout"
                    ? <Loader2 size={16} className="animate-spin" />
                    : hasCheckedOut ? <Check size={16} /> : <LogOut size={16} />}
                  {hasCheckedOut
                    ? `Sudah Pulang · ${myRecord?.checkOut}`
                    : !hasCheckedIn
                      ? "Check-out (perlu masuk dulu)"
                      : checkingIn && attendanceAction === "checkout"
                        ? "Memproses Check-out…"
                        : "Check-out (Pulang)"}
                </motion.button>
              </div>

              {hasCheckedIn && hasCheckedOut && (
                <div className="px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium flex items-center gap-2 border border-emerald-200">
                  <Check size={16} /> Absensi hari ini selesai · Sampai jumpa besok!
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statCards.map(s => {
            const Icon = s.icon; return (
              <motion.div key={s.label} variants={item} className="bg-white rounded-2xl p-5 border border-kimaya-cream-dark/30">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", s.cls)}><Icon size={18} /></div>
                <p className="text-2xl font-semibold text-kimaya-brown">{s.value}</p>
                <p className="text-xs text-kimaya-brown-light/50 mt-0.5">{s.label}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attendance Table */}
          <motion.div variants={item} className="lg:col-span-2 bg-white rounded-2xl border border-kimaya-cream-dark/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-kimaya-cream-dark/20">
              <h2 className="text-lg font-serif text-kimaya-brown">Daftar Kehadiran</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-kimaya-cream-dark/20 bg-kimaya-cream/20">
                    {["Karyawan", "Dept", "Check-In", "Check-Out", "Status", "GPS"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-kimaya-brown-light/50 uppercase tracking-wider text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => {
                    const badge = statusBadges[r.status] || statusBadges.absent;
                    return (
                      <tr key={r.id} className="border-b border-kimaya-cream-dark/10 hover:bg-kimaya-cream/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-kimaya-olive/10 flex items-center justify-center text-xs font-semibold text-kimaya-olive overflow-hidden">
                              {r.avatarUrl ? (
                                <img src={r.avatarUrl} alt={r.name} className="w-full h-full object-cover" />
                              ) : (
                                r.avatar
                              )}
                            </div>
                            <span className="text-sm font-medium text-kimaya-brown">{r.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-kimaya-brown-light/60">{r.dept}</td>
                        <td className="px-4 py-3.5 text-sm font-mono text-kimaya-brown">{r.checkIn}</td>
                        <td className="px-4 py-3.5 text-sm font-mono text-kimaya-brown-light/60">{r.checkOut}</td>
                        <td className="px-4 py-3.5"><span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", badge.cls)}>{badge.label}</span></td>
                        <td className="px-4 py-3.5">
                          {r.gpsVerified
                            ? <span className="text-xs text-kimaya-olive flex items-center gap-1"><Shield size={12} /> GPS ✓</span>
                            : <span className="text-xs text-kimaya-brown-light/30">{r.method}</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                  {records.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-kimaya-brown-light/40">Tidak ada data absensi</td></tr>}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Leave Requests */}
          <motion.div variants={item} className="bg-white rounded-2xl border border-kimaya-cream-dark/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-kimaya-cream-dark/20">
              <h2 className="text-lg font-serif text-kimaya-brown">Pengajuan Cuti</h2>
            </div>
            <div className="p-4 space-y-3">
              {leaves.map(l => {
                const badge = leaveBadges[l.status] || leaveBadges.pending;
                return (
                  <div key={l.id} className="p-3 rounded-xl border border-kimaya-cream-dark/20">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded-full bg-kimaya-olive/10 flex items-center justify-center text-xs font-semibold text-kimaya-olive overflow-hidden">
                        {l.avatarUrl ? (
                          <img src={l.avatarUrl} alt={l.name} className="w-full h-full object-cover" />
                        ) : (
                          l.avatar
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-kimaya-brown">{l.name}</p>
                        <p className="text-xs text-kimaya-brown-light/40">{l.type}</p>
                      </div>
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", badge.cls)}>{badge.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-kimaya-brown-light/50">{l.from} — {l.to}</span>
                      {l.status === "pending" && <button onClick={() => handleApproveLeave(l.id)} className="text-kimaya-olive font-medium">Approve</button>}
                    </div>
                  </div>
                );
              })}
              {leaves.length === 0 && <p className="text-center text-sm text-kimaya-brown-light/40 py-8">Tidak ada pengajuan cuti</p>}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Face Detector Modal for Attendance */}
      <AnimatePresence>
        {showFaceCapture && (
          <FaceDetector
            mode="attendance"
            registeredFaceUrl={user?.facePhotoUrl}
            onCapture={handleFaceVerified}
            onClose={() => setShowFaceCapture(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

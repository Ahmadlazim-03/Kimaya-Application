"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, Download, CheckCircle2, AlertTriangle, XCircle, CalendarDays, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceRecord {
  id: string;
  name: string;
  dept: string;
  checkIn: string;
  checkOut: string;
  status: string;
  avatar: string;
}

interface LeaveRecord {
  id: string;
  name: string;
  type: string;
  from: string;
  to: string;
  status: string;
  avatar: string;
}

interface AttendanceStats {
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  total: number;
}

const badges: Record<string, { label: string; cls: string }> = {
  "on-time": { label: "Tepat Waktu", cls: "bg-kimaya-olive/10 text-kimaya-olive" },
  late: { label: "Terlambat", cls: "bg-amber-100 text-amber-700" },
  absent: { label: "Tidak Hadir", cls: "bg-red-50 text-red-500" },
  leave: { label: "Cuti / Izin", cls: "bg-blue-50 text-blue-600" },
  half_day: { label: "Setengah Hari", cls: "bg-orange-50 text-orange-600" },
  pending: { label: "Menunggu", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Disetujui", cls: "bg-kimaya-olive/10 text-kimaya-olive" },
  rejected: { label: "Ditolak", cls: "bg-red-50 text-red-500" },
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState<"daily" | "leave">("daily");
  const [checkInDone, setCheckInDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({ present: 0, late: 0, absent: 0, onLeave: 0, total: 0 });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/attendance?date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setLeaves(data.leaves || []);
        setStats(data.stats || { present: 0, late: 0, absent: 0, onLeave: 0, total: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch attendance:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const statCards = [
    { label: "Hadir", value: stats.present, icon: CheckCircle2, color: "bg-kimaya-olive/10 text-kimaya-olive" },
    { label: "Terlambat", value: stats.late, icon: AlertTriangle, color: "bg-amber-50 text-amber-600" },
    { label: "Tidak Hadir", value: stats.absent, icon: XCircle, color: "bg-red-50 text-red-500" },
    { label: "Cuti / Izin", value: stats.onLeave, icon: CalendarDays, color: "bg-blue-50 text-blue-600" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown">Absensi</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">Kelola kehadiran karyawan</p>
        </div>
        <div className="flex gap-3 items-center">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-kimaya-cream-dark/30 bg-white text-sm text-kimaya-brown focus:outline-none focus:border-kimaya-olive/30"
          />
          <motion.button whileTap={{ scale: 0.97 }} className="px-4 py-2.5 rounded-xl border border-kimaya-cream-dark/30 bg-white text-sm font-medium text-kimaya-brown hover:bg-kimaya-cream transition-colors flex items-center gap-2">
            <Download size={16} /> Ekspor
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setCheckInDone(!checkInDone)}
            className={cn(
              "px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg transition-all",
              checkInDone
                ? "bg-kimaya-gold text-white shadow-kimaya-gold/20 hover:bg-amber-600"
                : "bg-kimaya-olive text-white shadow-kimaya-olive/20 hover:bg-kimaya-olive-dark"
            )}
          >
            {checkInDone ? <><CheckCircle2 size={16} /> Check-Out</> : <><Clock size={16} /> Check-In</>}
          </motion.button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} variants={item} className="bg-white rounded-2xl p-4 border border-kimaya-cream-dark/30">
              <div className="flex items-center justify-between">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", s.color)}>
                  <Icon size={18} />
                </div>
                <span className="text-2xl font-semibold text-kimaya-brown">{s.value}</span>
              </div>
              <p className="text-xs text-kimaya-brown-light/50 mt-2">{s.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs */}
      <motion.div variants={item} className="flex bg-kimaya-cream rounded-xl p-1 w-fit">
        {(["daily", "leave"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} className={cn(
            "px-5 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === t ? "bg-white text-kimaya-brown shadow-sm" : "text-kimaya-brown-light/50"
          )}>
            {t === "daily" ? "Rekap Harian" : "Pengajuan Izin / Cuti"}
          </button>
        ))}
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-kimaya-olive" />
        </div>
      ) : (
        <>
          {/* Daily table */}
          {activeTab === "daily" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-kimaya-cream-dark/30 overflow-hidden">
              {records.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-kimaya-brown-light/40">
                  <Clock size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">Belum ada data absensi untuk tanggal ini</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-kimaya-cream-dark/30">
                        {["Karyawan", "Departemen", "Check-In", "Check-Out", "Status"].map((h) => (
                          <th key={h} className={cn("px-6 py-4 text-xs font-semibold text-kimaya-brown-light/50 uppercase tracking-wider", h === "Karyawan" || h === "Departemen" ? "text-left" : "text-center")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => {
                        const b = badges[r.status] || badges["on-time"];
                        return (
                          <tr key={r.id} className="border-b border-kimaya-cream-dark/10 last:border-0 hover:bg-kimaya-cream/20 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-kimaya-olive/10 flex items-center justify-center text-xs font-semibold text-kimaya-olive">{r.avatar}</div>
                                <span className="text-sm font-medium text-kimaya-brown">{r.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-kimaya-brown-light/60">{r.dept}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={cn("text-sm font-mono", r.checkIn === "-" ? "text-kimaya-brown-light/30" : "text-kimaya-brown")}>{r.checkIn}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={cn("text-sm font-mono", r.checkOut === "-" ? "text-kimaya-brown-light/30" : "text-kimaya-brown")}>{r.checkOut}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", b.cls)}>{b.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* Leave requests */}
          {activeTab === "leave" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-kimaya-cream-dark/30 overflow-hidden">
              {leaves.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-kimaya-brown-light/40">
                  <CalendarDays size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">Belum ada pengajuan izin/cuti</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-kimaya-cream-dark/30">
                        {["Karyawan", "Jenis", "Periode", "Status", "Aksi"].map((h) => (
                          <th key={h} className={cn("px-6 py-4 text-xs font-semibold text-kimaya-brown-light/50 uppercase tracking-wider", h === "Karyawan" || h === "Jenis" || h === "Periode" ? "text-left" : "text-center")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.map((req) => {
                        const b = badges[req.status] || badges.pending;
                        return (
                          <tr key={req.id} className="border-b border-kimaya-cream-dark/10 last:border-0 hover:bg-kimaya-cream/20 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-kimaya-olive/10 flex items-center justify-center text-xs font-semibold text-kimaya-olive">{req.avatar}</div>
                                <span className="text-sm font-medium text-kimaya-brown">{req.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-kimaya-brown-light/60">{req.type}</td>
                            <td className="px-6 py-4 text-sm text-kimaya-brown">{req.from} — {req.to}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", b.cls)}>{b.label}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {req.status === "pending" ? (
                                <div className="flex items-center justify-center gap-2">
                                  <motion.button whileTap={{ scale: 0.9 }} className="w-8 h-8 rounded-lg bg-kimaya-olive/10 text-kimaya-olive hover:bg-kimaya-olive hover:text-white flex items-center justify-center transition-all">
                                    <Check size={14} />
                                  </motion.button>
                                  <motion.button whileTap={{ scale: 0.9 }} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all">
                                    <X size={14} />
                                  </motion.button>
                                </div>
                              ) : <span className="text-xs text-kimaya-brown-light/40">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}

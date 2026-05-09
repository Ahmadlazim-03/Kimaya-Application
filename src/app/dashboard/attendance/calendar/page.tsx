"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Clock, MapPin, Camera, X as XIcon,
  Users, CheckCircle2, AlertTriangle, XCircle, Loader2, CalendarDays,
  Navigation, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Employee { id: string; name: string; dept: string; location: string; avatar: string; avatarUrl?: string | null; }
interface AttEntry {
  id: string; date: string; day: number; status: string;
  checkInTime: string | null; checkOutTime: string | null;
  checkInLat: number | null; checkInLng: number | null;
  checkOutLat: number | null; checkOutLng: number | null;
  selfieUrl: string | null; checkOutSelfieUrl?: string | null; method: string; notes: string | null;
  shiftName?: string; isEarlyDeparture?: boolean;
}
interface Summary {
  employee: Employee; month: string; monthLabel: string;
  workingDays: number; onTime: number; late: number; absent: number;
  present: number; attendanceRate: number;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  ON_TIME: { label: "Tepat Waktu", color: "text-emerald-600", bg: "bg-emerald-500", icon: CheckCircle2 },
  LATE:    { label: "Terlambat",   color: "text-amber-600",   bg: "bg-amber-500",   icon: AlertTriangle },
  ABSENT:  { label: "Tidak Hadir", color: "text-red-500",     bg: "bg-red-500",     icon: XCircle },
  EARLY:   { label: "Pulang Awal", color: "text-blue-500",    bg: "bg-blue-500",    icon: Clock },
  HALF_DAY:{ label: "Setengah Hari",color:"text-purple-500",  bg: "bg-purple-500",  icon: Clock },
};

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export default function AttendanceCalendarPage() {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<string>("");
  const [attendances, setAttendances] = useState<AttEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<AttEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ month: monthStr });
    if (selectedEmp) params.set("userId", selectedEmp);
    try {
      const res = await fetch(`/api/attendance/calendar?${params}`);
      const data = await res.json();
      setEmployees(data.employees || []);
      setAttendances(data.attendances || []);
      setSummary(data.summary || null);
    } catch { /* ignore */ }
    setLoading(false);
  }, [monthStr, selectedEmp]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const attMap = new Map<number, AttEntry>();
  attendances.forEach(a => attMap.set(a.day, a));

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  const isPast = (day: number) => {
    const d = new Date(currentYear, currentMonth, day);
    const t = new Date(); t.setHours(0,0,0,0);
    return d < t;
  };
  const isWeekend = (day: number) => {
    const dow = new Date(currentYear, currentMonth, day).getDay();
    return dow === 0 || dow === 6;
  };

  const filteredEmps = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.dept.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown flex items-center gap-2">
            <CalendarDays size={24} className="text-kimaya-olive" />
            Monitoring Absensi
          </h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">
            Pantau kehadiran therapist melalui kalender interaktif
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Employee Selector */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-kimaya-cream-dark/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-kimaya-cream-dark/20">
              <h3 className="text-sm font-semibold text-kimaya-brown flex items-center gap-2">
                <Users size={14} /> Pilih Karyawan
              </h3>
            </div>
            <div className="p-3">
              <input
                type="text" placeholder="Cari nama atau departemen..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-kimaya-cream-dark/30 bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 mb-2"
              />
              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                {filteredEmps.map(emp => (
                  <motion.button key={emp.id} whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedEmp(emp.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all",
                      selectedEmp === emp.id
                        ? "bg-kimaya-olive/10 border border-kimaya-olive/30"
                        : "hover:bg-kimaya-cream/50 border border-transparent"
                    )}>
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 overflow-hidden",
                      selectedEmp === emp.id ? "bg-kimaya-olive text-white" : "bg-kimaya-cream text-kimaya-brown-light/60"
                    )}>
                      {emp.avatarUrl ? (
                        <img src={emp.avatarUrl} alt={emp.name} className="w-full h-full object-cover" />
                      ) : (
                        emp.avatar
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium truncate", selectedEmp === emp.id ? "text-kimaya-olive" : "text-kimaya-brown")}>{emp.name}</p>
                      <p className="text-[10px] text-kimaya-brown-light/40 truncate">{emp.dept} · {emp.location}</p>
                    </div>
                    {selectedEmp === emp.id && <div className="w-2 h-2 rounded-full bg-kimaya-olive flex-shrink-0" />}
                  </motion.button>
                ))}
                {filteredEmps.length === 0 && (
                  <p className="text-xs text-kimaya-brown-light/40 text-center py-4">Tidak ada karyawan ditemukan</p>
                )}
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          {summary && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-4 space-y-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-kimaya-olive text-white flex items-center justify-center text-sm font-bold overflow-hidden">
                  {summary.employee.avatarUrl ? (
                    <img src={summary.employee.avatarUrl} alt={summary.employee.name} className="w-full h-full object-cover" />
                  ) : (
                    summary.employee.avatar
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-kimaya-brown">{summary.employee.name}</p>
                  <p className="text-[10px] text-kimaya-brown-light/40">{summary.monthLabel}</p>
                </div>
              </div>

              {/* Attendance Rate Circle */}
              <div className="flex items-center justify-center py-2">
                <div className="relative w-24 h-24">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#E8E6DE" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none"
                      stroke={summary.attendanceRate >= 80 ? "#5B633D" : summary.attendanceRate >= 60 ? "#d97706" : "#ef4444"}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${summary.attendanceRate * 2.64} ${264 - summary.attendanceRate * 2.64}`} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-kimaya-brown">{summary.attendanceRate}%</span>
                    <span className="text-[9px] text-kimaya-brown-light/40">Kehadiran</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Tepat Waktu", value: summary.onTime, color: "text-emerald-600", bg: "bg-emerald-50" },
                  { label: "Terlambat", value: summary.late, color: "text-amber-600", bg: "bg-amber-50" },
                  { label: "Tidak Hadir", value: summary.absent, color: "text-red-500", bg: "bg-red-50" },
                  { label: "Hari Kerja", value: summary.workingDays, color: "text-kimaya-brown", bg: "bg-kimaya-cream/50" },
                ].map(s => (
                  <div key={s.label} className={cn("rounded-xl p-2.5 text-center", s.bg)}>
                    <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
                    <p className="text-[9px] text-kimaya-brown-light/40">{s.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right: Calendar */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-kimaya-cream-dark/30 overflow-hidden">
            {/* Calendar Header */}
            <div className="px-6 py-4 border-b border-kimaya-cream-dark/20 flex items-center justify-between">
              <motion.button whileTap={{ scale: 0.9 }} onClick={prevMonth}
                className="w-9 h-9 rounded-xl hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/50 hover:text-kimaya-brown transition-colors">
                <ChevronLeft size={18} />
              </motion.button>
              <h2 className="text-lg font-serif text-kimaya-brown">
                {MONTHS[currentMonth]} {currentYear}
              </h2>
              <motion.button whileTap={{ scale: 0.9 }} onClick={nextMonth}
                className="w-9 h-9 rounded-xl hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/50 hover:text-kimaya-brown transition-colors">
                <ChevronRight size={18} />
              </motion.button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" />
              </div>
            ) : !selectedEmp ? (
              <div className="flex flex-col items-center justify-center py-20 text-kimaya-brown-light/40">
                <Users size={48} className="mb-3 opacity-30" />
                <p className="text-sm">Pilih karyawan di sebelah kiri</p>
                <p className="text-xs mt-1">untuk melihat kalender absensi</p>
              </div>
            ) : (
              <div className="p-4">
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS.map(d => (
                    <div key={d} className={cn(
                      "text-center text-[11px] font-semibold uppercase tracking-wider py-2",
                      d === "Min" || d === "Sab" ? "text-red-400/60" : "text-kimaya-brown-light/40"
                    )}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((day, idx) => {
                    if (day === null) return <div key={`empty-${idx}`} className="aspect-square" />;

                    const att = attMap.get(day);
                    const weekend = isWeekend(day);
                    const todayMark = isToday(day);
                    const past = isPast(day);
                    const sc = att ? statusConfig[att.status] : null;

                    return (
                      <motion.button
                        key={day}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => att && setSelectedDay(att)}
                        className={cn(
                          "aspect-square rounded-xl relative flex flex-col items-center justify-center transition-all border",
                          todayMark && "ring-2 ring-kimaya-olive ring-offset-1",
                          att ? "cursor-pointer hover:shadow-md" : "cursor-default",
                          weekend ? "bg-kimaya-cream/20 border-transparent" :
                          att?.status === "ON_TIME" ? "bg-emerald-50/80 border-emerald-200/50 hover:bg-emerald-50" :
                          att?.status === "LATE" ? "bg-amber-50/80 border-amber-200/50 hover:bg-amber-50" :
                          att?.status === "ABSENT" ? "bg-red-50/80 border-red-200/50 hover:bg-red-50" :
                          past && !weekend ? "bg-red-50/30 border-red-100/30" :
                          "bg-white border-kimaya-cream-dark/10"
                        )}
                      >
                        {/* Day Number */}
                        <span className={cn(
                          "text-sm font-semibold",
                          todayMark ? "text-kimaya-olive" :
                          weekend ? "text-red-300" :
                          att ? sc?.color : past ? "text-kimaya-brown-light/30" : "text-kimaya-brown-light/60"
                        )}>
                          {day}
                        </span>

                        {/* Status Dot */}
                        {att && sc && (
                          <div className={cn("w-1.5 h-1.5 rounded-full mt-0.5", sc.bg)} />
                        )}

                        {/* Selfie indicator */}
                        {att?.selfieUrl && (
                          <Camera size={8} className="absolute top-1 right-1 text-kimaya-olive/50" />
                        )}

                        {/* Check-in time label */}
                        {att?.checkInTime && (
                          <span className="text-[8px] text-kimaya-brown-light/40 mt-0.5 hidden sm:block">
                            {att.checkInTime.slice(0, 5)}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-kimaya-cream-dark/10 flex-wrap">
                  {Object.entries(statusConfig).slice(0, 3).map(([key, sc]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className={cn("w-2.5 h-2.5 rounded-full", sc.bg)} />
                      <span className="text-[10px] text-kimaya-brown-light/50">{sc.label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-kimaya-cream border border-kimaya-cream-dark/30" />
                    <span className="text-[10px] text-kimaya-brown-light/50">Belum Absen</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Camera size={10} className="text-kimaya-olive/50" />
                    <span className="text-[10px] text-kimaya-brown-light/50">Ada Foto</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelectedDay(null)}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-kimaya-brown px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarDays size={20} className="text-kimaya-gold" />
                  <div>
                    <h3 className="text-base font-serif text-kimaya-cream">Detail Absensi</h3>
                    <p className="text-xs text-kimaya-cream/50">
                      {new Date(selectedDay.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedDay(null)}
                  className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-kimaya-cream/60 hover:text-kimaya-cream hover:bg-white/20 transition-colors">
                  <XIcon size={16} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Employee Info & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {summary && (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-kimaya-olive text-white flex items-center justify-center text-sm font-bold overflow-hidden shadow-sm">
                        {summary.employee.avatarUrl ? (
                          <img src={summary.employee.avatarUrl} alt={summary.employee.name} className="w-full h-full object-cover" />
                        ) : (
                          summary.employee.avatar
                        )}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-kimaya-brown">{summary.employee.name}</p>
                        <p className="text-xs text-kimaya-brown-light/50">{summary.employee.dept} · {summary.employee.location}</p>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const sc = statusConfig[selectedDay.status] || statusConfig.ABSENT;
                    const Icon = sc.icon;
                    return (
                      <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full",
                        selectedDay.status === "ON_TIME" ? "bg-emerald-50" :
                        selectedDay.status === "LATE" ? "bg-amber-50" : "bg-red-50"
                      )}>
                        <Icon size={16} className={sc.color} />
                        <span className={cn("text-sm font-semibold", sc.color)}>{sc.label}</span>
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Check-In Column */}
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Check-In</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-mono font-bold text-kimaya-brown">
                          {selectedDay.checkInTime || "—"}
                        </p>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-kimaya-brown-light/60">
                          <Shield size={10} /> <span>Metode: <strong className="text-kimaya-brown">{selectedDay.method}</strong></span>
                        </div>
                        {selectedDay.checkInLat !== null && selectedDay.checkInLng !== null && (
                          <div className="flex items-center gap-1.5 text-[10px] text-kimaya-brown-light/60">
                            <Navigation size={10} className="text-kimaya-olive" />
                            <a href={`https://maps.google.com/?q=${selectedDay.checkInLat},${selectedDay.checkInLng}`}
                              target="_blank" rel="noopener noreferrer" className="hover:text-kimaya-olive font-medium underline">
                              GPS: {Number(selectedDay.checkInLat).toFixed(5)}, {Number(selectedDay.checkInLng).toFixed(5)}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-kimaya-brown-light/40 uppercase tracking-wider mb-2 flex items-center gap-1 font-semibold">
                        <Camera size={10} /> Foto Check-In
                      </p>
                      {selectedDay.selfieUrl ? (
                        <div className="rounded-xl overflow-hidden border border-kimaya-cream-dark/20 bg-kimaya-cream/10 shadow-sm aspect-video sm:aspect-auto">
                          <img src={selectedDay.selfieUrl} alt="Foto Check-In" className="w-full h-40 object-cover hover:scale-105 transition-transform duration-500" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 rounded-xl bg-kimaya-cream/10 border border-dashed border-kimaya-cream-dark/20">
                          <Camera size={24} className="text-kimaya-brown-light/10 mb-2" />
                          <p className="text-[10px] text-kimaya-brown-light/30">Tidak ada foto</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Check-Out Column */}
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100">
                      <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mb-1">Check-Out</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-mono font-bold text-kimaya-brown">
                          {selectedDay.checkOutTime || "—"}
                        </p>
                        {selectedDay.isEarlyDeparture && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase">Pulang Awal</span>
                        )}
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-kimaya-brown-light/60">
                          <Shield size={10} /> <span>Shift: <strong className="text-kimaya-brown">{selectedDay.shiftName || 'Default'}</strong></span>
                        </div>
                        {selectedDay.checkOutLat !== null && selectedDay.checkOutLng !== null && (
                          <div className="flex items-center gap-1.5 text-[10px] text-kimaya-brown-light/60">
                            <Navigation size={10} className="text-amber-600" />
                            <a href={`https://maps.google.com/?q=${selectedDay.checkOutLat},${selectedDay.checkOutLng}`}
                              target="_blank" rel="noopener noreferrer" className="hover:text-amber-600 font-medium underline">
                              GPS: {Number(selectedDay.checkOutLat).toFixed(5)}, {Number(selectedDay.checkOutLng).toFixed(5)}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-kimaya-brown-light/40 uppercase tracking-wider mb-2 flex items-center gap-1 font-semibold">
                        <Camera size={10} /> Foto Check-Out
                      </p>
                      {selectedDay.checkOutSelfieUrl ? (
                        <div className="rounded-xl overflow-hidden border border-kimaya-cream-dark/20 bg-kimaya-cream/10 shadow-sm aspect-video sm:aspect-auto">
                          <img src={selectedDay.checkOutSelfieUrl} alt="Foto Check-Out" className="w-full h-40 object-cover hover:scale-105 transition-transform duration-500" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 rounded-xl bg-kimaya-cream/10 border border-dashed border-kimaya-cream-dark/20">
                          <Camera size={24} className="text-kimaya-brown-light/10 mb-2" />
                          <p className="text-[10px] text-kimaya-brown-light/30">Tidak ada foto</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedDay.notes && (
                  <div className="p-3 rounded-xl bg-kimaya-cream/30 border border-kimaya-cream-dark/10">
                    <p className="text-[10px] text-kimaya-brown-light/40 uppercase tracking-wider mb-1 font-semibold">Catatan</p>
                    <p className="text-sm text-kimaya-brown leading-relaxed">{selectedDay.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

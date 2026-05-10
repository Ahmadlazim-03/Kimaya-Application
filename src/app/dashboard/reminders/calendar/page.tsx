"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Loader2, Search, Users,
  CheckCircle2, Clock, XCircle, Image as ImageIcon, X as XIcon, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Employee { id: string; name: string; dept: string; location: string; avatar: string; avatarUrl?: string | null }

interface UserDayItem {
  logId: string; reminderId: string; reminderTitle: string;
  sentAt: string; respondedAt: string | null;
  imageCount: number; thumbs: string[]; caption: string | null;
  status: "RESPONDED" | "PENDING" | "MISSED";
}
interface UserDay {
  day: number; date: string;
  logs: number; responded: number; missed: number; pending: number;
  status: "RESPONDED" | "PENDING" | "MISSED" | "NOT_SCHEDULED";
  items: UserDayItem[];
}
interface UserMode {
  mode: "user";
  employees: Employee[];
  days: UserDay[];
  summary: {
    employee: { id: string; name: string; avatar: string; avatarUrl: string | null; role: string; dept: string; location: string };
    month: string; monthLabel: string;
    totalLogs: number; totalResponded: number; totalMissed: number; totalPending: number;
    responseRate: number;
  };
}

interface AggResponse {
  logId: string; reminderId: string;
  userId: string; userName: string; userAvatar: string | null;
  reminderTitle: string; respondedAt: string;
  firstImage: string | null; caption: string | null;
}
interface AggDay {
  day: number; date: string;
  logs: number; responded: number; missed: number; pending: number;
  status: "RESPONDED" | "PENDING" | "MISSED" | "NOT_SCHEDULED";
  responses: AggResponse[];
}
interface AllMode {
  mode: "all";
  employees: Employee[];
  days: AggDay[];
  summary: {
    month: string; monthLabel: string;
    totalLogs: number; totalResponded: number; totalMissed: number; totalPending: number;
    responseRate: number;
  };
}

type ApiResp = UserMode | AllMode;

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const statusConfig: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  RESPONDED:    { label: "Sudah Dibalas", bg: "bg-emerald-500", text: "text-emerald-600", ring: "ring-emerald-200" },
  PENDING:      { label: "Menunggu",      bg: "bg-amber-500",   text: "text-amber-600",   ring: "ring-amber-200" },
  MISSED:       { label: "Tidak Dibalas", bg: "bg-red-500",     text: "text-red-500",     ring: "ring-red-200" },
  NOT_SCHEDULED:{ label: "Tidak Ada",     bg: "bg-gray-200",    text: "text-gray-400",    ring: "ring-gray-100" },
};

export default function ReminderCalendarPage() {
  const router = useRouter();
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [selectedEmp, setSelectedEmp] = useState<string>("all");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [openDay, setOpenDay] = useState<UserDay | AggDay | null>(null);

  const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ month: monthStr, userId: selectedEmp });
    try {
      const res = await fetch(`/api/reminders/calendar?${params}`);
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* ignore */ }
    setLoading(false);
  }, [monthStr, selectedEmp]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const dayMap = new Map<number, UserDay | AggDay>();
  data?.days.forEach((d) => dayMap.set(d.day, d));

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

  const filteredEmps = (data?.employees || []).filter((e) => e.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[1400px] mx-auto space-y-5 pb-12">
      <button onClick={() => router.push("/dashboard/reminders")}
        className="flex items-center gap-2 text-sm text-kimaya-brown-light/60 hover:text-kimaya-brown transition">
        <ArrowLeft size={16} /> Kembali ke Reminder
      </button>

      <div>
        <h1 className="text-2xl font-serif text-kimaya-brown">Tracking Reminder</h1>
        <p className="text-sm text-kimaya-brown-light/60 mt-1">
          Pantau pengiriman dan tanggapan reminder per hari
        </p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-5">
        {/* LEFT: employee selector */}
        <aside className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-4 space-y-3 lg:max-h-[calc(100vh-180px)] lg:sticky lg:top-4 lg:overflow-y-auto">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-kimaya-brown-light/40" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari therapist…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-kimaya-cream-dark/40 bg-kimaya-cream-light/50 text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
          </div>

          <button onClick={() => setSelectedEmp("all")}
            className={cn("w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition",
              selectedEmp === "all"
                ? "bg-kimaya-olive text-white shadow-md shadow-kimaya-olive/20"
                : "hover:bg-kimaya-cream/40 text-kimaya-brown")}>
            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center",
              selectedEmp === "all" ? "bg-white/20" : "bg-kimaya-olive/10")}>
              <Users size={16} className={selectedEmp === "all" ? "text-white" : "text-kimaya-olive"} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Semua Therapist</p>
              <p className={cn("text-[11px] truncate", selectedEmp === "all" ? "text-white/70" : "text-kimaya-brown-light/50")}>
                Agregat seluruh response
              </p>
            </div>
          </button>

          <div className="border-t border-kimaya-cream-dark/30 my-2" />

          <div className="space-y-1">
            {filteredEmps.map((e) => (
              <button key={e.id} onClick={() => setSelectedEmp(e.id)}
                className={cn("w-full flex items-center gap-3 p-2 rounded-xl text-left transition",
                  selectedEmp === e.id
                    ? "bg-kimaya-olive/10 text-kimaya-brown"
                    : "hover:bg-kimaya-cream/40 text-kimaya-brown")}>
                <div className="w-9 h-9 rounded-full bg-kimaya-olive overflow-hidden flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                  {e.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.avatarUrl} alt={e.name} className="w-full h-full object-cover" />
                  ) : <span>{e.avatar}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{e.name}</p>
                  <p className="text-[10px] text-kimaya-brown-light/50 truncate">{e.location}</p>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* RIGHT: calendar */}
        <div className="space-y-4 min-w-0">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <button onClick={prevMonth} className="w-9 h-9 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/60">
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <h2 className="text-base sm:text-lg font-serif text-kimaya-brown">{data?.summary.monthLabel || "—"}</h2>
                {data?.mode === "user" && (
                  <p className="text-[11px] text-kimaya-brown-light/50">{data.summary.employee.name}</p>
                )}
                {data?.mode === "all" && (
                  <p className="text-[11px] text-kimaya-brown-light/50">Seluruh therapist</p>
                )}
              </div>
              <button onClick={nextMonth} className="w-9 h-9 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/60">
                <ChevronRight size={18} />
              </button>
            </div>

            {data && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-blue-600">{data.summary.totalLogs}</p>
                  <p className="text-[9px] uppercase tracking-wider text-blue-600/70">Terkirim</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-emerald-600">{data.summary.totalResponded}</p>
                  <p className="text-[9px] uppercase tracking-wider text-emerald-600/70">Dibalas</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-red-500">{data.summary.totalMissed}</p>
                  <p className="text-[9px] uppercase tracking-wider text-red-500/70">Terlewat</p>
                </div>
                <div className="bg-kimaya-olive/10 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-kimaya-olive">{data.summary.responseRate}%</p>
                  <p className="text-[9px] uppercase tracking-wider text-kimaya-olive/70">Rate</p>
                </div>
              </div>
            )}
          </div>

          {/* Calendar grid */}
          <div className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-3 sm:p-5">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-kimaya-olive" /></div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
                  {DAYS.map((d) => (
                    <div key={d} className="text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-kimaya-brown-light/50 py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {cells.map((day, i) => {
                    if (day === null) return <div key={i} />;
                    const entry = dayMap.get(day);
                    const status = entry?.status || "NOT_SCHEDULED";
                    const cfg = statusConfig[status];
                    const today_ = isToday(day);
                    return (
                      <motion.button key={i} whileHover={{ scale: entry ? 1.04 : 1 }} whileTap={{ scale: 0.96 }}
                        onClick={() => entry && setOpenDay(entry)} disabled={!entry}
                        className={cn(
                          "aspect-square rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium relative transition-all",
                          entry ? "bg-white border" : "bg-kimaya-cream/20 text-kimaya-brown-light/30",
                          entry && status === "RESPONDED" && "border-emerald-200 hover:border-emerald-400",
                          entry && status === "PENDING" && "border-amber-200 hover:border-amber-400",
                          entry && status === "MISSED" && "border-red-200 hover:border-red-400",
                          !entry && "border border-transparent",
                          today_ && "ring-2 ring-offset-2 ring-kimaya-olive",
                        )}>
                        <span className={cn("absolute top-1 left-1.5 text-[10px] sm:text-xs",
                          entry ? cfg.text : "text-kimaya-brown-light/30")}>
                          {day}
                        </span>
                        {entry && (
                          <>
                            <span className={cn("absolute top-1.5 right-1.5 w-2 h-2 rounded-full", cfg.bg)} />
                            {entry.logs > 0 && (
                              <span className="absolute bottom-1 right-1.5 text-[9px] sm:text-[10px] font-semibold text-kimaya-brown-light/60">
                                {entry.responded}/{entry.logs}
                              </span>
                            )}
                          </>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-kimaya-cream-dark/30 text-[10px] sm:text-xs text-kimaya-brown-light/60">
                  {Object.entries(statusConfig).map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className={cn("w-2 h-2 rounded-full", cfg.bg)} />
                      <span>{cfg.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Day detail modal */}
      <AnimatePresence>
        {openDay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpenDay(null)}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="px-5 py-4 border-b border-kimaya-cream-dark/30 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-serif text-kimaya-brown">
                    {new Date(openDay.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </h3>
                  <p className="text-xs text-kimaya-brown-light/50 mt-0.5">
                    {openDay.responded}/{openDay.logs} ditanggapi · {openDay.missed} terlewat · {openDay.pending} menunggu
                  </p>
                </div>
                <button onClick={() => setOpenDay(null)} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40">
                  <XIcon size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {data?.mode === "user" && "items" in openDay && (
                  openDay.items.map((it) => <DayItemUser key={it.logId} it={it} />)
                )}
                {data?.mode === "all" && "responses" in openDay && (
                  openDay.responses.length > 0
                    ? openDay.responses.map((r) => <DayItemAll key={r.logId} r={r} />)
                    : <p className="text-center py-8 text-sm text-kimaya-brown-light/50">Belum ada tanggapan untuk hari ini</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DayItemUser({ it }: { it: UserDayItem }) {
  const cfg = statusConfig[it.status];
  return (
    <Link href={`/dashboard/reminders/${it.reminderId}/responses`}
      className="block bg-kimaya-cream/30 hover:bg-kimaya-cream/60 rounded-xl p-3 transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-kimaya-brown truncate">{it.reminderTitle}</p>
          <p className="text-[10px] text-kimaya-brown-light/50">
            Dikirim {new Date(it.sentAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            {it.respondedAt && ` · Dibalas ${new Date(it.respondedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", cfg.text, "bg-white")}>
          {cfg.label}
        </span>
      </div>
      {it.thumbs.length > 0 && (
        <div className="flex gap-1 mt-2">
          {it.thumbs.slice(0, 4).map((t, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={t} alt="" className="w-12 h-12 rounded-lg object-cover" />
          ))}
          {it.imageCount > 4 && (
            <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-[10px] font-medium text-kimaya-brown-light">
              +{it.imageCount - 4}
            </div>
          )}
        </div>
      )}
      {it.caption && <p className="text-xs text-kimaya-brown-light/70 mt-2 italic line-clamp-2">&ldquo;{it.caption}&rdquo;</p>}
    </Link>
  );
}

function DayItemAll({ r }: { r: AggResponse }) {
  return (
    <Link href={`/dashboard/reminders/${r.reminderId}/responses`}
      className="block bg-kimaya-cream/30 hover:bg-kimaya-cream/60 rounded-xl p-3 transition">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-kimaya-olive overflow-hidden flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          {r.userAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.userAvatar} alt={r.userName} className="w-full h-full object-cover" />
          ) : <span>{r.userName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-kimaya-brown truncate">{r.userName}</p>
          <p className="text-[10px] text-kimaya-brown-light/50">
            <MessageCircle size={9} className="inline mr-1" />
            {r.reminderTitle} · {new Date(r.respondedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </p>
          {r.caption && <p className="text-xs text-kimaya-brown-light/70 mt-1 italic line-clamp-1">&ldquo;{r.caption}&rdquo;</p>}
        </div>
        {r.firstImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.firstImage} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
        )}
      </div>
    </Link>
  );
}

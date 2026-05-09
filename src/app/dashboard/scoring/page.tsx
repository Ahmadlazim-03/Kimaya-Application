"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Trophy, TrendingUp, TrendingDown, AlertTriangle, X as XIcon, Loader2, Star, Calculator, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Employee {
  id: string; userId: string; name: string; dept: string; avatar: string;
  attendance: number; reports: number; quality: number; response: number; initiative: number;
  total: number; grade: string;
}
interface Stats { avgScore: number; topScore: number; lowScore: number; belowThreshold: number; }

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const gradeColors: Record<string, string> = { A: "text-kimaya-olive", B: "text-blue-600", C: "text-amber-600", D: "text-red-500" };
const gradeBg: Record<string, string> = { A: "bg-kimaya-olive/10", B: "bg-blue-50", C: "bg-amber-50", D: "bg-red-50" };

export default function ScoringPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<Stats>({ avgScore: 0, topScore: 0, lowScore: 0, belowThreshold: 0 });
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; avg: number }[]>([]);
  const [scoreComponents, setScoreComponents] = useState<{ name: string; weight: string; emoji: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4000); };


  const loadData = () => {
    setLoading(true);
    fetch("/api/scoring").then(r => r.json()).then(d => {
      setEmployees(d.employees || []); setStats(d.stats || {}); setMonthlyTrend(d.monthlyTrend || []); setScoreComponents(d.scoreComponents || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await fetch("/api/scoring/calculate", { method: "POST" });
      const data = await res.json();
      showToast(data.message || "Skor berhasil dihitung!");
      loadData();
    } catch {
      showToast("⚠️ Gagal menghitung skor");
    }
    setCalculating(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>;

  const radarData = selectedEmployee ? [
    { metric: "Kehadiran", score: selectedEmployee.attendance },
    { metric: "Kelengkapan", score: selectedEmployee.reports },
    { metric: "Kualitas", score: selectedEmployee.quality },
    { metric: "Respons", score: selectedEmployee.response },
    { metric: "Inisiatif", score: selectedEmployee.initiative },
  ] : [];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px] mx-auto">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[60] bg-kimaya-olive text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm max-w-md">
            <Check size={16} /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown">Skoring Karyawan</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">Performa bulan ini · {employees.length} karyawan</p>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleCalculate} disabled={calculating}
          className="px-5 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center gap-2 w-fit disabled:opacity-50">
          {calculating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
          Hitung Skor Otomatis
        </motion.button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Rata-rata Skor", value: stats.avgScore, icon: Star, cls: "bg-kimaya-olive/10 text-kimaya-olive" },
          { label: "Skor Tertinggi", value: stats.topScore, icon: TrendingUp, cls: "bg-emerald-50 text-emerald-600" },
          { label: "Skor Terendah", value: stats.lowScore, icon: TrendingDown, cls: "bg-amber-50 text-amber-600" },
          { label: "Di Bawah Ambang", value: stats.belowThreshold, icon: AlertTriangle, cls: "bg-red-50 text-red-500" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} variants={item} className="bg-white rounded-2xl p-5 border border-kimaya-cream-dark/30">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", s.cls)}><Icon size={18} /></div>
              <p className="text-2xl font-semibold text-kimaya-brown">{s.value}</p>
              <p className="text-xs text-kimaya-brown-light/50 mt-0.5">{s.label}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <motion.div variants={item} className="lg:col-span-2 bg-white rounded-2xl border border-kimaya-cream-dark/30 overflow-hidden">
          <div className="px-6 py-4 border-b border-kimaya-cream-dark/20 flex items-center justify-between">
            <h2 className="text-lg font-serif text-kimaya-brown">Leaderboard</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-kimaya-cream-dark/20 bg-kimaya-cream/20">
                  {["#", "Karyawan", "Dept", "Skor", "Grade", "Detail"].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-kimaya-brown-light/50 uppercase tracking-wider text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => (
                  <tr key={emp.id} className="border-b border-kimaya-cream-dark/10 hover:bg-kimaya-cream/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold",
                        i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-100 text-gray-500" : i === 2 ? "bg-orange-50 text-orange-600" : "text-kimaya-brown-light/30"
                      )}>{i < 3 ? <Trophy size={14} /> : i + 1}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-kimaya-olive/10 flex items-center justify-center text-xs font-semibold text-kimaya-olive">{emp.avatar}</div>
                        <span className="text-sm font-medium text-kimaya-brown">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-kimaya-brown-light/60">{emp.dept}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-kimaya-cream overflow-hidden">
                          <div className="h-full rounded-full bg-kimaya-olive transition-all" style={{ width: `${emp.total}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-kimaya-brown">{emp.total}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn("text-sm font-bold px-2 py-0.5 rounded", gradeColors[emp.grade], gradeBg[emp.grade])}>
                        {emp.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSelectedEmployee(emp)}
                        className="text-xs text-kimaya-olive hover:text-kimaya-olive-dark font-medium">Lihat</motion.button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Trend Chart */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30">
          <h2 className="text-lg font-serif text-kimaya-brown mb-4">Tren Skor Rata-rata</h2>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E6DE" />
                <XAxis dataKey="month" tick={{ fill: "#8A7D78", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[60, 100]} tick={{ fill: "#8A7D78", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E6DE", fontSize: 12 }} />
                <Line type="monotone" dataKey="avg" stroke="#5B633D" strokeWidth={2.5} dot={{ fill: "#5B633D", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-kimaya-brown-light/40 text-center py-10">Belum ada data tren</p>}
        </motion.div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedEmployee && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedEmployee(null)}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }} onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-kimaya-olive/10 flex items-center justify-center text-sm font-bold text-kimaya-olive">{selectedEmployee.avatar}</div>
                  <div>
                    <h2 className="text-lg font-serif text-kimaya-brown">{selectedEmployee.name}</h2>
                    <p className="text-xs text-kimaya-brown-light/50">{selectedEmployee.dept} · Grade <span className={cn("font-bold", gradeColors[selectedEmployee.grade])}>{selectedEmployee.grade}</span></p>
                  </div>
                </div>
                <button onClick={() => setSelectedEmployee(null)} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40"><XIcon size={18} /></button>
              </div>
              <div className="text-center mb-2">
                <span className="text-4xl font-bold text-kimaya-brown">{selectedEmployee.total}</span>
                <span className="text-lg text-kimaya-brown-light/50">/100</span>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#E8E6DE" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#6B5E59", fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="score" stroke="#5B633D" fill="#5B633D" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {[
                  { label: "Hadir", val: selectedEmployee.attendance },
                  { label: "Laporan", val: selectedEmployee.reports },
                  { label: "Kualitas", val: selectedEmployee.quality },
                  { label: "Respons", val: selectedEmployee.response },
                  { label: "Inisiatif", val: selectedEmployee.initiative },
                ].map(m => (
                  <div key={m.label} className="text-center p-2 rounded-xl bg-kimaya-cream/50">
                    <p className="text-lg font-semibold text-kimaya-brown">{m.val}</p>
                    <p className="text-xs text-kimaya-brown-light/40">{m.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

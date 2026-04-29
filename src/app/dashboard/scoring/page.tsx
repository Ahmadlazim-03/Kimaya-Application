"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Download, Trophy, TrendingUp, AlertTriangle, X as XIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmployeeScore {
  id: string;
  userId: string;
  name: string;
  dept: string;
  avatar: string;
  attendance: number;
  reports: number;
  quality: number;
  response: number;
  initiative: number;
  total: number;
  grade: string;
}

interface ScoreComponent {
  name: string;
  weight: string;
  emoji: string;
}

interface MonthlyTrend {
  month: string;
  avg: number;
}

function getGrade(score: number) {
  if (score >= 90) return { grade: "A", label: "Excellent", color: "text-kimaya-olive", bg: "bg-kimaya-olive/10" };
  if (score >= 80) return { grade: "B", label: "Good", color: "text-blue-600", bg: "bg-blue-50" };
  if (score >= 70) return { grade: "C", label: "Average", color: "text-amber-600", bg: "bg-amber-50" };
  if (score >= 60) return { grade: "D", label: "Below Avg", color: "text-orange-600", bg: "bg-orange-50" };
  return { grade: "E", label: "Poor", color: "text-red-500", bg: "bg-red-50" };
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function ScoringPage() {
  const [employees, setEmployees] = useState<EmployeeScore[]>([]);
  const [scoreComponents, setScoreComponents] = useState<ScoreComponent[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [stats, setStats] = useState({ avgScore: 0, topScore: 0, lowScore: 0, belowThreshold: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeScore | null>(null);

  useEffect(() => {
    async function fetchScoring() {
      try {
        setLoading(true);
        const res = await fetch("/api/scoring");
        if (res.ok) {
          const data = await res.json();
          setEmployees(data.employees || []);
          setStats(data.stats || { avgScore: 0, topScore: 0, lowScore: 0, belowThreshold: 0 });
          setMonthlyTrend(data.monthlyTrend || []);
          setScoreComponents(data.scoreComponents || []);
        }
      } catch (err) {
        console.error("Failed to fetch scoring:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchScoring();
  }, []);

  const sorted = [...employees].sort((a, b) => b.total - a.total);

  const radarData = selectedEmployee
    ? [
        { subject: "Kehadiran", value: selectedEmployee.attendance },
        { subject: "Laporan", value: selectedEmployee.reports },
        { subject: "Kualitas", value: selectedEmployee.quality },
        { subject: "Respons", value: selectedEmployee.response },
        { subject: "Inisiatif", value: selectedEmployee.initiative },
      ]
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" />
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown">Skoring Karyawan</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">Monitoring kinerja & performa tim</p>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} className="px-4 py-2.5 rounded-xl border border-kimaya-cream-dark/30 bg-white text-sm font-medium text-kimaya-brown hover:bg-kimaya-cream transition-colors flex items-center gap-2 w-fit">
          <Download size={16} /> Ekspor PDF
        </motion.button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Rata-rata Skor", value: stats.avgScore, icon: TrendingUp, sub: getGrade(stats.avgScore).grade },
          { label: "Skor Tertinggi", value: stats.topScore, icon: Trophy, sub: "↑" },
          { label: "Skor Terendah", value: stats.lowScore, icon: AlertTriangle, sub: "↓" },
          { label: "Di Bawah Threshold", value: stats.belowThreshold, icon: AlertTriangle, sub: "<70" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} variants={item} className="bg-white rounded-2xl p-4 border border-kimaya-cream-dark/30">
              <div className="flex items-center gap-2">
                <Icon size={16} className="text-kimaya-brown-light/40" />
                <span className="text-2xl font-semibold text-kimaya-brown">{s.value}</span>
                <span className="text-xs text-kimaya-brown-light/40">{s.sub}</span>
              </div>
              <p className="text-xs text-kimaya-brown-light/50 mt-1">{s.label}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Components */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30">
          <h2 className="text-lg font-serif text-kimaya-brown mb-4">Komponen Skor</h2>
          {scoreComponents.length === 0 ? (
            <div className="space-y-3">
              {[
                { name: "Kehadiran", weight: "30%", emoji: "⏰" },
                { name: "Kelengkapan", weight: "25%", emoji: "📄" },
                { name: "Kualitas", weight: "20%", emoji: "⭐" },
                { name: "Respons", weight: "15%", emoji: "⚡" },
                { name: "Inisiatif", weight: "10%", emoji: "🎯" },
              ].map((c) => (
                <div key={c.name} className="flex items-center gap-3 p-3 rounded-xl bg-kimaya-cream/30">
                  <span className="text-xl">{c.emoji}</span>
                  <span className="flex-1 text-sm font-medium text-kimaya-brown">{c.name}</span>
                  <span className="text-sm font-semibold text-kimaya-olive">{c.weight}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {scoreComponents.map((c) => (
                <div key={c.name} className="flex items-center gap-3 p-3 rounded-xl bg-kimaya-cream/30">
                  <span className="text-xl">{c.emoji}</span>
                  <span className="flex-1 text-sm font-medium text-kimaya-brown">{c.name}</span>
                  <span className="text-sm font-semibold text-kimaya-olive">{c.weight}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Leaderboard */}
        <motion.div variants={item} className="lg:col-span-2 bg-white rounded-2xl border border-kimaya-cream-dark/30 overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="text-lg font-serif text-kimaya-brown">Leaderboard</h2>
            <p className="text-xs text-kimaya-brown-light/50 mt-0.5">Peringkat skor total bulan ini</p>
          </div>
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-kimaya-brown-light/40">
              <Trophy size={32} className="mb-2 opacity-30" />
              <p className="text-sm">Belum ada data skor</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-kimaya-cream-dark/30 bg-kimaya-cream/20">
                    {["#", "Karyawan", "Skor", "Grade", "Detail"].map((h) => (
                      <th key={h} className={cn("px-4 py-3 text-xs font-semibold text-kimaya-brown-light/50 uppercase tracking-wider", h === "Karyawan" ? "text-left" : "text-center", h === "#" ? "w-12" : "")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((emp, i) => {
                    const { grade, color, bg } = getGrade(emp.total);
                    return (
                      <motion.tr
                        key={emp.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className="border-b border-kimaya-cream-dark/10 last:border-0 hover:bg-kimaya-cream/20 transition-colors"
                      >
                        <td className="text-center px-4 py-3.5">
                          {i < 3 ? (
                            <span className={cn("w-7 h-7 inline-flex items-center justify-center rounded-full text-xs font-bold",
                              i === 0 ? "bg-kimaya-gold/20 text-kimaya-gold" : i === 1 ? "bg-gray-200 text-gray-500" : "bg-orange-100 text-orange-500"
                            )}>{i + 1}</span>
                          ) : <span className="text-sm text-kimaya-brown-light/40">{i + 1}</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold",
                              i === 0 ? "bg-kimaya-gold/20 text-kimaya-gold" : "bg-kimaya-olive/10 text-kimaya-olive"
                            )}>{emp.avatar}</div>
                            <div>
                              <p className="text-sm font-medium text-kimaya-brown">{emp.name}</p>
                              <p className="text-xs text-kimaya-brown-light/40">{emp.dept}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-center px-4 py-3.5">
                          <span className="text-lg font-semibold text-kimaya-brown">{emp.total}</span>
                        </td>
                        <td className="text-center px-4 py-3.5">
                          <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full", bg, color)}>{grade}</span>
                        </td>
                        <td className="text-center px-4 py-3.5">
                          <button onClick={() => setSelectedEmployee(emp)} className="text-xs text-kimaya-olive hover:text-kimaya-olive-dark font-medium">
                            Lihat →
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* Trend Chart */}
      {monthlyTrend.length > 0 && (
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30">
          <h2 className="text-lg font-serif text-kimaya-brown mb-4">Tren Skor Rata-rata</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyTrend} barCategoryGap="35%">
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#8A7D78", fontSize: 12 }} />
              <YAxis domain={[60, 100]} axisLine={false} tickLine={false} tick={{ fill: "#8A7D78", fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E6DE", fontSize: 12 }} />
              <Bar dataKey="avg" radius={[8, 8, 0, 0]} maxBarSize={48}>
                {monthlyTrend.map((_, i) => (
                  <Cell key={i} fill={i === monthlyTrend.length - 1 ? "#5B633D" : "#B8BCAA"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Detail Modal with Radar Chart */}
      <AnimatePresence>
        {selectedEmployee && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedEmployee(null)}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-kimaya-olive/10 flex items-center justify-center text-sm font-bold text-kimaya-olive">
                    {selectedEmployee.avatar}
                  </div>
                  <div>
                    <h3 className="font-serif text-lg text-kimaya-brown">{selectedEmployee.name}</h3>
                    <p className="text-xs text-kimaya-brown-light/50">{selectedEmployee.dept}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedEmployee(null)} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40">
                  <XIcon size={18} />
                </button>
              </div>

              {/* Total */}
              <div className="text-center mb-4 p-4 rounded-2xl bg-kimaya-cream/30">
                <p className="text-4xl font-bold text-kimaya-brown">{selectedEmployee.total}</p>
                <p className={cn("text-sm font-semibold mt-1", getGrade(selectedEmployee.total).color)}>
                  Grade {getGrade(selectedEmployee.total).grade} — {getGrade(selectedEmployee.total).label}
                </p>
              </div>

              {/* Radar Chart */}
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData} outerRadius={70}>
                  <PolarGrid stroke="#E8E6DE" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#4A3530", fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="#5B633D" fill="#5B633D" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>

              {/* Breakdown bars */}
              <div className="space-y-2.5 mt-2">
                {[
                  { label: "Kehadiran (30%)", value: selectedEmployee.attendance },
                  { label: "Kelengkapan (25%)", value: selectedEmployee.reports },
                  { label: "Kualitas (20%)", value: selectedEmployee.quality },
                  { label: "Respons (15%)", value: selectedEmployee.response },
                  { label: "Inisiatif (10%)", value: selectedEmployee.initiative },
                ].map((it) => (
                  <div key={it.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-kimaya-brown-light/60">{it.label}</span>
                      <span className="text-xs font-semibold text-kimaya-brown">{it.value}</span>
                    </div>
                    <div className="h-2 bg-kimaya-cream rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${it.value}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" as const }}
                        className={cn("h-full rounded-full",
                          it.value >= 90 ? "bg-kimaya-olive" : it.value >= 80 ? "bg-blue-500" : it.value >= 70 ? "bg-amber-500" : "bg-red-400"
                        )}
                      />
                    </div>
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

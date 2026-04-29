"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Users, CheckCircle2, FileText, Star, Clock, Upload, Bell, TrendingUp, ArrowUpRight, ArrowDownRight, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardData {
  stats: { totalEmployees: number; presentToday: number; attendanceRate: string; pendingReports: number; avgScore: number };
  attendanceWeek: { day: string; hadir: number; tidakHadir: number }[];
  topPerformers: { name: string; dept: string; score: number; avatar: string }[];
  recentActivity: { name: string; action: string; time: string; status: string; avatar: string }[];
}

const statusMap: Record<string, { label: string; cls: string }> = {
  "on-time": { label: "Tepat Waktu", cls: "bg-kimaya-olive/10 text-kimaya-olive" },
  late: { label: "Terlambat", cls: "bg-amber-100 text-amber-700" },
  submitted: { label: "Terkirim", cls: "bg-blue-50 text-blue-600" },
  pending: { label: "Menunggu", cls: "bg-orange-50 text-orange-600" },
  absent: { label: "Tidak Hadir", cls: "bg-red-50 text-red-500" },
};

function getGrade(s: number) {
  if (s >= 90) return { g: "A", c: "text-kimaya-olive" };
  if (s >= 80) return { g: "B", c: "text-blue-600" };
  return { g: "C", c: "text-amber-600" };
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } } };

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-kimaya-cream-dark/30 px-4 py-3 text-xs">
      <p className="font-semibold text-kimaya-brown mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-kimaya-brown-light/70">
          {p.dataKey === "hadir" ? "Hadir" : "Tidak Hadir"}: <span className="font-semibold text-kimaya-brown">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" />
      </div>
    );
  }

  const stats = [
    { label: "Total Karyawan", value: String(data?.stats.totalEmployees || 0), change: "", up: true, icon: Users, color: "bg-kimaya-olive/10 text-kimaya-olive" },
    { label: "Hadir Hari Ini", value: String(data?.stats.presentToday || 0), change: `${data?.stats.attendanceRate || 0}%`, up: true, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" },
    { label: "Laporan Pending", value: String(data?.stats.pendingReports || 0), change: "", up: false, icon: FileText, color: "bg-amber-50 text-amber-600" },
    { label: "Rata-rata Skor", value: String(data?.stats.avgScore || 0), change: "", up: true, icon: Star, color: "bg-yellow-50 text-yellow-600" },
  ];

  const attendanceWeek = data?.attendanceWeek || [];
  const topPerformers = data?.topPerformers || [];
  const recentActivity = data?.recentActivity || [];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown">Dashboard</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">Selamat datang kembali! Berikut ringkasan hari ini.</p>
        </div>
        <div className="flex bg-kimaya-cream rounded-xl p-1">
          {(["today", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                period === p ? "bg-white text-kimaya-brown shadow-sm" : "text-kimaya-brown-light/50 hover:text-kimaya-brown-light"
              )}
            >
              {p === "today" ? "Hari Ini" : p === "week" ? "Minggu Ini" : "Bulan Ini"}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              variants={item}
              whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(91,99,61,0.08)" }}
              className="bg-white rounded-2xl p-5 border border-kimaya-cream-dark/30 cursor-default"
            >
              <div className="flex items-start justify-between">
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", stat.color)}>
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <span className={cn(
                  "text-xs font-medium px-2 py-1 rounded-full flex items-center gap-0.5",
                  stat.up ? "bg-kimaya-olive/10 text-kimaya-olive" : "bg-red-50 text-red-500"
                )}>
                  {stat.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {stat.change}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-semibold text-kimaya-brown tracking-tight">{stat.value}</p>
                <p className="text-sm text-kimaya-brown-light/50 mt-1">{stat.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recharts Attendance Chart */}
        <motion.div variants={item} className="lg:col-span-2 bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-serif text-kimaya-brown">Absensi Minggu Ini</h2>
              <p className="text-xs text-kimaya-brown-light/50 mt-0.5">Tingkat kehadiran karyawan</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-kimaya-olive" />
                <span className="text-kimaya-brown-light/60">Hadir</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-kimaya-cream-dark" />
                <span className="text-kimaya-brown-light/60">Tidak Hadir</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attendanceWeek} barGap={4} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E6DE" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#8A7D78", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8A7D78", fontSize: 12 }} domain={[0, 50]} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(91,99,61,0.04)" }} />
              <Bar dataKey="hadir" radius={[6, 6, 0, 0]} maxBarSize={32}>
                {attendanceWeek.map((_, i) => (
                  <Cell key={i} fill="#5B633D" />
                ))}
              </Bar>
              <Bar dataKey="tidakHadir" radius={[6, 6, 0, 0]} maxBarSize={32}>
                {attendanceWeek.map((_, i) => (
                  <Cell key={i} fill="#D4D0C8" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top Performers */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-serif text-kimaya-brown">Top Performer</h2>
              <p className="text-xs text-kimaya-brown-light/50 mt-0.5">Bulan ini</p>
            </div>
            <a href="/dashboard/scoring" className="text-xs text-kimaya-olive hover:text-kimaya-olive-dark font-medium flex items-center gap-1">
              Lihat semua <TrendingUp size={12} />
            </a>
          </div>
          <div className="space-y-2">
            {topPerformers.map((p, i) => {
              const { g, c } = getGrade(p.score);
              return (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.07 }}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-kimaya-cream/30 transition-colors"
                >
                  <span className="text-sm font-semibold text-kimaya-brown-light/30 w-5">{i + 1}</span>
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0",
                    i === 0 ? "bg-kimaya-gold/20 text-kimaya-gold" : "bg-kimaya-olive/10 text-kimaya-olive"
                  )}>
                    {p.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-kimaya-brown truncate">{p.name}</p>
                    <p className="text-xs text-kimaya-brown-light/40">{p.dept}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-kimaya-brown">{p.score}</p>
                    <p className={cn("text-xs font-medium", c)}>Grade {g}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <motion.div variants={item} className="lg:col-span-2 bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30">
          <h2 className="text-lg font-serif text-kimaya-brown mb-5">Aktivitas Terkini</h2>
          <div className="space-y-1">
            {recentActivity.map((a, i) => {
              const s = statusMap[a.status] || { label: a.status, cls: "bg-kimaya-cream text-kimaya-brown-light" };
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-kimaya-cream/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-kimaya-olive/10 flex items-center justify-center text-xs font-semibold text-kimaya-olive flex-shrink-0">
                    {a.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-kimaya-brown">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-kimaya-brown-light/50"> — {a.action}</span>
                    </p>
                    <p className="text-xs text-kimaya-brown-light/40 mt-0.5">{a.time}</p>
                  </div>
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", s.cls)}>{s.label}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30">
          <h2 className="text-lg font-serif text-kimaya-brown mb-5">Aksi Cepat</h2>
          <div className="space-y-3">
            {[
              { href: "/dashboard/attendance", icon: Clock, label: "Check-In Sekarang", desc: "Catat kehadiran hari ini", primary: true },
              { href: "/dashboard/reports", icon: Upload, label: "Upload Laporan", desc: "Kirim bukti laporan kerja" },
              { href: "/dashboard/scoring", icon: Star, label: "Lihat Skor", desc: "Cek performa karyawan" },
              { href: "/dashboard/reminders", icon: Bell, label: "Buat Reminder", desc: "Kirim pengingat via WhatsApp" },
            ].map((act) => {
              const Icon = act.icon;
              return (
                <motion.a
                  key={act.href}
                  href={act.href}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl transition-all duration-200 group",
                    act.primary
                      ? "bg-kimaya-olive text-kimaya-cream hover:bg-kimaya-olive-dark shadow-lg shadow-kimaya-olive/10"
                      : "border border-kimaya-cream-dark/30 hover:bg-kimaya-cream/30 hover:border-kimaya-olive/20"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform",
                    act.primary ? "bg-white/10" : "bg-kimaya-olive/10 text-kimaya-olive"
                  )}>
                    <Icon size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className={cn("text-sm font-medium", act.primary ? "" : "text-kimaya-brown")}>{act.label}</p>
                    <p className={cn("text-xs", act.primary ? "opacity-60" : "text-kimaya-brown-light/50")}>{act.desc}</p>
                  </div>
                </motion.a>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

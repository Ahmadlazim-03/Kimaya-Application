"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Server, Database, Activity, Wifi, WifiOff, RefreshCw, Settings, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthData { status: string; timestamp: string; services: { postgres?: { status: string }; redis?: { status: string }; waha?: { status: string } }; }

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function MonitoringPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
    } catch { setHealth({ status: "error", timestamp: new Date().toISOString(), services: {} }); }
    setLoading(false);
  }, []);

  useEffect(() => { checkHealth(); }, [checkHealth]);

  const svcStatus = (s?: string) => {
    if (!s) return { label: "Unknown", cls: "bg-gray-100 text-gray-500", dot: "bg-gray-400" };
    if (s === "connected" || s === "ok") return { label: "Connected", cls: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" };
    if (s === "available") return { label: "Available", cls: "bg-blue-50 text-blue-600", dot: "bg-blue-500" };
    if (s === "degraded") return { label: "Degraded", cls: "bg-amber-50 text-amber-600", dot: "bg-amber-500" };
    return { label: s.charAt(0).toUpperCase() + s.slice(1), cls: "bg-red-50 text-red-500", dot: "bg-red-500" };
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px]">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown">Monitoring Server</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">Status koneksi dan kondisi layanan infrastruktur</p>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={checkHealth} disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-kimaya-cream text-sm text-kimaya-brown hover:bg-kimaya-cream-dark/40 transition-colors flex items-center gap-2 w-fit disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Status
        </motion.button>
      </motion.div>

      {/* Overall Status */}
      {loading && !health ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>
      ) : health ? (
        <>
          {/* Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* PostgreSQL */}
            <motion.div variants={item} className="bg-white rounded-2xl p-5 border border-kimaya-cream-dark/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Database size={18} className="text-blue-600" /></div>
                <span className="text-sm font-medium text-kimaya-brown">PostgreSQL</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("w-2.5 h-2.5 rounded-full animate-pulse", svcStatus(health.services.postgres?.status).dot)} />
                <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", svcStatus(health.services.postgres?.status).cls)}>
                  {svcStatus(health.services.postgres?.status).label}
                </span>
              </div>
              <p className="text-xs text-kimaya-brown-light/40">Database utama · Prisma ORM</p>
            </motion.div>

            {/* Redis */}
            <motion.div variants={item} className="bg-white rounded-2xl p-5 border border-kimaya-cream-dark/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center"><Activity size={18} className="text-red-500" /></div>
                <span className="text-sm font-medium text-kimaya-brown">Redis</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("w-2.5 h-2.5 rounded-full animate-pulse", svcStatus(health.services.redis?.status).dot)} />
                <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", svcStatus(health.services.redis?.status).cls)}>
                  {svcStatus(health.services.redis?.status).label}
                </span>
              </div>
              <p className="text-xs text-kimaya-brown-light/40">Cache & session store</p>
            </motion.div>

            {/* WAHA */}
            <motion.div variants={item} className="bg-white rounded-2xl p-5 border border-kimaya-cream-dark/30">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", health.services.waha?.status === "connected" ? "bg-emerald-50" : "bg-gray-100")}>
                  {health.services.waha?.status === "connected" ? <Wifi size={18} className="text-emerald-600" /> : <WifiOff size={18} className="text-gray-400" />}
                </div>
                <span className="text-sm font-medium text-kimaya-brown">WAHA</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("w-2.5 h-2.5 rounded-full animate-pulse", svcStatus(health.services.waha?.status).dot)} />
                <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", svcStatus(health.services.waha?.status).cls)}>
                  {svcStatus(health.services.waha?.status).label}
                </span>
              </div>
              <p className="text-xs text-kimaya-brown-light/40">WhatsApp API gateway</p>
            </motion.div>
          </div>

          {/* Overall Status Banner */}
          <motion.div variants={item} className={cn("rounded-2xl p-5 border flex items-center gap-4",
            health.status === "ok" ? "bg-emerald-50/50 border-emerald-200" : "bg-red-50/50 border-red-200"
          )}>
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", health.status === "ok" ? "bg-emerald-100" : "bg-red-100")}>
              <Server size={22} className={health.status === "ok" ? "text-emerald-600" : "text-red-500"} />
            </div>
            <div>
              <p className={cn("text-sm font-medium", health.status === "ok" ? "text-emerald-700" : "text-red-700")}>
                {health.status === "ok" ? "✅ Semua layanan berjalan normal" : "⚠️ Ada layanan yang bermasalah"}
              </p>
              <p className="text-xs text-kimaya-brown-light/50 mt-0.5">Terakhir dicek: {new Date(health.timestamp).toLocaleString("id-ID")}</p>
            </div>
          </motion.div>

          {/* System Info */}
          <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Settings size={18} className="text-purple-600" /></div>
              <div><h3 className="text-sm font-medium text-kimaya-brown">Informasi Sistem</h3><p className="text-xs text-kimaya-brown-light/50">Detail environment & konfigurasi</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Platform", value: "Next.js 16 + Turbopack" },
                { label: "Database", value: "PostgreSQL 16" },
                { label: "Cache", value: "Redis" },
                { label: "WhatsApp", value: "WAHA API" },
                { label: "Face Detection", value: "MediaPipe + face-api.js" },
                { label: "Deployment", value: "Docker Compose" },
              ].map(i => (
                <div key={i.label} className="flex justify-between p-3 rounded-xl bg-kimaya-cream/30">
                  <span className="text-xs text-kimaya-brown-light/50">{i.label}</span>
                  <span className="text-xs font-medium text-kimaya-brown">{i.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      ) : null}
    </motion.div>
  );
}

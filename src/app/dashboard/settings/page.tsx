"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Clock, MapPin, Star, Shield, Loader2, Check, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemConfig { [key: string]: string; }
interface ScoringConfig { attendanceWeight: number; reportCompletenessWeight: number; reportQualityWeight: number; responseSpeedWeight: number; initiativeWeight: number; thresholdAlert: number; }

const tabs = [
  { key: "general", label: "Umum", icon: Settings },
  { key: "scoring", label: "Skoring", icon: Star },
];

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const [system, setSystem] = useState<SystemConfig>({});
  const [scoring, setScoring] = useState<ScoringConfig>({
    attendanceWeight: 30, reportCompletenessWeight: 25, reportQualityWeight: 20,
    responseSpeedWeight: 15, initiativeWeight: 10, thresholdAlert: 70,
  });

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (d.system) setSystem(d.system);
      if (d.scoring) setScoring({
        attendanceWeight: d.scoring.attendanceWeight || 30,
        reportCompletenessWeight: d.scoring.reportCompletenessWeight || 25,
        reportQualityWeight: d.scoring.reportQualityWeight || 20,
        responseSpeedWeight: d.scoring.responseSpeedWeight || 15,
        initiativeWeight: d.scoring.initiativeWeight || 10,
        thresholdAlert: d.scoring.thresholdAlert || 70,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const totalWeight = scoring.attendanceWeight + scoring.reportCompletenessWeight + scoring.reportQualityWeight + scoring.responseSpeedWeight + scoring.initiativeWeight;

  const handleSave = async () => {
    if (activeTab === "scoring" && totalWeight !== 100) {
      showToast("⚠️ Total bobot harus 100%");
      return;
    }
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activeTab === "general" ? { system } : { scoring }),
    });
    setSaving(false);
    showToast("Pengaturan berhasil disimpan");
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1000px] mx-auto">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[60] bg-kimaya-olive text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm">
            <Check size={16} /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={item}>
        <h1 className="text-2xl font-serif text-kimaya-brown">Pengaturan</h1>
        <p className="text-sm text-kimaya-brown-light/60 mt-1">Konfigurasi sistem SIYAP</p>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={item} className="flex bg-kimaya-cream rounded-xl p-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={cn("flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                activeTab === t.key ? "bg-white text-kimaya-brown shadow-sm" : "text-kimaya-brown-light/50 hover:text-kimaya-brown-light"
              )}>
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </motion.div>

      {/* General Settings */}
      {activeTab === "general" && (
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-kimaya-olive/10 flex items-center justify-center"><Clock size={18} className="text-kimaya-olive" /></div>
            <div><h3 className="text-sm font-medium text-kimaya-brown">Waktu Kerja</h3><p className="text-xs text-kimaya-brown-light/50">Konfigurasi jam masuk dan pulang</p></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Jam Masuk Default</label>
              <input type="time" value={system.default_check_in_time || "08:00"} onChange={e => setSystem({ ...system, default_check_in_time: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Jam Pulang Default</label>
              <input type="time" value={system.default_check_out_time || "17:00"} onChange={e => setSystem({ ...system, default_check_out_time: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Toleransi Terlambat (menit)</label>
              <input type="number" value={system.late_tolerance_minutes || "10"} onChange={e => setSystem({ ...system, late_tolerance_minutes: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Max Upload Size (MB)</label>
              <input type="number" value={system.max_upload_size_mb || "25"} onChange={e => setSystem({ ...system, max_upload_size_mb: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
            </div>
          </div>

          <div className="border-t border-kimaya-cream-dark/20 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><MapPin size={18} className="text-blue-600" /></div>
              <div><h3 className="text-sm font-medium text-kimaya-brown">Geofencing</h3><p className="text-xs text-kimaya-brown-light/50">Radius lokasi check-in</p></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Radius Geofence (meter)</label>
              <input type="number" value={system.geofence_radius_meters || "100"} onChange={e => setSystem({ ...system, geofence_radius_meters: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Scoring Settings */}
      {activeTab === "scoring" && (
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-kimaya-olive/10 flex items-center justify-center"><Star size={18} className="text-kimaya-olive" /></div>
              <div><h3 className="text-sm font-medium text-kimaya-brown">Bobot Komponen Skor</h3><p className="text-xs text-kimaya-brown-light/50">Total harus = 100%</p></div>
            </div>
            <span className={cn("text-sm font-bold px-3 py-1 rounded-full", totalWeight === 100 ? "bg-kimaya-olive/10 text-kimaya-olive" : "bg-red-50 text-red-500")}>
              {totalWeight}%
            </span>
          </div>

          {[
            { key: "attendanceWeight", label: "Kehadiran", emoji: "⏰" },
            { key: "reportCompletenessWeight", label: "Kelengkapan Laporan", emoji: "📄" },
            { key: "reportQualityWeight", label: "Kualitas Laporan", emoji: "⭐" },
            { key: "responseSpeedWeight", label: "Kecepatan Respons", emoji: "⚡" },
            { key: "initiativeWeight", label: "Inisiatif", emoji: "🎯" },
          ].map(w => (
            <div key={w.key} className="flex items-center gap-4">
              <span className="text-lg">{w.emoji}</span>
              <label className="flex-1 text-sm text-kimaya-brown">{w.label}</label>
              <div className="flex items-center gap-2">
                <input type="range" min="0" max="50" value={scoring[w.key as keyof ScoringConfig]}
                  onChange={e => setScoring({ ...scoring, [w.key]: parseInt(e.target.value) })}
                  className="w-32 accent-kimaya-olive" />
                <span className="text-sm font-semibold text-kimaya-brown w-10 text-right">{scoring[w.key as keyof ScoringConfig]}%</span>
              </div>
            </div>
          ))}

          <div className="border-t border-kimaya-cream-dark/20 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center"><Shield size={18} className="text-red-500" /></div>
              <div><h3 className="text-sm font-medium text-kimaya-brown">Ambang Batas Peringatan</h3><p className="text-xs text-kimaya-brown-light/50">Skor di bawah nilai ini akan ditandai</p></div>
            </div>
            <input type="number" value={scoring.thresholdAlert} onChange={e => setScoring({ ...scoring, thresholdAlert: parseInt(e.target.value) || 70 })}
              className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
          </div>
        </motion.div>
      )}

      {/* Save Button */}
      <motion.div variants={item}>
        <motion.button whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving}
          className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Simpan Pengaturan
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

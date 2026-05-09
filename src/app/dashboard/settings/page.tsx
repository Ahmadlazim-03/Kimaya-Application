"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Shield, Loader2, Check, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoringConfig {
  attendanceWeight: number;
  reportCompletenessWeight: number;
  reportQualityWeight: number;
  responseSpeedWeight: number;
  initiativeWeight: number;
  thresholdAlert: number;
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [scoring, setScoring] = useState<ScoringConfig>({
    attendanceWeight: 30,
    reportCompletenessWeight: 25,
    reportQualityWeight: 20,
    responseSpeedWeight: 15,
    initiativeWeight: 10,
    thresholdAlert: 70
  });

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then((settingsData) => {
        if (settingsData.scoring) {
          setScoring({
            attendanceWeight: settingsData.scoring.attendanceWeight || 30,
            reportCompletenessWeight: settingsData.scoring.reportCompletenessWeight || 25,
            reportQualityWeight: settingsData.scoring.reportQualityWeight || 20,
            responseSpeedWeight: settingsData.scoring.responseSpeedWeight || 15,
            initiativeWeight: settingsData.scoring.initiativeWeight || 10,
            thresholdAlert: settingsData.scoring.thresholdAlert || 70
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const totalWeight = scoring.attendanceWeight + scoring.reportCompletenessWeight + scoring.reportQualityWeight + scoring.responseSpeedWeight + scoring.initiativeWeight;

  const handleSave = async () => {
    if (totalWeight !== 100) {
      showToast("⚠️ Total bobot harus 100%");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoring })
      });
      if (res.ok) {
        showToast("✅ Pengaturan berhasil disimpan");
      } else {
        showToast("❌ Gagal menyimpan pengaturan");
      }
    } catch {
      showToast("❌ Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px]">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[60] bg-kimaya-olive text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm">
            <Check size={16} /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={item}>
        <h1 className="text-2xl font-serif text-kimaya-brown">Pengaturan Skoring</h1>
        <p className="text-sm text-kimaya-brown-light/60 mt-1">Konfigurasi bobot penilaian kinerja karyawan</p>
      </motion.div>

      <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30 space-y-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-kimaya-olive/10 flex items-center justify-center">
              <Star size={18} className="text-kimaya-olive" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-kimaya-brown">Bobot Komponen Skor</h3>
              <p className="text-xs text-kimaya-brown-light/50">Total harus = 100%</p>
            </div>
          </div>
          <span className={cn("text-sm font-bold px-4 py-1.5 rounded-full transition-colors", 
            totalWeight === 100 ? "bg-kimaya-olive/10 text-kimaya-olive" : "bg-red-50 text-red-500"
          )}>
            {totalWeight}%
          </span>
        </div>

        <div className="space-y-5">
          {[
            { key: "attendanceWeight", label: "Kehadiran" },
            { key: "reportCompletenessWeight", label: "Kelengkapan Laporan" },
            { key: "reportQualityWeight", label: "Kualitas Laporan" },
            { key: "responseSpeedWeight", label: "Kecepatan Respons" },
            { key: "initiativeWeight", label: "Inisiatif" },
          ].map(w => (
            <div key={w.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-xl hover:bg-kimaya-cream/20 transition-colors">
              <div className="flex items-center gap-3 flex-1">
                <label className="text-sm font-medium text-kimaya-brown">{w.label}</label>
              </div>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={scoring[w.key as keyof ScoringConfig]}
                  onChange={e => setScoring({ ...scoring, [w.key]: parseInt(e.target.value) || 0 })} 
                  className="flex-1 sm:w-48 h-1.5 bg-kimaya-cream rounded-lg appearance-none cursor-pointer accent-kimaya-olive" 
                />
                <span className="text-sm font-bold text-kimaya-brown w-10 text-right">{scoring[w.key as keyof ScoringConfig]}%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-kimaya-cream-dark/20 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <Shield size={18} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-kimaya-brown">Ambang Batas Peringatan</h3>
              <p className="text-xs text-kimaya-brown-light/50">Skor di bawah nilai ini akan ditandai merah</p>
            </div>
          </div>
          <div className="relative">
            <input 
              type="number" 
              value={scoring.thresholdAlert} 
              onChange={e => setScoring({ ...scoring, thresholdAlert: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 transition-all" 
              placeholder="Contoh: 70"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-kimaya-brown/30">%</div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <motion.button 
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }} 
          onClick={handleSave} 
          disabled={saving}
          className="w-full py-4 rounded-xl bg-kimaya-olive text-white font-semibold text-sm hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
          Simpan Konfigurasi Skoring
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

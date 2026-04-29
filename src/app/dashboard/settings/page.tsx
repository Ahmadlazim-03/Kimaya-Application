"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, RefreshCw, Loader2, Clock, Settings2, MapPin, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [sysConfig, setSysConfig] = useState({
    default_check_in_time: "08:00",
    default_check_out_time: "17:00",
    late_tolerance_minutes: "10",
    geofence_radius_meters: "100",
    max_upload_size_mb: "25",
  });

  const [scoreConfig, setScoreConfig] = useState({
    attendanceWeight: 30,
    reportCompletenessWeight: 25,
    reportQualityWeight: 20,
    responseSpeedWeight: 15,
    initiativeWeight: 10,
    thresholdAlert: 70,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.systemConfig) {
          setSysConfig((prev) => ({ ...prev, ...data.systemConfig }));
        }
        if (data.scoreConfig) {
          setScoreConfig((prev) => ({ ...prev, ...data.scoreConfig }));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch settings:", err);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemConfig: sysConfig,
          scoreConfig: scoreConfig,
        }),
      });
      if (res.ok) {
        setSuccessMsg("Pengaturan berhasil disimpan.");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const totalWeight =
    Number(scoreConfig.attendanceWeight) +
    Number(scoreConfig.reportCompletenessWeight) +
    Number(scoreConfig.reportQualityWeight) +
    Number(scoreConfig.responseSpeedWeight) +
    Number(scoreConfig.initiativeWeight);

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
          <h1 className="text-2xl font-serif text-kimaya-brown">Pengaturan Sistem</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">Konfigurasi parameter aplikasi SIYAP</p>
        </div>
        <div className="flex items-center gap-3">
          {successMsg && <span className="text-sm text-kimaya-olive font-medium mr-2">{successMsg}</span>}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={saving || totalWeight !== 100}
            className="px-5 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            Simpan Perubahan
          </motion.button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waktu & Lokasi */}
        <motion.div variants={item} className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-kimaya-cream-dark/20">
              <div className="w-10 h-10 rounded-xl bg-kimaya-olive/10 flex items-center justify-center text-kimaya-olive">
                <Clock size={20} />
              </div>
              <div>
                <h2 className="text-lg font-serif text-kimaya-brown">Waktu Kerja</h2>
                <p className="text-xs text-kimaya-brown-light/50">Jam kerja dan toleransi</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Jam Masuk (Check-In)</label>
                  <input
                    type="time"
                    value={sysConfig.default_check_in_time}
                    onChange={(e) => setSysConfig({ ...sysConfig, default_check_in_time: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Jam Pulang (Check-Out)</label>
                  <input
                    type="time"
                    value={sysConfig.default_check_out_time}
                    onChange={(e) => setSysConfig({ ...sysConfig, default_check_out_time: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Toleransi Keterlambatan (Menit)</label>
                <input
                  type="number"
                  value={sysConfig.late_tolerance_minutes}
                  onChange={(e) => setSysConfig({ ...sysConfig, late_tolerance_minutes: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-kimaya-cream-dark/20">
              <div className="w-10 h-10 rounded-xl bg-kimaya-olive/10 flex items-center justify-center text-kimaya-olive">
                <MapPin size={20} />
              </div>
              <div>
                <h2 className="text-lg font-serif text-kimaya-brown">Geofencing & File</h2>
                <p className="text-xs text-kimaya-brown-light/50">Radius absen dan limit</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Radius Geofencing (Meter)</label>
                <input
                  type="number"
                  value={sysConfig.geofence_radius_meters}
                  onChange={(e) => setSysConfig({ ...sysConfig, geofence_radius_meters: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30"
                />
                <p className="text-xs text-kimaya-brown-light/40 mt-1">Jarak maksimum dari lokasi cabang untuk bisa absen.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Maksimum Ukuran Laporan (MB)</label>
                <input
                  type="number"
                  value={sysConfig.max_upload_size_mb}
                  onChange={(e) => setSysConfig({ ...sysConfig, max_upload_size_mb: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bobot Skoring */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-kimaya-cream-dark/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-kimaya-olive/10 flex items-center justify-center text-kimaya-olive">
                <Target size={20} />
              </div>
              <div>
                <h2 className="text-lg font-serif text-kimaya-brown">Bobot Penilaian</h2>
                <p className="text-xs text-kimaya-brown-light/50">Persentase skoring karyawan</p>
              </div>
            </div>
            <div className={cn("px-3 py-1.5 rounded-lg text-sm font-bold", totalWeight === 100 ? "bg-kimaya-olive/10 text-kimaya-olive" : "bg-red-50 text-red-500")}>
              Total: {totalWeight}%
            </div>
          </div>

          <div className="space-y-5">
            {[
              { label: "Kehadiran & Disiplin Waktu", key: "attendanceWeight", icon: "⏰" },
              { label: "Kelengkapan Laporan", key: "reportCompletenessWeight", icon: "📄" },
              { label: "Kualitas Laporan", key: "reportQualityWeight", icon: "⭐" },
              { label: "Kecepatan Respons", key: "responseSpeedWeight", icon: "⚡" },
              { label: "Inisiatif & Ekstra", key: "initiativeWeight", icon: "🎯" },
            ].map((field) => (
              <div key={field.key}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-kimaya-brown-light flex items-center gap-2">
                    <span>{field.icon}</span> {field.label}
                  </label>
                  <span className="text-sm font-semibold text-kimaya-brown w-12 text-right">
                    {(scoreConfig as any)[field.key]}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(scoreConfig as any)[field.key]}
                  onChange={(e) => setScoreConfig({ ...scoreConfig, [field.key]: parseInt(e.target.value) })}
                  className="w-full h-2 bg-kimaya-cream rounded-lg appearance-none cursor-pointer accent-kimaya-olive"
                />
              </div>
            ))}

            <div className="pt-4 border-t border-kimaya-cream-dark/20 mt-6">
              <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Threshold Peringatan Skor (<span className="text-red-500">Merah</span>)</label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  value={scoreConfig.thresholdAlert}
                  onChange={(e) => setScoreConfig({ ...scoreConfig, thresholdAlert: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30"
                />
                <span className="text-xs text-kimaya-brown-light/50 w-full">Karyawan dengan skor di bawah angka ini akan ditandai khusus.</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

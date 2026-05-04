"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Filter, ChevronDown, CheckCircle2, AlertCircle, Eye, Camera, MapPin, Plus, X as XIcon, Loader2, Check, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Report { id: string; title: string; by: string; date: string; category: string; rawCategory: string; status: string; fileType: string; hasPhoto: boolean; gpsLocation: boolean; cleanlinessScore: number | null; avatar: string; }
interface Stats { total: number; approved: number; pending: number; revision: number; }

const categories = ["Semua Kategori", "CLIENT_VISIT", "PROJECT_PROGRESS", "DAILY_REPORT", "EXPENSE_PROOF"];
const catLabels: Record<string, string> = { CLIENT_VISIT: "Kunjungan Klien", PROJECT_PROGRESS: "Progress Proyek", DAILY_REPORT: "Laporan Harian", EXPENSE_PROOF: "Bukti Pengeluaran", CLEANLINESS: "Kebersihan" };
const statusBadges: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  approved: { label: "Disetujui", cls: "bg-kimaya-olive/10 text-kimaya-olive", icon: CheckCircle2 },
  submitted: { label: "Menunggu", cls: "bg-amber-100 text-amber-700", icon: Eye },
  revision: { label: "Revisi", cls: "bg-red-50 text-red-500", icon: AlertCircle },
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-500", icon: FileText },
};

const cleanlinessChecklist = [
  { key: "floor", label: "Lantai bersih, tidak ada debu/noda" },
  { key: "tools", label: "Peralatan spa tersusun rapi" },
  { key: "towels", label: "Handuk bersih & tertata" },
  { key: "trash", label: "Tempat sampah sudah dikosongkan" },
  { key: "aroma", label: "Ruangan harum & segar" },
  { key: "bed", label: "Bed treatment bersih & rapi" },
  { key: "bathroom", label: "Kamar mandi bersih" },
  { key: "reception", label: "Area resepsi rapi & bersih" },
];

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, approved: 0, pending: 0, revision: 0 });
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("Semua Kategori");
  const [toast, setToast] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchData = useCallback(() => {
    const params = new URLSearchParams();
    if (catFilter !== "Semua Kategori") params.set("category", catFilter);
    fetch(`/api/reports?${params}`).then(r => r.json()).then(d => { setReports(d.reports || []); setStats(d.stats || {}); setLoading(false); }).catch(() => setLoading(false));
  }, [catFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (id: string) => {
    await fetch("/api/reports", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "APPROVED" }) });
    showToast("✅ Laporan berhasil disetujui");
    fetchData();
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      setPhotoBase64(result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const getLocation = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsLoading(false); },
      () => { showToast("⚠️ Gagal mendapatkan GPS"); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const openUploadModal = () => {
    setPhotoPreview(null); setPhotoBase64(null); setGpsCoords(null);
    setChecks(Object.fromEntries(cleanlinessChecklist.map(c => [c.key, false])));
    setShowUpload(true);
    // Auto-get GPS
    getLocation();
  };

  const handleSubmitReport = async () => {
    if (!photoBase64) { showToast("⚠️ Foto wajib diupload!"); return; }
    if (!gpsCoords) { showToast("⚠️ Lokasi GPS wajib diaktifkan!"); return; }

    setUploading(true);
    const res = await fetch("/api/reports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "", // will use default
        category: "CLEANLINESS",
        title: "Laporan Kebersihan Area",
        description: `Checklist kebersihan - ${Object.values(checks).filter(Boolean).length}/${cleanlinessChecklist.length} item terpenuhi`,
        photoBase64,
        latitude: gpsCoords.lat,
        longitude: gpsCoords.lng,
        cleanlinessChecks: checks,
      }),
    });
    const data = await res.json();
    showToast(data.message || "✅ Laporan terkirim");
    setUploading(false); setShowUpload(false);
    fetchData();
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  const cleanScore = cleanlinessChecklist.length > 0 ? Math.round((passedChecks / cleanlinessChecklist.length) * 100) : 0;

  const statCards = [
    { label: "Total Laporan", value: stats.total, cls: "bg-kimaya-olive/10 text-kimaya-olive" },
    { label: "Disetujui", value: stats.approved, cls: "bg-emerald-50 text-emerald-600" },
    { label: "Menunggu Review", value: stats.pending, cls: "bg-amber-50 text-amber-600" },
    { label: "Perlu Revisi", value: stats.revision, cls: "bg-red-50 text-red-500" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>;

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
          <h1 className="text-2xl font-serif text-kimaya-brown">Laporan & Bukti</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">{stats.total} laporan terdaftar</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.97 }} onClick={openUploadModal}
            className="px-5 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center gap-2">
            <Camera size={16} /> Upload Kebersihan
          </motion.button>
          <div className="relative">
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="appearance-none pl-10 pr-8 py-2.5 rounded-xl border border-kimaya-cream-dark/30 bg-white text-sm text-kimaya-brown focus:outline-none cursor-pointer">
              {categories.map(c => <option key={c} value={c}>{c === "Semua Kategori" ? c : catLabels[c] || c}</option>)}
            </select>
            <Filter size={14} className="absolute left-3.5 top-3.5 text-kimaya-brown-light/40 pointer-events-none" />
            <ChevronDown size={14} className="absolute right-3 top-3.5 text-kimaya-brown-light/40 pointer-events-none" />
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(s => (
          <motion.div key={s.label} variants={item} className="bg-white rounded-2xl p-5 border border-kimaya-cream-dark/30">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", s.cls)}><FileText size={18} /></div>
            <p className="text-2xl font-semibold text-kimaya-brown">{s.value}</p>
            <p className="text-xs text-kimaya-brown-light/50 mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Reports List */}
      <motion.div variants={item} className="space-y-3">
        {reports.map(r => {
          const badge = statusBadges[r.status] || statusBadges.draft;
          const BadgeIcon = badge.icon;
          return (
            <motion.div key={r.id} whileHover={{ y: -1 }}
              className="bg-white rounded-2xl p-5 border border-kimaya-cream-dark/30 hover:shadow-md transition-all">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-kimaya-cream flex items-center justify-center flex-shrink-0">
                  {r.hasPhoto ? <Camera size={20} className="text-kimaya-olive" /> : <FileText size={20} className="text-kimaya-brown-light/50" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-kimaya-brown">{r.title}</h3>
                      <p className="text-xs text-kimaya-brown-light/50 mt-1">{r.by} · {r.date}</p>
                    </div>
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0", badge.cls)}>
                      <BadgeIcon size={12} /> {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-kimaya-cream text-kimaya-brown-light/60">{r.category}</span>
                    {r.gpsLocation && <span className="text-xs px-2 py-0.5 rounded bg-kimaya-olive/10 text-kimaya-olive flex items-center gap-1"><MapPin size={10} /> GPS ✓</span>}
                    {r.cleanlinessScore !== null && (
                      <span className={cn("text-xs px-2 py-0.5 rounded flex items-center gap-1",
                        r.cleanlinessScore >= 80 ? "bg-kimaya-olive/10 text-kimaya-olive" : "bg-amber-50 text-amber-600"
                      )}>
                        <ShieldCheck size={10} /> Kebersihan: {r.cleanlinessScore}%
                      </span>
                    )}
                    {r.status === "submitted" && (
                      <button onClick={() => handleApprove(r.id)} className="ml-auto text-xs font-medium text-kimaya-olive hover:text-kimaya-olive-dark">✓ Approve</button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUpload(false)}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }} onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl my-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-serif text-kimaya-brown">Upload Laporan Kebersihan</h2>
                <button onClick={() => setShowUpload(false)} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center"><XIcon size={18} className="text-kimaya-brown-light/40" /></button>
              </div>

              {/* Photo Upload */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-kimaya-brown-light mb-2">📸 Foto Bukti Kebersihan *</label>
                {photoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-kimaya-cream-dark/30">
                    <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover" />
                    <button onClick={() => { setPhotoPreview(null); setPhotoBase64(null); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center"><XIcon size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-kimaya-cream-dark/40 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-kimaya-olive/40 transition-colors">
                    <Camera size={28} className="text-kimaya-brown-light/30" />
                    <span className="text-sm text-kimaya-brown-light/40">Ambil foto atau pilih dari galeri</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
              </div>

              {/* GPS Status */}
              <div className="mb-5 p-3 rounded-xl bg-kimaya-cream/30 border border-kimaya-cream-dark/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className={gpsCoords ? "text-kimaya-olive" : "text-kimaya-brown-light/40"} />
                    <span className="text-sm text-kimaya-brown">
                      {gpsLoading ? "Mendapatkan lokasi..." : gpsCoords ? `📍 ${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}` : "GPS belum aktif"}
                    </span>
                  </div>
                  {!gpsCoords && !gpsLoading && (
                    <button onClick={getLocation} className="text-xs text-kimaya-olive font-medium">Aktifkan GPS</button>
                  )}
                  {gpsCoords && <span className="text-xs text-kimaya-olive">✓ Terverifikasi</span>}
                </div>
              </div>

              {/* Checklist */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-kimaya-brown-light">✅ Checklist Kebersihan</label>
                  <span className={cn("text-sm font-bold px-2.5 py-0.5 rounded-full",
                    cleanScore >= 80 ? "bg-kimaya-olive/10 text-kimaya-olive" : cleanScore >= 50 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-500"
                  )}>{cleanScore}%</span>
                </div>
                <div className="space-y-2">
                  {cleanlinessChecklist.map(c => (
                    <label key={c.key} className="flex items-center gap-3 p-2.5 rounded-xl border border-kimaya-cream-dark/20 hover:bg-kimaya-cream/20 transition-colors cursor-pointer">
                      <input type="checkbox" checked={checks[c.key] || false}
                        onChange={e => setChecks({ ...checks, [c.key]: e.target.checked })}
                        className="w-4 h-4 rounded accent-kimaya-olive" />
                      <span className="text-sm text-kimaya-brown">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Score Preview */}
              <div className={cn("mb-5 p-4 rounded-xl text-center",
                cleanScore >= 80 ? "bg-kimaya-olive/10" : cleanScore >= 50 ? "bg-amber-50" : "bg-red-50")}>
                <p className="text-3xl font-bold text-kimaya-brown">{cleanScore}%</p>
                <p className="text-xs mt-1" style={{ color: cleanScore >= 80 ? "#5B633D" : cleanScore >= 50 ? "#d97706" : "#ef4444" }}>
                  {cleanScore >= 80 ? "✅ Area bersih — Siap beroperasi" : cleanScore >= 50 ? "⚠️ Perlu perbaikan sebelum operasional" : "❌ Area belum bersih — Wajib bersihkan ulang"}
                </p>
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={handleSubmitReport}
                disabled={uploading || !photoBase64 || !gpsCoords}
                className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 disabled:opacity-50 flex items-center justify-center gap-2">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                Kirim Laporan Kebersihan
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

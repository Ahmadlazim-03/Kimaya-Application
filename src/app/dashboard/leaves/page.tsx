"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, FileText, X as XIcon, Loader2, Check, Clock, AlertCircle, CheckCircle2, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  createdAt: string;
}

const leaveTypes = [
  { value: "ANNUAL", label: "Cuti Tahunan" },
  { value: "SICK", label: "Sakit" },
  { value: "EMERGENCY", label: "Izin Mendadak" },
  { value: "COMPANY", label: "Tugas Kantor" },
  { value: "WFH", label: "Work From Home" },
];

const statusConfig: Record<string, { label: string; cls: string; icon: any }> = {
  PENDING: { label: "Menunggu", cls: "bg-amber-50 text-amber-600 border-amber-100", icon: Clock },
  APPROVED: { label: "Disetujui", cls: "bg-kimaya-olive/10 text-kimaya-olive border-kimaya-olive/20", icon: CheckCircle2 },
  REJECTED: { label: "Ditolak", cls: "bg-red-50 text-red-600 border-red-100", icon: XCircle },
  CANCELLED: { label: "Dibatalkan", cls: "bg-gray-50 text-gray-500 border-gray-100", icon: XCircle },
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function LeavesPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  const [form, setForm] = useState({
    type: "ANNUAL",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leaves");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err) {
      console.error("Fetch leaves error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate || !form.reason) {
      showToast("⚠️ Semua field wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("✅ Pengajuan cuti berhasil dikirim");
        setShowUpload(false);
        setForm({ type: "ANNUAL", startDate: "", endDate: "", reason: "" });
        fetchData();
      } else {
        showToast(`❌ ${data.error || "Gagal mengajukan cuti"}`);
      }
    } catch (err) {
      showToast("❌ Terjadi kesalahan koneksi");
    } finally {
      setSubmitting(false);
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

      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown">Pengajuan Cuti & Izin</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">Kelola waktu istirahat dan izin tugas Anda</p>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowUpload(true)}
          className="px-5 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center gap-2">
          <Plus size={16} /> Ajukan Cuti Baru
        </motion.button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Info */}
        <motion.div variants={item} className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30 shadow-sm">
            <h3 className="text-sm font-bold text-kimaya-brown flex items-center gap-2 mb-4">
              <Info size={16} className="text-kimaya-olive" /> Informasi Cuti
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-kimaya-cream/20 border border-kimaya-cream-dark/10">
                <p className="text-[10px] text-kimaya-brown-light/50 uppercase font-bold mb-1">Status Shift</p>
                <p className="text-sm font-medium text-kimaya-brown">{user?.shift?.name || "Shift Belum Ditentukan"}</p>
              </div>
              <div className="p-4 rounded-xl bg-kimaya-olive/5 border border-kimaya-olive/10">
                <p className="text-[10px] text-kimaya-olive font-bold uppercase mb-1">Ketentuan</p>
                <ul className="text-xs text-kimaya-brown-light/70 space-y-2 list-disc pl-4">
                  <li>Pengajuan cuti maksimal H-7 untuk cuti tahunan.</li>
                  <li>Izin sakit wajib menyertakan surat dokter (hubungi admin).</li>
                  <li>Setiap pengajuan akan direview oleh Manager.</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        {/* History List */}
        <motion.div variants={item} className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-serif text-kimaya-brown px-1">Riwayat Pengajuan</h2>
          {requests.map((r) => {
            const config = statusConfig[r.status] || statusConfig.PENDING;
            const Icon = config.icon;
            return (
              <motion.div key={r.id} whileHover={{ y: -1 }}
                className="bg-white rounded-2xl p-5 border border-kimaya-cream-dark/30 hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-kimaya-cream flex items-center justify-center text-kimaya-olive flex-shrink-0">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-kimaya-brown">{leaveTypes.find(t => t.value === r.type)?.label || r.type}</h3>
                      <p className="text-xs text-kimaya-brown-light/60 mt-1">
                        {new Date(r.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} — {new Date(r.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-xs text-kimaya-brown-light/40 mt-2 italic">"{r.reason}"</p>
                    </div>
                  </div>
                  <div className={cn("px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase flex items-center gap-1.5", config.cls)}>
                    <Icon size={12} /> {config.label}
                  </div>
                </div>
              </motion.div>
            );
          })}
          {requests.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-kimaya-cream-dark/30">
              <FileText size={32} className="mx-auto text-kimaya-brown-light/10 mb-3" />
              <p className="text-sm text-kimaya-brown-light/30">Belum ada riwayat pengajuan cuti</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUpload(false)}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }} onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl my-4">
              
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-serif text-kimaya-brown">Ajukan Cuti/Izin</h2>
                  <p className="text-sm text-kimaya-brown-light/50">Lengkapi formulir di bawah ini</p>
                </div>
                <button onClick={() => setShowUpload(false)} className="w-10 h-10 rounded-xl hover:bg-kimaya-cream flex items-center justify-center transition-colors">
                  <XIcon size={20} className="text-kimaya-brown-light/40" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-kimaya-brown mb-2">Jenis Izin</label>
                  <select 
                    value={form.type} 
                    onChange={e => setForm({...form, type: e.target.value})}
                    className="w-full bg-kimaya-cream/20 border border-kimaya-cream-dark/30 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-kimaya-olive/20 focus:border-kimaya-olive outline-none transition-all"
                  >
                    {leaveTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-kimaya-brown mb-2">Mulai</label>
                    <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})}
                      className="w-full bg-kimaya-cream/20 border border-kimaya-cream-dark/30 rounded-xl px-4 py-3 text-sm outline-none focus:border-kimaya-olive" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-kimaya-brown mb-2">Selesai</label>
                    <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})}
                      className="w-full bg-kimaya-cream/20 border border-kimaya-cream-dark/30 rounded-xl px-4 py-3 text-sm outline-none focus:border-kimaya-olive" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-kimaya-brown mb-2">Alasan</label>
                  <textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} rows={4}
                    placeholder="Contoh: Sakit demam, Keperluan keluarga mendadak, dll."
                    className="w-full bg-kimaya-cream/20 border border-kimaya-cream-dark/30 rounded-xl px-4 py-3 text-sm outline-none focus:border-kimaya-olive resize-none placeholder:text-kimaya-brown-light/20" />
                </div>

                <div className="pt-2">
                  <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={submitting}
                    className="w-full py-4 rounded-2xl bg-kimaya-olive text-white font-bold text-sm hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    Kirim Pengajuan
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

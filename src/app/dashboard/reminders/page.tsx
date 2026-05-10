"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Plus, Pencil, Trash2, Pause, Play, X as XIcon, Loader2, Check, MessageCircle,
  Send, History, AlertCircle, CalendarDays, Users as UsersIcon, BarChart3,
  Clock, ChevronDown, Sparkles, Eye, Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

interface Reminder {
  id: string; title: string; messageTemplate: string;
  target: string; targetRole: string;
  schedule: string; scheduleType: string; scheduledTime: string | null;
  channel: string; status: string;
  lastSent: string; lastSentRaw: string | null;
  totalSent: number; totalResponded: number; responseRate: number;
}
interface LogEntry { id: string; userName: string; phone: string; status: string; channel: string; sentAt: string; error: string | null; }
interface LogStats { total: number; sent: number; delivered: number; read: number; failed: number; }

const PLACEHOLDERS = [
  { var: "{nama}",       desc: "Nama lengkap karyawan" },
  { var: "{tanggal}",    desc: "Tanggal hari ini (lengkap)" },
  { var: "{skor}",       desc: "Skor performa terakhir" },
  { var: "{lokasi}",     desc: "Lokasi cabang" },
  { var: "{shift}",      desc: "Nama shift kerja" },
  { var: "{role}",       desc: "Jabatan / role" },
  { var: "{departemen}", desc: "Departemen" },
  { var: "{telepon}",    desc: "Nomor telepon" },
];

const SAMPLE_VARS: Record<string, string> = {
  "{nama}": "Ahmad Fadhilah",
  "{tanggal}": new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  "{skor}": "85",
  "{lokasi}": "Cabang Sudirman",
  "{shift}": "Shift Pagi",
  "{role}": "Therapist",
  "{departemen}": "Operasional",
  "{telepon}": "081234567890",
};

const targetRoles = [
  { value: "", label: "Semua Therapist" },
  { value: "THERAPIST", label: "Therapist saja" },
  { value: "CS", label: "Customer Service" },
];

const scheduleOptions = [
  { value: "DAILY", label: "Setiap Hari" },
  { value: "WEEKLY", label: "Setiap Minggu" },
  { value: "IMMEDIATE", label: "Segera (manual)" },
];

const logStatusBadge: Record<string, { label: string; cls: string }> = {
  SENT: { label: "Terkirim", cls: "bg-blue-50 text-blue-600" },
  DELIVERED: { label: "Diterima", cls: "bg-emerald-50 text-emerald-600" },
  READ: { label: "Dibaca", cls: "bg-kimaya-olive/10 text-kimaya-olive" },
  FAILED: { label: "Gagal", cls: "bg-red-50 text-red-500" },
};

function renderPreview(template: string): string {
  let out = template;
  for (const [k, v] of Object.entries(SAMPLE_VARS)) {
    out = out.replaceAll(k, v);
  }
  return out;
}

export default function RemindersPage() {
  const { isTherapist, loading: authLoading } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  // Log viewer
  const [logReminderId, setLogReminderId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [logLoading, setLogLoading] = useState(false);

  // Form
  const [formTitle, setFormTitle] = useState("");
  const [formMsg, setFormMsg] = useState("");
  const [formSchedule, setFormSchedule] = useState("DAILY");
  const [formTime, setFormTime] = useState("08:00");
  const [formTarget, setFormTarget] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const fetchData = useCallback(() => {
    fetch("/api/reminders").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setReminders(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (isTherapist) {
      // Therapists shouldn't see this page — sidebar should hide it, but guard anyway.
      window.location.href = "/dashboard/reminders/my";
      return;
    }
    fetchData();
  }, [fetchData, isTherapist, authLoading]);

  const openCreate = () => {
    setEditing(null);
    setFormTitle(""); setFormMsg(""); setFormSchedule("DAILY"); setFormTime("08:00"); setFormTarget("");
    setShowModal(true);
  };

  const openEdit = (r: Reminder) => {
    setEditing(r);
    setFormTitle(r.title);
    setFormMsg(r.messageTemplate);
    setFormSchedule(r.scheduleType || "DAILY");
    setFormTime(r.scheduledTime || "08:00");
    setFormTarget(r.targetRole || "");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formMsg.trim()) return;
    setSaving(true);
    const body = {
      title: formTitle.trim(),
      messageTemplate: formMsg,
      channel: "WHATSAPP",
      scheduleType: formSchedule,
      scheduledTime: formSchedule === "IMMEDIATE" ? null : formTime,
      targetRole: formTarget || null,
    };
    try {
      if (editing) {
        await fetch(`/api/reminders/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        showToast("✅ Reminder berhasil diupdate");
      } else {
        await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        showToast("✅ Reminder berhasil dibuat");
      }
    } catch {
      showToast("❌ Gagal menyimpan");
    }
    setSaving(false); setShowModal(false); fetchData();
  };

  const handleToggle = async (id: string, current: string) => {
    const newStatus = current === "active" ? "PAUSED" : "ACTIVE";
    await fetch(`/api/reminders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    showToast(newStatus === "ACTIVE" ? "✅ Reminder diaktifkan" : "⏸️ Reminder dijeda");
    fetchData();
  };

  const handleSendNow = async (id: string) => {
    setSending(id);
    try {
      const res = await fetch(`/api/reminders/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (res.ok) showToast(`✅ ${data.message}`);
      else showToast(`❌ ${data.error || "Gagal mengirim"}`);
    } catch {
      showToast("❌ Tidak dapat terhubung ke server");
    }
    setSending(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus reminder ini?")) return;
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    showToast("✅ Reminder berhasil dihapus");
    fetchData();
  };

  const openLogs = async (id: string) => {
    setLogReminderId(id);
    setLogLoading(true);
    try {
      const res = await fetch(`/api/reminders/${id}/logs`);
      const data = await res.json();
      setLogs(data.logs || []);
      setLogStats(data.stats || null);
    } catch {
      setLogs([]); setLogStats(null);
    }
    setLogLoading(false);
  };

  const insertVar = (v: string) => setFormMsg((prev) => prev + v);

  // Diagnostic state
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagData, setDiagData] = useState<{
    vapid: { configured: boolean; publicKeyPreview: string | null; privateKeyPresent: boolean };
    me: { userId: string; role: string; subscriptions: number; subscribed: boolean };
    therapists: { total: number; subscribed: number; list: { id: string; name: string; subscriptions: number; subscribed: boolean }[] };
  } | null>(null);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [testPushResult, setTestPushResult] = useState<string>("");

  const openDiagnose = async () => {
    setDiagOpen(true);
    setDiagLoading(true);
    setTestPushResult("");
    try {
      const res = await fetch("/api/push/diagnose");
      const json = await res.json();
      if (res.ok) setDiagData(json);
    } catch { /* ignore */ }
    setDiagLoading(false);
  };

  const runTestPush = async (userId?: string) => {
    setTestPushLoading(true);
    setTestPushResult("");
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userId ? { userId } : {}),
      });
      const json = await res.json();
      setTestPushResult(json.summary || json.error || "Tidak ada respons");
    } catch (err) {
      setTestPushResult(`❌ ${err instanceof Error ? err.message : "Gagal connect"}`);
    }
    setTestPushLoading(false);
  };

  if (loading || authLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>;
  }

  const active = reminders.filter((r) => r.status === "active").length;
  const totalSentAll = reminders.reduce((sum, r) => sum + r.totalSent, 0);
  const totalRespondedAll = reminders.reduce((sum, r) => sum + r.totalResponded, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-[1400px] mx-auto pb-12">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[60] bg-kimaya-olive text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm">
            <Check size={16} /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown">Reminder WhatsApp</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">
            Kelola pesan otomatis dan pantau tanggapan tim Anda
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openDiagnose}
            className="px-4 py-2.5 rounded-xl border border-kimaya-cream-dark/40 bg-white text-sm font-medium text-kimaya-brown hover:bg-kimaya-cream/30 flex items-center gap-2 transition-all"
            title="Cek status push notification">
            <Stethoscope size={16} /> Diagnose Push
          </button>
          <Link href="/dashboard/reminders/calendar"
            className="px-4 py-2.5 rounded-xl border border-kimaya-cream-dark/40 bg-white text-sm font-medium text-kimaya-brown hover:bg-kimaya-cream/30 flex items-center gap-2 transition-all">
            <CalendarDays size={16} /> Tracking Kalender
          </Link>
          <motion.button whileTap={{ scale: 0.97 }} onClick={openCreate}
            className="px-5 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center gap-2">
            <Plus size={16} /> Buat Reminder
          </motion.button>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Reminder Aktif" value={active} sub={`dari ${reminders.length} total`} icon={Bell} tone="olive" />
        <StatCard label="Total Terkirim" value={totalSentAll} sub="seluruh reminder" icon={Send} tone="blue" />
        <StatCard label="Total Tanggapan" value={totalRespondedAll} sub="dari karyawan" icon={MessageCircle} tone="emerald" />
        <StatCard label="Response Rate" value={`${totalSentAll > 0 ? Math.round((totalRespondedAll / totalSentAll) * 100) : 0}%`} sub="rata-rata" icon={BarChart3} tone="purple" />
      </div>

      {/* Reminder grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reminders.map((r) => (
          <ReminderCard
            key={r.id} r={r}
            sending={sending === r.id}
            onSendNow={handleSendNow}
            onToggle={handleToggle}
            onEdit={openEdit}
            onDelete={handleDelete}
            onLogs={openLogs}
          />
        ))}
        {reminders.length === 0 && (
          <div className="sm:col-span-2 xl:col-span-3 text-center py-16 text-kimaya-brown-light/40 bg-white rounded-2xl border-2 border-dashed border-kimaya-cream-dark/40">
            <Bell size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Belum ada reminder. Buat yang pertama!</p>
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal — split layout ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 28 }} onClick={(e) => e.stopPropagation()}
              className="bg-white w-full sm:rounded-3xl sm:max-w-5xl sm:max-h-[92vh] max-h-[95vh] overflow-hidden flex flex-col shadow-2xl rounded-t-3xl">

              {/* Header */}
              <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-kimaya-cream-dark/30 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-kimaya-olive/10 flex items-center justify-center">
                    <Bell size={18} className="text-kimaya-olive" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-serif text-kimaya-brown">
                      {editing ? "Edit Reminder" : "Buat Reminder Baru"}
                    </h2>
                    <p className="text-[11px] text-kimaya-brown-light/50">
                      Pesan akan dikirim via WhatsApp & Push Notification
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40">
                  <XIcon size={18} />
                </button>
              </div>

              {/* Body — split */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid lg:grid-cols-[1.2fr_1fr] gap-0 lg:gap-0 lg:divide-x divide-kimaya-cream-dark/30">

                  {/* LEFT: Form */}
                  <div className="p-5 sm:p-7 space-y-5">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-kimaya-brown-light mb-1.5">Judul Reminder</label>
                      <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Contoh: Reminder cuci gudang"
                        className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light/50 text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 focus:border-kimaya-olive transition" />
                      <p className="text-[10px] text-kimaya-brown-light/50 mt-1">Hanya untuk identifikasi internal — tidak masuk ke pesan</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-kimaya-brown-light mb-1.5">Template Pesan</label>
                      <textarea value={formMsg} onChange={(e) => setFormMsg(e.target.value)} rows={6}
                        placeholder="Hai {nama}, hari ini ({tanggal}) jangan lupa cek inventaris di {lokasi}. Selamat bekerja!"
                        className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light/50 text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 focus:border-kimaya-olive transition resize-none font-mono" />
                      <p className="text-[10px] text-kimaya-brown-light/50 mt-2 flex items-center gap-1">
                        <Sparkles size={10} className="text-kimaya-gold" />
                        Klik tag di bawah untuk sisipkan variabel:
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {PLACEHOLDERS.map((p) => (
                          <button key={p.var} type="button" onClick={() => insertVar(p.var)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-kimaya-olive/10 text-kimaya-olive hover:bg-kimaya-olive/20 hover:scale-105 transition-all"
                            title={p.desc}>
                            {p.var}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-kimaya-brown-light mb-1.5">Target</label>
                        <div className="relative">
                          <select value={formTarget} onChange={(e) => setFormTarget(e.target.value)}
                            className="w-full pl-3 pr-9 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light/50 text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 appearance-none">
                            {targetRoles.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-kimaya-brown-light/40 pointer-events-none" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-kimaya-brown-light mb-1.5">Jadwal</label>
                        <div className="relative">
                          <select value={formSchedule} onChange={(e) => setFormSchedule(e.target.value)}
                            className="w-full pl-3 pr-9 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light/50 text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 appearance-none">
                            {scheduleOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-kimaya-brown-light/40 pointer-events-none" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-kimaya-brown-light mb-1.5">Waktu</label>
                        <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)}
                          disabled={formSchedule === "IMMEDIATE"}
                          className="w-full px-3 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light/50 text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 disabled:opacity-50" />
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Live preview */}
                  <div className="bg-kimaya-cream/30 p-5 sm:p-7 lg:min-h-full space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-kimaya-brown-light mb-1.5 flex items-center gap-1.5">
                        <Eye size={12} /> Preview Pesan
                      </p>
                      <p className="text-[10px] text-kimaya-brown-light/50">
                        Ini contoh tampilan pesan yang akan diterima karyawan (data dummy untuk preview).
                      </p>
                    </div>

                    {/* WhatsApp-style bubble */}
                    <div className="bg-[#dcf8c6] rounded-2xl rounded-tr-sm p-3 sm:p-4 ml-6 shadow-sm relative">
                      <div className="absolute -right-1.5 top-0 w-3 h-3 bg-[#dcf8c6] transform rotate-45 rounded-sm" />
                      <p className="text-[11px] font-semibold text-emerald-700 mb-1">{formTitle || "Judul Reminder"}</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                        {formMsg ? renderPreview(formMsg) : <span className="text-gray-400 italic">Template pesan akan tampil di sini…</span>}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-2 text-right">
                        {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} ✓✓
                      </p>
                    </div>

                    {/* Push notification preview */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-kimaya-brown-light/60 mb-1.5">Push Notification</p>
                      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-3 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-kimaya-olive flex items-center justify-center flex-shrink-0">
                          <Bell size={16} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{formTitle || "Judul Reminder"}</p>
                          <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">
                            {formMsg ? renderPreview(formMsg) : "Template pesan…"}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">Kimaya Management · sekarang</p>
                        </div>
                      </div>
                    </div>

                    {/* Variables resolved */}
                    {formMsg && (
                      <div className="text-[10px] text-kimaya-brown-light/60 space-y-0.5">
                        <p className="font-semibold uppercase tracking-wider mb-1">Variabel terdeteksi:</p>
                        {PLACEHOLDERS.filter((p) => formMsg.includes(p.var)).map((p) => (
                          <div key={p.var} className="flex justify-between gap-2">
                            <code className="text-kimaya-olive">{p.var}</code>
                            <span className="text-right truncate">{p.desc}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 sm:px-7 py-4 border-t border-kimaya-cream-dark/30 flex items-center justify-end gap-3 bg-kimaya-cream/20 flex-shrink-0">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-kimaya-brown-light hover:bg-kimaya-cream/50 transition">
                  Batal
                </button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={handleSubmit}
                  disabled={saving || !formTitle.trim() || !formMsg.trim()}
                  className="px-6 py-2.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition shadow-lg shadow-kimaya-olive/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {editing ? "Simpan Perubahan" : "Buat Reminder"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log Viewer Modal */}
      <AnimatePresence>
        {logReminderId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLogReminderId(null)}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }} onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-serif text-kimaya-brown">Riwayat Pengiriman</h2>
                <button onClick={() => setLogReminderId(null)} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40">
                  <XIcon size={18} />
                </button>
              </div>

              {logStats && (
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Terkirim", value: logStats.sent, cls: "text-blue-600 bg-blue-50" },
                    { label: "Diterima", value: logStats.delivered, cls: "text-emerald-600 bg-emerald-50" },
                    { label: "Dibaca", value: logStats.read, cls: "text-kimaya-olive bg-kimaya-olive/10" },
                    { label: "Gagal", value: logStats.failed, cls: "text-red-500 bg-red-50" },
                  ].map((s) => (
                    <div key={s.label} className={cn("rounded-xl p-3 text-center", s.cls)}>
                      <p className="text-lg font-bold">{s.value}</p>
                      <p className="text-[10px] font-medium opacity-70">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {logLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-kimaya-olive" /></div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12 text-kimaya-brown-light/40">
                    <History size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Belum ada riwayat pengiriman</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-kimaya-cream-dark/30 bg-kimaya-cream/20">
                        <th className="px-3 py-2.5 text-xs font-semibold text-kimaya-brown-light/50 text-left">Karyawan</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-kimaya-brown-light/50 text-left">Telepon</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-kimaya-brown-light/50 text-left">Status</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-kimaya-brown-light/50 text-left">Waktu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => {
                        const badge = logStatusBadge[log.status] || logStatusBadge.SENT;
                        return (
                          <tr key={log.id} className="border-b border-kimaya-cream-dark/10 last:border-0">
                            <td className="px-3 py-2.5 text-sm text-kimaya-brown">{log.userName}</td>
                            <td className="px-3 py-2.5 text-xs text-kimaya-brown-light/50 font-mono">{log.phone}</td>
                            <td className="px-3 py-2.5">
                              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", badge.cls)}>{badge.label}</span>
                              {log.error && <p className="text-[10px] text-red-400 mt-0.5 truncate max-w-[200px]" title={log.error}>{log.error}</p>}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-kimaya-brown-light/40">{log.sentAt}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Diagnose Push Modal ── */}
      <AnimatePresence>
        {diagOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setDiagOpen(false)}
            className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="px-5 sm:px-6 py-4 border-b border-kimaya-cream-dark/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Stethoscope size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif text-kimaya-brown">Diagnostik Push Notification</h3>
                    <p className="text-[11px] text-kimaya-brown-light/50">State pipeline Web Push & subscription tiap therapist</p>
                  </div>
                </div>
                <button onClick={() => setDiagOpen(false)} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40">
                  <XIcon size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {diagLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-kimaya-olive" /></div>
                ) : !diagData ? (
                  <p className="text-center text-sm text-red-500 py-8">Gagal memuat diagnostik</p>
                ) : (
                  <>
                    {/* VAPID status */}
                    <div className={cn("rounded-xl p-4 border-2",
                      diagData.vapid.configured ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200")}>
                      <div className="flex items-start gap-3">
                        {diagData.vapid.configured
                          ? <Check size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                          : <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />}
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-kimaya-brown">
                            {diagData.vapid.configured ? "VAPID Server Configured" : "VAPID Server NOT Configured"}
                          </p>
                          <p className="text-[11px] text-kimaya-brown-light/60 mt-0.5">
                            Public: <code className="bg-white px-1 rounded">{diagData.vapid.publicKeyPreview || "—"}</code>
                            {" · "}
                            Private: <code className="bg-white px-1 rounded">{diagData.vapid.privateKeyPresent ? "set" : "MISSING"}</code>
                          </p>
                          {!diagData.vapid.configured && (
                            <p className="text-[11px] text-red-600 mt-2">
                              Tambahkan <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> & <code>VAPID_PRIVATE_KEY</code> ke <code>docker-compose.yml</code> &rarr; <code>siyap-app.environment</code>, lalu rebuild.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* My subscription status */}
                    <div className={cn("rounded-xl p-4 border",
                      diagData.me.subscribed ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200")}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-kimaya-brown">
                            Anda: {diagData.me.subscribed ? `${diagData.me.subscriptions} subscription aktif` : "Belum subscribe"}
                          </p>
                          <p className="text-[11px] text-kimaya-brown-light/60 mt-0.5">
                            Klik tombol di bawah untuk kirim test push ke device Anda.
                          </p>
                        </div>
                        <button onClick={() => runTestPush()} disabled={testPushLoading || !diagData.vapid.configured}
                          className="px-3 py-1.5 rounded-lg bg-kimaya-olive text-white text-xs font-medium hover:bg-kimaya-olive-dark disabled:opacity-50 flex items-center gap-1.5">
                          {testPushLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          Test
                        </button>
                      </div>
                      {testPushResult && (
                        <p className="text-[11px] mt-2 px-3 py-2 bg-white rounded-lg text-kimaya-brown">{testPushResult}</p>
                      )}
                    </div>

                    {/* Therapist subscription list */}
                    <div className="rounded-xl border border-kimaya-cream-dark/30 overflow-hidden">
                      <div className="px-4 py-2.5 bg-kimaya-cream/40 border-b border-kimaya-cream-dark/30">
                        <p className="text-xs font-semibold text-kimaya-brown">
                          Therapist subscription: {diagData.therapists.subscribed}/{diagData.therapists.total} sudah aktifkan
                        </p>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {diagData.therapists.list.length === 0 ? (
                          <p className="text-center text-sm text-kimaya-brown-light/50 py-6">Belum ada therapist</p>
                        ) : (
                          diagData.therapists.list.map((t) => (
                            <div key={t.id} className="px-4 py-2.5 border-b border-kimaya-cream-dark/20 last:border-0 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={cn("w-2 h-2 rounded-full flex-shrink-0",
                                  t.subscribed ? "bg-emerald-500" : "bg-gray-300")} />
                                <span className="text-sm text-kimaya-brown truncate">{t.name}</span>
                                <span className="text-[10px] text-kimaya-brown-light/50">
                                  {t.subscribed ? `${t.subscriptions} sub` : "no sub"}
                                </span>
                              </div>
                              {t.subscribed && diagData.vapid.configured && (
                                <button onClick={() => runTestPush(t.id)} disabled={testPushLoading}
                                  className="text-[10px] px-2 py-1 rounded-md bg-kimaya-olive/10 text-kimaya-olive hover:bg-kimaya-olive/20 disabled:opacity-50 flex items-center gap-1">
                                  <Send size={10} /> Test
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl bg-kimaya-cream/30 p-3 text-[11px] text-kimaya-brown-light/70 leading-relaxed">
                      <p className="font-semibold mb-1">💡 Cara kerja Web Push:</p>
                      <p>Browser therapist subscribe → simpan endpoint ke DB. Server kita kirim payload ber-VAPID-signature ke push provider (FCM/Apple). Provider deliver ke device → Service Worker tampilkan notifikasi.</p>
                      <p className="mt-1">Kalau VAPID belum configured ATAU therapist belum subscribe, push tidak akan sampai meskipun WhatsApp sukses.</p>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Sub-components ──

interface ReminderCardProps {
  r: Reminder; sending: boolean;
  onSendNow: (id: string) => void;
  onToggle: (id: string, status: string) => void;
  onEdit: (r: Reminder) => void;
  onDelete: (id: string) => void;
  onLogs: (id: string) => void;
}
function ReminderCard({ r, sending, onSendNow, onToggle, onEdit, onDelete, onLogs }: ReminderCardProps) {
  const isActive = r.status === "active";
  const respondPct = r.responseRate;
  return (
    <motion.div whileHover={{ y: -2 }} layout
      className={cn("bg-white rounded-2xl border p-4 hover:shadow-md transition-all flex flex-col",
        isActive ? "border-kimaya-cream-dark/40" : "border-kimaya-cream-dark/30 opacity-75")}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            isActive ? "bg-kimaya-olive/10" : "bg-gray-100")}>
            <MessageCircle size={18} className={isActive ? "text-kimaya-olive" : "text-gray-400"} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-kimaya-brown truncate">{r.title}</h3>
            <p className="text-[11px] text-kimaya-brown-light/50 mt-0.5 line-clamp-2">{r.messageTemplate}</p>
          </div>
        </div>
        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0",
          isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400")}>
          {isActive ? "Aktif" : "Dijeda"}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
        <span className="px-2 py-0.5 rounded-md bg-kimaya-cream text-kimaya-brown-light/70 inline-flex items-center gap-1">
          <Clock size={10} /> {r.schedule}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 inline-flex items-center gap-1">
          <UsersIcon size={10} /> {r.target}
        </span>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 text-[11px] text-kimaya-brown-light/60 mb-3">
        <div className="flex items-center gap-1">
          <Send size={11} /> {r.totalSent} terkirim
        </div>
        <div className="flex items-center gap-1">
          <MessageCircle size={11} /> {r.totalResponded} balasan
        </div>
        {r.totalSent > 0 && (
          <div className="ml-auto">
            <span className={cn("font-semibold",
              respondPct >= 75 ? "text-emerald-600" :
              respondPct >= 40 ? "text-amber-600" : "text-red-500"
            )}>{respondPct}%</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {r.totalSent > 0 && (
        <div className="w-full h-1 rounded-full bg-kimaya-cream overflow-hidden mb-3">
          <div className={cn("h-full rounded-full transition-all",
            respondPct >= 75 ? "bg-emerald-500" :
            respondPct >= 40 ? "bg-amber-500" : "bg-red-400")} style={{ width: `${respondPct}%` }} />
        </div>
      )}

      <p className="text-[10px] text-kimaya-brown-light/40 mb-3">Terakhir dikirim: {r.lastSent}</p>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-auto pt-3 border-t border-kimaya-cream-dark/30">
        <button onClick={() => onSendNow(r.id)} disabled={sending}
          className="flex-1 px-3 py-2 rounded-lg bg-kimaya-olive text-white text-xs font-medium hover:bg-kimaya-olive-dark transition disabled:opacity-50 flex items-center justify-center gap-1.5">
          {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Kirim
        </button>
        <Link href={`/dashboard/reminders/${r.id}/responses`}
          className="px-3 py-2 rounded-lg bg-kimaya-cream/50 text-kimaya-brown text-xs font-medium hover:bg-kimaya-cream transition flex items-center gap-1"
          title="Lihat tanggapan">
          <Eye size={12} /> Tanggapan
        </Link>
        <button onClick={() => onLogs(r.id)} title="Riwayat pengiriman"
          className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 hover:text-kimaya-brown transition">
          <History size={14} />
        </button>
        <button onClick={() => onToggle(r.id, r.status)} title={isActive ? "Jeda" : "Aktifkan"}
          className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 hover:text-kimaya-olive transition">
          {isActive ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button onClick={() => onEdit(r)} title="Edit"
          className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 hover:text-kimaya-olive transition">
          <Pencil size={14} />
        </button>
        <button onClick={() => onDelete(r.id)} title="Hapus"
          className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-kimaya-brown-light/40 hover:text-red-500 transition">
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  );
}

interface StatCardProps {
  label: string; value: number | string; sub: string;
  icon: typeof Bell; tone: "olive" | "blue" | "emerald" | "purple";
}
function StatCard({ label, value, sub, icon: Icon, tone }: StatCardProps) {
  const toneCls = {
    olive: "bg-kimaya-olive/10 text-kimaya-olive",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600",
  }[tone];
  return (
    <div className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-kimaya-brown-light/50 font-semibold">{label}</p>
          <p className="text-2xl font-bold text-kimaya-brown mt-1">{value}</p>
          <p className="text-[10px] text-kimaya-brown-light/40 mt-0.5">{sub}</p>
        </div>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", toneCls)}>
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}

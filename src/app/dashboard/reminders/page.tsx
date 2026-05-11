"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Plus, Pencil, Trash2, Pause, Play, X as XIcon, Loader2, Check, MessageCircle,
  Send, History, AlertCircle, CalendarDays, Users as UsersIcon, BarChart3,
  Clock, Sparkles, Eye, Stethoscope, Search, MapPin, Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

interface ReminderImage { id: string; photoUrl: string; caption: string | null; order: number; }
interface Reminder {
  id: string; title: string; messageTemplate: string;
  images: ReminderImage[];
  targetMode: "ALL_THERAPISTS" | "SELECTED";
  recipientIds: string[];
  recipients: { id: string; name: string; location: string | null }[];
  locationScope: { id: string; name: string } | null;
  target: string;
  scheduleType: "IMMEDIATE" | "ONE_TIME" | "DAILY" | "WEEKLY";
  scheduledTime: string | null;
  scheduledDay: number | null;
  scheduledAt: string | null;
  schedule: string;
  status: string;
  lastSent: string;
  lastSentRaw: string | null;
  totalSent: number; totalResponded: number; responseRate: number;
  createdByName: string | null;
}
interface Therapist {
  id: string; name: string; phone: string | null; avatarUrl: string | null;
  location: string | null; locationId: string | null;
  pushReady: boolean;
}
interface LogEntry { id: string; userName: string; phone: string; status: string; channel: string; sentAt: string; error: string | null; }
interface LogStats { total: number; sent: number; delivered: number; read: number; failed: number; }

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

const INSERT_BUTTONS = [
  { token: "{nama}", label: "Nama Karyawan" },
  { token: "{tanggal}", label: "Tanggal Hari Ini" },
  { token: "{lokasi}", label: "Nama Cabang" },
  { token: "{shift}", label: "Shift Kerja" },
  { token: "{skor}", label: "Skor Performa" },
  { token: "{role}", label: "Jabatan" },
  { token: "{departemen}", label: "Departemen" },
  { token: "{telepon}", label: "Nomor HP" },
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

const DAY_OPTIONS = [
  { value: 1, label: "Senin" }, { value: 2, label: "Selasa" }, { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" }, { value: 5, label: "Jumat" }, { value: 6, label: "Sabtu" },
  { value: 0, label: "Minggu" },
];

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 1_500_000;

const logStatusBadge: Record<string, { label: string; cls: string }> = {
  SENT: { label: "Terkirim", cls: "bg-blue-50 text-blue-600" },
  DELIVERED: { label: "Diterima", cls: "bg-emerald-50 text-emerald-600" },
  READ: { label: "Dibaca", cls: "bg-kimaya-olive/10 text-kimaya-olive" },
  FAILED: { label: "Gagal", cls: "bg-red-50 text-red-500" },
};

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function renderPreview(template: string): string {
  let out = template;
  for (const [k, v] of Object.entries(SAMPLE_VARS)) out = out.replaceAll(k, v);
  return out;
}

/** Compress to JPEG max 1024px @ 0.8. Returns dataURL. */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("File bukan gambar"));
      img.onload = () => {
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas tidak tersedia"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function toIsoLocal(dt: string): string | null {
  // dt = "2026-05-12T08:30" (local). Treat as Asia/Jakarta wall clock and
  // convert to a UTC ISO string for storage.
  if (!dt) return null;
  // Trust the browser's local TZ — user is expected to be in WIB; we store
  // the absolute instant the user picked.
  return new Date(dt).toISOString();
}

// ──────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────

export default function RemindersPage() {
  const { isTherapist, isDeveloper, loading: authLoading } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const [logReminderId, setLogReminderId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [logLoading, setLogLoading] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formMsg, setFormMsg] = useState("");
  const [formSchedule, setFormSchedule] = useState<Reminder["scheduleType"]>("DAILY");
  const [formTime, setFormTime] = useState("08:00");
  const [formDay, setFormDay] = useState(1);
  const [formOneTimeAt, setFormOneTimeAt] = useState("");
  const [formTargetMode, setFormTargetMode] = useState<"ALL_THERAPISTS" | "SELECTED">("ALL_THERAPISTS");
  const [formRecipientIds, setFormRecipientIds] = useState<string[]>([]);
  const [formImages, setFormImages] = useState<{ key: string; photoUrl: string; caption: string }[]>([]);
  const [therapistSearch, setTherapistSearch] = useState("");
  const msgRef = useRef<HTMLTextAreaElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  // ── Data ─────────────────────────────────────────────────────────────
  const fetchReminders = useCallback(() => {
    fetch("/api/reminders").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setReminders(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  const fetchTherapists = useCallback(() => {
    fetch("/api/reminders/therapists").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setTherapists(d);
    }).catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (isTherapist) { window.location.href = "/dashboard/reminders/my"; return; }
    fetchReminders();
    fetchTherapists();
  }, [fetchReminders, fetchTherapists, isTherapist, authLoading]);

  // ── Modal ────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormTitle(""); setFormMsg(""); setFormSchedule("DAILY");
    setFormTime("08:00"); setFormDay(1); setFormOneTimeAt("");
    setFormTargetMode("ALL_THERAPISTS"); setFormRecipientIds([]);
    setFormImages([]); setTherapistSearch("");
  };

  const openCreate = () => { setEditing(null); resetForm(); setShowModal(true); };

  const openEdit = (r: Reminder) => {
    setEditing(r);
    setFormTitle(r.title);
    setFormMsg(r.messageTemplate);
    setFormSchedule(r.scheduleType);
    setFormTime(r.scheduledTime || "08:00");
    setFormDay(r.scheduledDay ?? 1);
    setFormOneTimeAt(r.scheduledAt ? r.scheduledAt.slice(0, 16) : "");
    setFormTargetMode(r.targetMode);
    setFormRecipientIds(r.recipientIds);
    setFormImages(r.images.map((img) => ({ key: img.id, photoUrl: img.photoUrl, caption: img.caption || "" })));
    setTherapistSearch("");
    setShowModal(true);
  };

  const insertToken = (token: string) => {
    const ta = msgRef.current;
    if (!ta) { setFormMsg((m) => m + token); return; }
    const start = ta.selectionStart ?? formMsg.length;
    const end = ta.selectionEnd ?? formMsg.length;
    const next = formMsg.slice(0, start) + token + formMsg.slice(end);
    setFormMsg(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (formImages.length + files.length > MAX_IMAGES) {
      showToast(`Maksimal ${MAX_IMAGES} foto per pengingat`);
      return;
    }
    for (const file of files) {
      try {
        const url = await compressImage(file);
        if (url.length > MAX_IMAGE_BYTES) {
          showToast(`"${file.name}" terlalu besar setelah dikompres. Coba foto lain.`);
          continue;
        }
        setFormImages((prev) => [...prev, { key: Math.random().toString(36).slice(2), photoUrl: url, caption: "" }]);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Gagal memproses foto");
      }
    }
    if (e.target) e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formMsg.trim()) {
      showToast("Judul dan isi pesan wajib diisi");
      return;
    }
    if (formTargetMode === "SELECTED" && formRecipientIds.length === 0) {
      showToast("Pilih minimal satu therapist tujuan");
      return;
    }
    if (formSchedule === "ONE_TIME" && !formOneTimeAt) {
      showToast("Pilih tanggal & jam pengiriman");
      return;
    }
    setSaving(true);

    const body: Record<string, unknown> = {
      title: formTitle.trim(),
      messageTemplate: formMsg,
      channel: "WHATSAPP",
      scheduleType: formSchedule,
      targetMode: formTargetMode,
      recipientIds: formTargetMode === "SELECTED" ? formRecipientIds : [],
      images: formImages.map((i) => ({ photoUrl: i.photoUrl, caption: i.caption.trim() || null })),
    };
    if (formSchedule === "DAILY") body.scheduledTime = formTime;
    if (formSchedule === "WEEKLY") { body.scheduledTime = formTime; body.scheduledDay = formDay; }
    if (formSchedule === "ONE_TIME") body.scheduledAt = toIsoLocal(formOneTimeAt);

    try {
      if (editing) {
        const res = await fetch(`/api/reminders/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (res.ok) showToast("Pengingat berhasil diperbarui");
        else showToast(data.error || "Gagal menyimpan");
      } else {
        const res = await fetch("/api/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (res.ok) {
          // If user picked IMMEDIATE schedule, auto-send right away.
          if (formSchedule === "IMMEDIATE" && data.id) {
            const sendRes = await fetch(`/api/reminders/${data.id}/send`, { method: "POST" });
            const sendData = await sendRes.json();
            showToast(sendRes.ok ? sendData.message : (sendData.error || "Pengingat dibuat, tapi gagal kirim"));
          } else {
            showToast("Pengingat berhasil dibuat");
          }
        } else {
          showToast(data.error || "Gagal menyimpan");
        }
      }
    } catch {
      showToast("Tidak dapat terhubung ke server");
    }
    setSaving(false); setShowModal(false); fetchReminders();
  };

  const handleToggle = async (id: string, current: string) => {
    const newStatus = current === "active" ? "PAUSED" : "ACTIVE";
    await fetch(`/api/reminders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    showToast(newStatus === "ACTIVE" ? "Pengingat dinyalakan" : "Pengingat dimatikan sementara");
    fetchReminders();
  };

  const handleSendNow = async (id: string) => {
    setSending(id);
    try {
      const res = await fetch(`/api/reminders/${id}/send`, { method: "POST" });
      const data = await res.json();
      showToast(res.ok ? data.message : (data.error || "Gagal mengirim"));
    } catch {
      showToast("Tidak dapat terhubung ke server");
    }
    setSending(null); fetchReminders();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus pengingat ini? Tindakan ini tidak bisa dibatalkan.")) return;
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    showToast("Pengingat berhasil dihapus");
    fetchReminders();
  };

  const openLogs = async (id: string) => {
    setLogReminderId(id);
    setLogLoading(true);
    try {
      const res = await fetch(`/api/reminders/${id}/logs`);
      const data = await res.json();
      setLogs(data.logs || []); setLogStats(data.stats || null);
    } catch { setLogs([]); setLogStats(null); }
    setLogLoading(false);
  };

  // ── Diagnose (DEVELOPER only) ────────────────────────────────────────
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagData, setDiagData] = useState<{
    vapid: { configured: boolean; publicKeyPreview: string | null; privateKeyPresent: boolean };
    me: { userId: string; role: string; subscriptions: number; subscribed: boolean };
    therapists: { total: number; subscribed: number; list: { id: string; name: string; subscriptions: number; subscribed: boolean }[] };
  } | null>(null);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [testPushResult, setTestPushResult] = useState("");

  const openDiagnose = async () => {
    setDiagOpen(true); setDiagLoading(true); setTestPushResult("");
    try {
      const res = await fetch("/api/push/diagnose");
      const json = await res.json();
      if (res.ok) setDiagData(json);
    } catch { /* ignore */ }
    setDiagLoading(false);
  };

  const runTestPush = async (userId?: string) => {
    setTestPushLoading(true); setTestPushResult("");
    try {
      const res = await fetch("/api/push/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userId ? { userId } : {}),
      });
      const json = await res.json();
      setTestPushResult(json.summary || json.error || "Tidak ada respons");
    } catch (err) {
      setTestPushResult(err instanceof Error ? err.message : "Gagal terhubung");
    }
    setTestPushLoading(false);
  };

  // ── Render ───────────────────────────────────────────────────────────
  if (loading || authLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>;
  }

  const active = reminders.filter((r) => r.status === "active").length;
  const totalSentAll = reminders.reduce((sum, r) => sum + r.totalSent, 0);
  const totalRespondedAll = reminders.reduce((sum, r) => sum + r.totalResponded, 0);

  const filteredTherapists = therapists.filter((t) => {
    if (!therapistSearch.trim()) return true;
    const q = therapistSearch.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.location || "").toLowerCase().includes(q);
  });
  // Group therapists by location for nicer UI
  const therapistsByLocation = filteredTherapists.reduce<Record<string, Therapist[]>>((acc, t) => {
    const k = t.location || "Tanpa cabang";
    (acc[k] ||= []).push(t);
    return acc;
  }, {});

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-[1400px] mx-auto pb-12">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[60] bg-kimaya-olive text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm max-w-md">
            <Check size={16} className="flex-shrink-0" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown">Pengingat Therapist</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">
            Buat dan jadwalkan pesan untuk therapist di cabang Anda
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDeveloper && (
            <button onClick={openDiagnose}
              className="px-4 py-2.5 rounded-xl border border-kimaya-cream-dark/40 bg-white text-sm font-medium text-kimaya-brown hover:bg-kimaya-cream/30 flex items-center gap-2 transition-all"
              title="Cek kesiapan notifikasi (khusus developer)">
              <Stethoscope size={16} /> Cek Notifikasi
            </button>
          )}
          <Link href="/dashboard/reminders/calendar"
            className="px-4 py-2.5 rounded-xl border border-kimaya-cream-dark/40 bg-white text-sm font-medium text-kimaya-brown hover:bg-kimaya-cream/30 flex items-center gap-2 transition-all">
            <CalendarDays size={16} /> Kalender
          </Link>
          <motion.button whileTap={{ scale: 0.97 }} onClick={openCreate}
            className="px-5 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center gap-2">
            <Plus size={16} /> Buat Pengingat
          </motion.button>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Pengingat Aktif" value={active} sub={`dari ${reminders.length} total`} icon={Bell} tone="olive" />
        <StatCard label="Total Dikirim" value={totalSentAll} sub="seluruh pengingat" icon={Send} tone="blue" />
        <StatCard label="Total Tanggapan" value={totalRespondedAll} sub="dari therapist" icon={MessageCircle} tone="emerald" />
        <StatCard label="Tingkat Balasan" value={`${totalSentAll > 0 ? Math.round((totalRespondedAll / totalSentAll) * 100) : 0}%`} sub="rata-rata" icon={BarChart3} tone="purple" />
      </div>

      {/* Grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reminders.map((r) => (
          <ReminderCard key={r.id} r={r}
            sending={sending === r.id}
            onSendNow={handleSendNow}
            onToggle={handleToggle}
            onEdit={openEdit}
            onDelete={handleDelete}
            onLogs={openLogs} />
        ))}
        {reminders.length === 0 && (
          <div className="sm:col-span-2 xl:col-span-3 text-center py-16 text-kimaya-brown-light/40 bg-white rounded-2xl border-2 border-dashed border-kimaya-cream-dark/40">
            <Bell size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Belum ada pengingat. Buat yang pertama!</p>
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 28 }} onClick={(e) => e.stopPropagation()}
              className="bg-white w-full sm:rounded-3xl sm:max-w-6xl sm:max-h-[94vh] max-h-[95vh] overflow-hidden flex flex-col shadow-2xl rounded-t-3xl">

              {/* Header */}
              <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-kimaya-cream-dark/30 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-kimaya-olive/10 flex items-center justify-center">
                    <Bell size={18} className="text-kimaya-olive" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-serif text-kimaya-brown">
                      {editing ? "Edit Pengingat" : "Buat Pengingat Baru"}
                    </h2>
                    <p className="text-[11px] text-kimaya-brown-light/50">
                      Pesan dikirim via WhatsApp + notifikasi HP
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40">
                  <XIcon size={18} />
                </button>
              </div>

              {/* Body — 3 columns */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid lg:grid-cols-[1fr_1fr_320px] gap-0 lg:divide-x divide-kimaya-cream-dark/30">

                  {/* COL 1: Pesan + lampiran */}
                  <div className="p-5 sm:p-6 space-y-5">
                    <SectionTitle index={1} title="Isi Pesan" />

                    <div>
                      <label className="block text-xs font-semibold text-kimaya-brown-light mb-1.5">Judul</label>
                      <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Misal: Pengingat Cek Inventaris"
                        className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light/50 text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 focus:border-kimaya-olive transition" />
                      <p className="text-[10px] text-kimaya-brown-light/50 mt-1">Hanya muncul di sini — tidak masuk ke pesan</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-kimaya-brown-light mb-1.5">Isi Pesan</label>
                      <textarea ref={msgRef} value={formMsg} onChange={(e) => setFormMsg(e.target.value)} rows={6}
                        placeholder={"Contoh: Hai {nama}, hari ini ({tanggal}) jangan lupa cek inventaris di {lokasi}. Selamat bekerja!"}
                        className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light/50 text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 focus:border-kimaya-olive transition resize-none" />
                      <p className="text-[10px] text-kimaya-brown-light/50 mt-2 flex items-center gap-1">
                        <Sparkles size={10} className="text-kimaya-gold" />
                        Klik tombol di bawah untuk sisipkan data otomatis:
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {INSERT_BUTTONS.map((b) => (
                          <button key={b.token} type="button" onClick={() => insertToken(b.token)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-kimaya-olive/10 text-kimaya-olive hover:bg-kimaya-olive/20 transition-all">
                            + {b.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-kimaya-brown-light mb-1.5 flex items-center justify-between">
                        <span>Lampiran Foto (opsional)</span>
                        <span className="text-[10px] text-kimaya-brown-light/40">{formImages.length} / {MAX_IMAGES}</span>
                      </label>
                      <p className="text-[10px] text-kimaya-brown-light/50 mb-2">
                        Foto hanya muncul saat therapist buka link pengingat (tidak dikirim ke WhatsApp).
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {formImages.map((img, idx) => (
                          <div key={img.key} className="relative aspect-square rounded-xl overflow-hidden bg-kimaya-cream-dark/20 ring-1 ring-kimaya-cream-dark/40 group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.photoUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                            <button type="button" onClick={() => setFormImages((p) => p.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                              <XIcon size={12} />
                            </button>
                          </div>
                        ))}
                        {formImages.length < MAX_IMAGES && (
                          <button type="button" onClick={() => imgInputRef.current?.click()}
                            className="aspect-square rounded-xl border-2 border-dashed border-kimaya-cream-dark/50 flex flex-col items-center justify-center text-kimaya-brown-light/50 hover:border-kimaya-olive hover:text-kimaya-olive transition">
                            <ImageIcon size={20} />
                            <span className="text-[10px] mt-1">Tambah</span>
                          </button>
                        )}
                      </div>
                      <input ref={imgInputRef} type="file" accept="image/*" multiple
                        onChange={handleImagePick} className="hidden" />
                    </div>
                  </div>

                  {/* COL 2: Tujuan + Jadwal */}
                  <div className="p-5 sm:p-6 space-y-5 bg-kimaya-cream-light/30">
                    <SectionTitle index={2} title="Tujuan Pengingat" />

                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setFormTargetMode("ALL_THERAPISTS")}
                        className={cn("p-3 rounded-xl border-2 text-left transition",
                          formTargetMode === "ALL_THERAPISTS"
                            ? "border-kimaya-olive bg-kimaya-olive/5"
                            : "border-kimaya-cream-dark/40 bg-white hover:border-kimaya-olive/40")}>
                        <UsersIcon size={16} className={formTargetMode === "ALL_THERAPISTS" ? "text-kimaya-olive" : "text-kimaya-brown-light/50"} />
                        <p className="text-xs font-semibold text-kimaya-brown mt-1.5">Semua Therapist</p>
                        <p className="text-[10px] text-kimaya-brown-light/60 mt-0.5">Di cabang Anda</p>
                      </button>
                      <button type="button" onClick={() => setFormTargetMode("SELECTED")}
                        className={cn("p-3 rounded-xl border-2 text-left transition",
                          formTargetMode === "SELECTED"
                            ? "border-kimaya-olive bg-kimaya-olive/5"
                            : "border-kimaya-cream-dark/40 bg-white hover:border-kimaya-olive/40")}>
                        <Check size={16} className={formTargetMode === "SELECTED" ? "text-kimaya-olive" : "text-kimaya-brown-light/50"} />
                        <p className="text-xs font-semibold text-kimaya-brown mt-1.5">Pilih Spesifik</p>
                        <p className="text-[10px] text-kimaya-brown-light/60 mt-0.5">Centang satu per satu</p>
                      </button>
                    </div>

                    {formTargetMode === "SELECTED" && (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-kimaya-brown-light/40" />
                          <input type="text" value={therapistSearch} onChange={(e) => setTherapistSearch(e.target.value)}
                            placeholder="Cari nama therapist atau cabang…"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-kimaya-cream-dark bg-white text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-kimaya-brown-light/60">
                          <span>{formRecipientIds.length} dipilih dari {therapists.length} therapist</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setFormRecipientIds(filteredTherapists.map((t) => t.id))}
                              className="text-kimaya-olive hover:underline">Pilih semua</button>
                            <span className="text-kimaya-brown-light/30">·</span>
                            <button type="button" onClick={() => setFormRecipientIds([])}
                              className="text-kimaya-olive hover:underline">Kosongkan</button>
                          </div>
                        </div>
                        <div className="max-h-80 overflow-y-auto rounded-xl border border-kimaya-cream-dark/40 bg-white">
                          {Object.entries(therapistsByLocation).map(([loc, list]) => (
                            <div key={loc}>
                              <div className="px-3 py-1.5 bg-kimaya-cream/40 text-[10px] font-semibold uppercase tracking-wider text-kimaya-brown-light/60 flex items-center gap-1.5">
                                <MapPin size={10} /> {loc}
                              </div>
                              {list.map((t) => {
                                const checked = formRecipientIds.includes(t.id);
                                return (
                                  <label key={t.id}
                                    className={cn("flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-kimaya-cream/30 transition",
                                      checked && "bg-kimaya-olive/5")}>
                                    <input type="checkbox" checked={checked}
                                      onChange={(e) => {
                                        if (e.target.checked) setFormRecipientIds((p) => [...p, t.id]);
                                        else setFormRecipientIds((p) => p.filter((id) => id !== t.id));
                                      }}
                                      className="w-4 h-4 rounded text-kimaya-olive focus:ring-kimaya-olive/30" />
                                    <span className="flex-1 text-sm text-kimaya-brown truncate">{t.name}</span>
                                    {!t.pushReady && (
                                      <span className="text-[10px] text-amber-600" title="Belum aktifkan notifikasi HP">📵</span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          ))}
                          {filteredTherapists.length === 0 && (
                            <p className="text-center text-sm text-kimaya-brown-light/40 py-6">Tidak ada therapist yang cocok</p>
                          )}
                        </div>
                      </div>
                    )}

                    <SectionTitle index={3} title="Jadwal Pengiriman" />

                    <div className="grid grid-cols-2 gap-2">
                      <ScheduleButton selected={formSchedule === "IMMEDIATE"} onClick={() => setFormSchedule("IMMEDIATE")}
                        title="Kirim Sekarang" desc="Begitu disimpan langsung dikirim" />
                      <ScheduleButton selected={formSchedule === "ONE_TIME"} onClick={() => setFormSchedule("ONE_TIME")}
                        title="Sekali Jalan" desc="Pilih tanggal & jam" />
                      <ScheduleButton selected={formSchedule === "DAILY"} onClick={() => setFormSchedule("DAILY")}
                        title="Setiap Hari" desc="Pada jam yang sama" />
                      <ScheduleButton selected={formSchedule === "WEEKLY"} onClick={() => setFormSchedule("WEEKLY")}
                        title="Setiap Minggu" desc="Pilih hari & jam" />
                    </div>

                    {formSchedule === "DAILY" && (
                      <div>
                        <label className="block text-xs font-semibold text-kimaya-brown-light mb-1.5">Jam Kirim (WIB)</label>
                        <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)}
                          className="w-full px-3 py-3 rounded-xl border border-kimaya-cream-dark bg-white text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                      </div>
                    )}
                    {formSchedule === "WEEKLY" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-kimaya-brown-light mb-1.5">Hari</label>
                          <select value={formDay} onChange={(e) => setFormDay(Number(e.target.value))}
                            className="w-full px-3 py-3 rounded-xl border border-kimaya-cream-dark bg-white text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30">
                            {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-kimaya-brown-light mb-1.5">Jam (WIB)</label>
                          <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)}
                            className="w-full px-3 py-3 rounded-xl border border-kimaya-cream-dark bg-white text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                        </div>
                      </div>
                    )}
                    {formSchedule === "ONE_TIME" && (
                      <div>
                        <label className="block text-xs font-semibold text-kimaya-brown-light mb-1.5">Tanggal & Jam (WIB)</label>
                        <input type="datetime-local" value={formOneTimeAt} onChange={(e) => setFormOneTimeAt(e.target.value)}
                          className="w-full px-3 py-3 rounded-xl border border-kimaya-cream-dark bg-white text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                      </div>
                    )}
                  </div>

                  {/* COL 3: Live Preview */}
                  <div className="hidden lg:block p-5 bg-kimaya-cream/30 sticky top-0 h-full">
                    <p className="text-xs font-semibold text-kimaya-brown-light mb-1.5 flex items-center gap-1.5">
                      <Eye size={12} /> Pratinjau
                    </p>
                    <p className="text-[10px] text-kimaya-brown-light/50 mb-3">Contoh pesan yang akan diterima</p>

                    <div className="bg-[#dcf8c6] rounded-2xl rounded-tr-sm p-3 shadow-sm relative">
                      <p className="text-[11px] font-semibold text-emerald-700 mb-1">{formTitle || "Judul"}</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                        {formMsg ? renderPreview(formMsg) : <span className="text-gray-400 italic">Isi pesan tampil di sini…</span>}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-2 text-right">
                        {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} ✓✓
                      </p>
                    </div>

                    <div className="mt-4">
                      <p className="text-[10px] uppercase tracking-wider text-kimaya-brown-light/60 mb-1.5">Notifikasi HP</p>
                      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-3 flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-kimaya-olive flex items-center justify-center flex-shrink-0">
                          <Bell size={14} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{formTitle || "Judul"}</p>
                          <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">
                            {formMsg ? renderPreview(formMsg) : "Isi pesan…"}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">Kimaya · sekarang</p>
                        </div>
                      </div>
                    </div>

                    {formImages.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] uppercase tracking-wider text-kimaya-brown-light/60 mb-1.5">Lampiran ({formImages.length})</p>
                        <div className="grid grid-cols-3 gap-1">
                          {formImages.slice(0, 6).map((img) => (
                            <div key={img.key} className="aspect-square rounded-lg overflow-hidden bg-kimaya-cream-dark/20">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img.photoUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 sm:px-7 py-4 border-t border-kimaya-cream-dark/30 flex items-center justify-between gap-3 bg-kimaya-cream/20 flex-shrink-0">
                <p className="text-[11px] text-kimaya-brown-light/60 hidden sm:block">
                  {formTargetMode === "ALL_THERAPISTS"
                    ? `Akan dikirim ke semua therapist di cabang Anda`
                    : `${formRecipientIds.length} therapist dipilih`}
                </p>
                <div className="flex gap-3 ml-auto">
                  <button onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-kimaya-brown-light hover:bg-kimaya-cream/50 transition">
                    Batal
                  </button>
                  <motion.button whileTap={{ scale: 0.98 }} onClick={handleSubmit}
                    disabled={saving || !formTitle.trim() || !formMsg.trim()}
                    className="px-6 py-2.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition shadow-lg shadow-kimaya-olive/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : (formSchedule === "IMMEDIATE" ? <Send size={14} /> : <Check size={14} />)}
                    {editing ? "Simpan Perubahan" : (formSchedule === "IMMEDIATE" ? "Buat & Kirim" : "Simpan Pengingat")}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log viewer modal */}
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
                        <th className="px-3 py-2.5 text-xs font-semibold text-kimaya-brown-light/50 text-left">Therapist</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-kimaya-brown-light/50 text-left">No. HP</th>
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

      {/* Diagnose modal (DEVELOPER only) */}
      <AnimatePresence>
        {diagOpen && isDeveloper && (
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
                    <h3 className="text-lg font-serif text-kimaya-brown">Kesiapan Notifikasi</h3>
                    <p className="text-[11px] text-kimaya-brown-light/50">Khusus developer · cek status notifikasi tiap therapist</p>
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
                  <p className="text-center text-sm text-red-500 py-8">Gagal memuat data</p>
                ) : (
                  <>
                    <div className={cn("rounded-xl p-4 border-2",
                      diagData.vapid.configured ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200")}>
                      <div className="flex items-start gap-3">
                        {diagData.vapid.configured
                          ? <Check size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                          : <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />}
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-kimaya-brown">
                            {diagData.vapid.configured ? "Server notifikasi siap" : "Server notifikasi belum diatur"}
                          </p>
                          {!diagData.vapid.configured && (
                            <p className="text-[11px] text-red-600 mt-1">
                              Atur kunci VAPID di env server (NEXT_PUBLIC_VAPID_PUBLIC_KEY dan VAPID_PRIVATE_KEY), lalu rebuild.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={cn("rounded-xl p-4 border",
                      diagData.me.subscribed ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200")}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-kimaya-brown">
                            Device Anda: {diagData.me.subscribed ? `${diagData.me.subscriptions} aktif` : "Belum aktifkan notifikasi"}
                          </p>
                          <p className="text-[11px] text-kimaya-brown-light/60 mt-0.5">
                            Klik tombol untuk kirim test notifikasi ke HP Anda.
                          </p>
                        </div>
                        <button onClick={() => runTestPush()} disabled={testPushLoading || !diagData.vapid.configured}
                          className="px-3 py-1.5 rounded-lg bg-kimaya-olive text-white text-xs font-medium hover:bg-kimaya-olive-dark disabled:opacity-50 flex items-center gap-1.5">
                          {testPushLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          Tes
                        </button>
                      </div>
                      {testPushResult && (
                        <p className="text-[11px] mt-2 px-3 py-2 bg-white rounded-lg text-kimaya-brown">{testPushResult}</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-kimaya-cream-dark/30 overflow-hidden">
                      <div className="px-4 py-2.5 bg-kimaya-cream/40 border-b border-kimaya-cream-dark/30">
                        <p className="text-xs font-semibold text-kimaya-brown">
                          Status Therapist: {diagData.therapists.subscribed} dari {diagData.therapists.total} sudah aktif
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
                                  {t.subscribed ? "Aktif" : "Belum aktif"}
                                </span>
                              </div>
                              {t.subscribed && diagData.vapid.configured && (
                                <button onClick={() => runTestPush(t.id)} disabled={testPushLoading}
                                  className="text-[10px] px-2 py-1 rounded-md bg-kimaya-olive/10 text-kimaya-olive hover:bg-kimaya-olive/20 disabled:opacity-50 flex items-center gap-1">
                                  <Send size={10} /> Tes
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
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

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function SectionTitle({ index, title }: { index: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-kimaya-olive text-white text-[11px] font-semibold flex items-center justify-center">{index}</span>
      <h3 className="text-sm font-serif text-kimaya-brown">{title}</h3>
    </div>
  );
}

function ScheduleButton({ selected, onClick, title, desc }: { selected: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("p-3 rounded-xl border-2 text-left transition",
        selected ? "border-kimaya-olive bg-kimaya-olive/5" : "border-kimaya-cream-dark/40 bg-white hover:border-kimaya-olive/40")}>
      <p className={cn("text-xs font-semibold", selected ? "text-kimaya-olive" : "text-kimaya-brown")}>{title}</p>
      <p className="text-[10px] text-kimaya-brown-light/60 mt-0.5">{desc}</p>
    </button>
  );
}

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
          {isActive ? "Aktif" : "Dimatikan"}
        </span>
      </div>

      {/* Image thumbnails */}
      {r.images.length > 0 && (
        <div className="flex gap-1 mb-3">
          {r.images.slice(0, 4).map((img) => (
            <div key={img.id} className="w-12 h-12 rounded-lg overflow-hidden bg-kimaya-cream-dark/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.photoUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
          {r.images.length > 4 && (
            <div className="w-12 h-12 rounded-lg bg-kimaya-cream flex items-center justify-center text-[10px] text-kimaya-brown-light/60">
              +{r.images.length - 4}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
        <span className="px-2 py-0.5 rounded-md bg-kimaya-cream text-kimaya-brown-light/70 inline-flex items-center gap-1">
          <Clock size={10} /> {r.schedule}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 inline-flex items-center gap-1">
          <UsersIcon size={10} /> {r.target}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-kimaya-brown-light/60 mb-3">
        <div className="flex items-center gap-1"><Send size={11} /> {r.totalSent} dikirim</div>
        <div className="flex items-center gap-1"><MessageCircle size={11} /> {r.totalResponded} balasan</div>
        {r.totalSent > 0 && (
          <div className="ml-auto">
            <span className={cn("font-semibold",
              respondPct >= 75 ? "text-emerald-600" :
              respondPct >= 40 ? "text-amber-600" : "text-red-500")}>{respondPct}%</span>
          </div>
        )}
      </div>

      {r.totalSent > 0 && (
        <div className="w-full h-1 rounded-full bg-kimaya-cream overflow-hidden mb-3">
          <div className={cn("h-full rounded-full transition-all",
            respondPct >= 75 ? "bg-emerald-500" :
            respondPct >= 40 ? "bg-amber-500" : "bg-red-400")} style={{ width: `${respondPct}%` }} />
        </div>
      )}

      <p className="text-[10px] text-kimaya-brown-light/40 mb-3">Terakhir dikirim: {r.lastSent}</p>

      <div className="flex items-center gap-1 mt-auto pt-3 border-t border-kimaya-cream-dark/30">
        <button onClick={() => onSendNow(r.id)} disabled={sending}
          className="flex-1 px-3 py-2 rounded-lg bg-kimaya-olive text-white text-xs font-medium hover:bg-kimaya-olive-dark transition disabled:opacity-50 flex items-center justify-center gap-1.5">
          {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Kirim Sekarang
        </button>
        <Link href={`/dashboard/reminders/${r.id}/responses`}
          className="px-3 py-2 rounded-lg bg-kimaya-cream/50 text-kimaya-brown text-xs font-medium hover:bg-kimaya-cream transition flex items-center gap-1"
          title="Lihat tanggapan">
          <Eye size={12} /> Balasan
        </Link>
        <button onClick={() => onLogs(r.id)} title="Riwayat pengiriman"
          className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 hover:text-kimaya-brown transition">
          <History size={14} />
        </button>
        <button onClick={() => onToggle(r.id, r.status)} title={isActive ? "Matikan" : "Nyalakan"}
          className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 hover:text-kimaya-olive transition">
          {isActive ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button onClick={() => onEdit(r)} title="Ubah"
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

interface StatCardProps { label: string; value: number | string; sub: string; icon: React.ComponentType<{ size?: number; className?: string }>; tone: "olive" | "blue" | "emerald" | "purple"; }
function StatCard({ label, value, sub, icon: Icon, tone }: StatCardProps) {
  const tones = {
    olive: "bg-kimaya-olive/10 text-kimaya-olive",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", tones[tone])}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-kimaya-brown-light/50">{label}</p>
        <p className="text-lg font-semibold text-kimaya-brown leading-tight">{value}</p>
        <p className="text-[10px] text-kimaya-brown-light/40 truncate">{sub}</p>
      </div>
    </div>
  );
}

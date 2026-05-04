"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Plus, Pencil, Trash2, Pause, Play, X as XIcon, Loader2, Check, MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Reminder { id: string; title: string; messageTemplate: string; target: string; schedule: string; channel: string; status: string; lastSent: string; }

const channels = ["WHATSAPP", "WHATSAPP_WEB", "WHATSAPP_EMAIL", "EMAIL"];
const schedules = ["DAILY", "WEEKLY", "IMMEDIATE"];
const channelLabels: Record<string, string> = { WHATSAPP: "WhatsApp", WHATSAPP_WEB: "WhatsApp + Web", WHATSAPP_EMAIL: "WhatsApp + Email", EMAIL: "Email" };
const scheduleLabels: Record<string, string> = { DAILY: "Setiap Hari", WEEKLY: "Setiap Minggu", IMMEDIATE: "Segera" };

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const [formTitle, setFormTitle] = useState("");
  const [formMsg, setFormMsg] = useState("");
  const [formChannel, setFormChannel] = useState("WHATSAPP");
  const [formSchedule, setFormSchedule] = useState("DAILY");
  const [formTime, setFormTime] = useState("08:00");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const fetchData = useCallback(() => {
    fetch("/api/reminders").then(r => r.json()).then(d => { setReminders(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setFormTitle(""); setFormMsg(""); setFormChannel("WHATSAPP"); setFormSchedule("DAILY"); setFormTime("08:00");
    setShowModal(true);
  };

  const openEdit = (r: Reminder) => {
    setEditing(r);
    setFormTitle(r.title); setFormMsg(r.messageTemplate); setFormChannel("WHATSAPP"); setFormSchedule("DAILY"); setFormTime("08:00");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    const body = { title: formTitle, messageTemplate: formMsg, channel: formChannel, scheduleType: formSchedule, scheduledTime: formTime };
    if (editing) {
      await fetch(`/api/reminders/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      showToast("Reminder berhasil diupdate");
    } else {
      await fetch("/api/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      showToast("Reminder berhasil dibuat");
    }
    setSaving(false); setShowModal(false); fetchData();
  };

  const handleToggle = async (id: string, current: string) => {
    const newStatus = current === "active" ? "PAUSED" : "ACTIVE";
    await fetch(`/api/reminders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    showToast(newStatus === "ACTIVE" ? "Reminder diaktifkan" : "Reminder dijeda");
    fetchData();
  };

  const handleSendNow = async (id: string) => {
    setSending(id);
    try {
      const res = await fetch(`/api/reminders/${id}/send`, { method: "POST" });
      const data = await res.json();
      showToast(data.message || "Reminder terkirim!");
    } catch {
      showToast("⚠️ Gagal mengirim reminder. Pastikan WAHA terhubung.");
    }
    setSending(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus reminder ini?")) return;
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    showToast("Reminder berhasil dihapus");
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>;

  const active = reminders.filter(r => r.status === "active").length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px] mx-auto">
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
          <h1 className="text-2xl font-serif text-kimaya-brown">Reminder WhatsApp</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">{active} reminder aktif dari {reminders.length} total</p>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={openCreate}
          className="px-5 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center gap-2 w-fit">
          <Plus size={16} /> Buat Reminder
        </motion.button>
      </motion.div>

      {/* Reminder Cards */}
      <div className="space-y-3">
        {reminders.map(r => (
          <motion.div key={r.id} variants={item} whileHover={{ y: -1 }}
            className="bg-white rounded-2xl p-5 border border-kimaya-cream-dark/30 hover:shadow-md transition-all">
            <div className="flex items-start gap-4">
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                r.status === "active" ? "bg-kimaya-olive/10" : "bg-gray-100")}>
                <MessageCircle size={20} className={r.status === "active" ? "text-kimaya-olive" : "text-gray-400"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium text-kimaya-brown">{r.title}</h3>
                    <p className="text-xs text-kimaya-brown-light/50 mt-0.5 line-clamp-1">{r.messageTemplate}</p>
                  </div>
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0",
                    r.status === "active" ? "bg-kimaya-olive/10 text-kimaya-olive" : "bg-gray-100 text-gray-400"
                  )}>{r.status === "active" ? "Aktif" : "Dijeda"}</span>
                </div>
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded bg-kimaya-cream text-kimaya-brown-light/60 flex items-center gap-1">
                    <Send size={10} /> {r.channel}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-kimaya-cream text-kimaya-brown-light/60">{r.schedule}</span>
                  <span className="text-xs text-kimaya-brown-light/40">Terakhir: {r.lastSent}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleSendNow(r.id)} disabled={sending === r.id}
                      className="px-3 py-1.5 rounded-lg bg-kimaya-olive/10 text-kimaya-olive text-xs font-medium hover:bg-kimaya-olive/20 transition-colors flex items-center gap-1 disabled:opacity-50"
                      title="Kirim sekarang ke semua karyawan">
                      {sending === r.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      Kirim
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleToggle(r.id, r.status)}
                      className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 hover:text-kimaya-olive transition-colors"
                      title={r.status === "active" ? "Jeda" : "Aktifkan"}>
                      {r.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => openEdit(r)}
                      className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 hover:text-kimaya-olive transition-colors">
                      <Pencil size={14} />
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDelete(r.id)}
                      className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-kimaya-brown-light/40 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {reminders.length === 0 && (
          <div className="text-center py-16 text-kimaya-brown-light/40">
            <Bell size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Belum ada reminder. Buat yang pertama!</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }} onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-serif text-kimaya-brown">{editing ? "Edit Reminder" : "Buat Reminder"}</h2>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40"><XIcon size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Judul</label>
                  <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Nama reminder"
                    className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Template Pesan</label>
                  <textarea value={formMsg} onChange={e => setFormMsg(e.target.value)} rows={3} placeholder="Hai {nama}, jangan lupa..."
                    className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 resize-none" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Channel</label>
                    <select value={formChannel} onChange={e => setFormChannel(e.target.value)}
                      className="w-full px-3 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none">
                      {channels.map(c => <option key={c} value={c}>{channelLabels[c]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Jadwal</label>
                    <select value={formSchedule} onChange={e => setFormSchedule(e.target.value)}
                      className="w-full px-3 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none">
                      {schedules.map(s => <option key={s} value={s}>{scheduleLabels[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Waktu</label>
                    <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)}
                      className="w-full px-3 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none" />
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.98 }} onClick={handleSubmit} disabled={saving || !formTitle || !formMsg}
                  className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {editing ? "Simpan Perubahan" : "Buat Reminder"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

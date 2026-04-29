"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Plus, MessageSquare, Pencil, Trash2, Pause, Play, X as XIcon, Wifi, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Reminder {
  id: string;
  title: string;
  messageTemplate: string;
  target: string;
  schedule: string;
  channel: string;
  status: string;
  lastSent: string;
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formTarget, setFormTarget] = useState("EMPLOYEE");
  const [formChannel, setFormChannel] = useState("WHATSAPP");
  const [formSchedule, setFormSchedule] = useState("DAILY");
  const [formTime, setFormTime] = useState("07:30");

  const fetchReminders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/reminders");
      if (res.ok) {
        const data = await res.json();
        setReminders(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch reminders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleSubmit = async () => {
    if (!formTitle || !formMessage) return;
    setSaving(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          messageTemplate: formMessage,
          targetRole: formTarget,
          channel: formChannel,
          scheduleType: formSchedule,
          scheduledTime: formTime,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setFormTitle(""); setFormMessage(""); setFormTarget("EMPLOYEE"); setFormChannel("WHATSAPP"); setFormSchedule("DAILY"); setFormTime("07:30");
        fetchReminders();
      }
    } catch (err) {
      console.error("Failed to create reminder:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown">Reminder & Notifikasi</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">Kelola pengingat otomatis via WhatsApp</p>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowCreate(true)} className="px-5 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center gap-2 w-fit">
          <Plus size={16} /> Buat Reminder
        </motion.button>
      </motion.div>

      {/* WAHA Status */}
      <motion.div variants={item} className="bg-white rounded-2xl p-5 border border-kimaya-cream-dark/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
            <MessageSquare size={22} className="text-green-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-kimaya-brown">WAHA NoWeb — Terhubung</h3>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <p className="text-xs text-kimaya-brown-light/50 mt-0.5">
              <span className="inline-flex items-center gap-1"><Wifi size={10} /> Nomor: +62 812-XXXX-XXXX</span>
              <span className="mx-2">•</span>Session aktif
              <span className="mx-2">•</span>Uptime: 15 hari
            </p>
          </div>
        </div>
        <a href="#" className="text-sm text-kimaya-olive font-medium hover:text-kimaya-olive-dark transition-colors">Kelola →</a>
      </motion.div>

      {/* Reminders List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-kimaya-olive" />
        </div>
      ) : reminders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-kimaya-brown-light/40 bg-white rounded-2xl border border-kimaya-cream-dark/30">
          <Bell size={32} className="mb-2 opacity-30" />
          <p className="text-sm">Belum ada reminder</p>
          <button onClick={() => setShowCreate(true)} className="mt-2 text-sm text-kimaya-olive font-medium hover:text-kimaya-olive-dark">Buat reminder pertama →</button>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => (
            <motion.div key={r.id} variants={item} whileHover={{ y: -1 }} className="bg-white rounded-2xl p-5 border border-kimaya-cream-dark/30 transition-shadow hover:shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                    r.status === "active" ? "bg-kimaya-olive/10 text-kimaya-olive" : "bg-gray-100 text-gray-400"
                  )}>
                    <Bell size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-kimaya-brown">{r.title}</h3>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
                        r.status === "active" ? "bg-kimaya-olive/10 text-kimaya-olive" : "bg-gray-100 text-gray-400"
                      )}>{r.status === "active" ? "Aktif" : "Dijeda"}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-kimaya-brown-light/50">
                      <span>🎯 {r.target}</span>
                      <span>⏰ {r.schedule}</span>
                      <span>📱 {r.channel}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:ml-auto">
                  <div className="text-right mr-2 hidden md:block">
                    <p className="text-[10px] text-kimaya-brown-light/40 uppercase tracking-wider">Terakhir dikirim</p>
                    <p className="text-xs text-kimaya-brown-light/60 font-medium">{r.lastSent}</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 hover:text-kimaya-olive transition-colors">
                    <Pencil size={14} />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 hover:text-amber-600 transition-colors">
                    {r.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-kimaya-brown-light/40 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreate(false)} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: "spring", damping: 25 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-serif text-kimaya-brown">Buat Reminder Baru</h2>
                <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40"><XIcon size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Judul</label>
                  <input type="text" placeholder="Contoh: Reminder Check-In Harian" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Pesan Template</label>
                  <textarea rows={3} placeholder="Hai {nama}, jangan lupa check-in hari ini ya!" value={formMessage} onChange={(e) => setFormMessage(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 resize-none" />
                  <p className="text-xs text-kimaya-brown-light/40 mt-1">Gunakan {"{nama}"}, {"{tanggal}"}, {"{skor}"} sebagai variabel</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Target</label>
                    <select value={formTarget} onChange={(e) => setFormTarget(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30">
                      <option value="EMPLOYEE">Semua Karyawan</option>
                      <option value="MANAGER">Supervisor</option>
                      <option value="HR_ADMIN">HR Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Channel</label>
                    <select value={formChannel} onChange={(e) => setFormChannel(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30">
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="WHATSAPP_EMAIL">WhatsApp + Email</option>
                      <option value="EMAIL">Email</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Jadwal</label>
                    <select value={formSchedule} onChange={(e) => setFormSchedule(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30">
                      <option value="DAILY">Setiap Hari</option>
                      <option value="WEEKLY">Setiap Minggu</option>
                      <option value="IMMEDIATE">Segera</option>
                      <option value="CUSTOM_CRON">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Waktu</label>
                    <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={saving || !formTitle || !formMessage}
                  className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : "Simpan Reminder"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

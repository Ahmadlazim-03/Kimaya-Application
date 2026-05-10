"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MessageCircle, Loader2, Inbox, X as XIcon, ChevronLeft, ChevronRight,
  Calendar, BarChart3, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ResponseImage { id: string; photoUrl: string; description: string | null; }
interface ResponseEntry {
  id: string; logId: string; caption: string | null;
  respondedAt: string; updatedAt: string; sentAt: string;
  user: { id: string; name: string; avatarUrl: string | null; role: string; department: string | null; location: string | null };
  images: ResponseImage[];
}
interface ApiResp {
  reminder: { id: string; title: string; messageTemplate: string; lastSentAt: string | null };
  responses: ResponseEntry[];
  stats: { responded: number; totalSent: number; responseRate: number };
}

export default function ResponsesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<{ images: ResponseImage[]; idx: number; userName: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reminders/${params.id}/responses`);
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* ignore */ }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>;
  if (!data) return <div className="text-center py-12 text-kimaya-brown-light/40">Data tidak ditemukan</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto space-y-5 pb-12">
      <button onClick={() => router.push("/dashboard/reminders")}
        className="flex items-center gap-2 text-sm text-kimaya-brown-light/60 hover:text-kimaya-brown transition">
        <ArrowLeft size={16} /> Kembali ke Reminder
      </button>

      <div className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-serif text-kimaya-brown">{data.reminder.title}</h1>
            <p className="text-xs text-kimaya-brown-light/50 mt-1 max-w-2xl">{data.reminder.messageTemplate}</p>
          </div>
          {data.reminder.lastSentAt && (
            <div className="text-[11px] text-kimaya-brown-light/50 flex items-center gap-1.5 flex-shrink-0">
              <Clock size={11} />
              Terakhir dikirim {new Date(data.reminder.lastSentAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{data.stats.totalSent}</p>
            <p className="text-[10px] uppercase tracking-wider text-blue-600/70 mt-0.5">Terkirim</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{data.stats.responded}</p>
            <p className="text-[10px] uppercase tracking-wider text-emerald-600/70 mt-0.5">Ditanggapi</p>
          </div>
          <div className="bg-kimaya-olive/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-kimaya-olive">{data.stats.responseRate}%</p>
            <p className="text-[10px] uppercase tracking-wider text-kimaya-olive/70 mt-0.5">Response Rate</p>
          </div>
        </div>
      </div>

      {/* Responses list */}
      {data.responses.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-kimaya-cream-dark/40 p-12 text-center">
          <Inbox size={40} className="mx-auto mb-3 text-kimaya-brown-light/30" />
          <p className="text-sm text-kimaya-brown-light/50">Belum ada tanggapan dari karyawan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.responses.map((r) => (
            <ResponseCard key={r.id} r={r}
              onImageClick={(idx) => setLightbox({ images: r.images, idx, userName: r.user.name })} />
          ))}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)}
          onNav={(d) => setLightbox((prev) => prev ? { ...prev, idx: (prev.idx + d + prev.images.length) % prev.images.length } : null)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function ResponseCard({ r, onImageClick }: { r: ResponseEntry; onImageClick: (idx: number) => void }) {
  const initials = r.user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const wasEdited = r.updatedAt !== r.respondedAt;

  return (
    <motion.div layout
      className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-full bg-kimaya-olive overflow-hidden flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
          {r.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.user.avatarUrl} alt={r.user.name} className="w-full h-full object-cover" />
          ) : <span>{initials}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-semibold text-kimaya-brown">{r.user.name}</p>
            <span className="text-[10px] text-kimaya-olive uppercase tracking-wider font-medium">{r.user.role}</span>
            {wasEdited && <span className="text-[10px] text-amber-600 italic">(diedit)</span>}
          </div>
          <p className="text-[11px] text-kimaya-brown-light/50 mt-0.5">
            {r.user.department && `${r.user.department} · `}{r.user.location || "-"}
          </p>
          <p className="text-[10px] text-kimaya-brown-light/40 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <Clock size={9} />
            Dibalas {new Date(r.respondedAt).toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            <span>·</span>
            <span>Reminder dikirim {new Date(r.sentAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </p>
        </div>
      </div>

      {r.caption && (
        <p className="text-sm text-kimaya-brown bg-kimaya-cream/30 rounded-xl px-3 py-2.5 mb-3 italic">
          &ldquo;{r.caption}&rdquo;
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {r.images.map((img, idx) => (
          <button key={img.id} onClick={() => onImageClick(idx)}
            className="aspect-square rounded-xl overflow-hidden bg-kimaya-cream relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.photoUrl} alt={img.description || `Foto ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            {img.description && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-4">
                <p className="text-[10px] text-white line-clamp-2">{img.description}</p>
              </div>
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function Lightbox({ state, onClose, onNav }: {
  state: { images: ResponseImage[]; idx: number; userName: string };
  onClose: () => void;
  onNav: (delta: number) => void;
}) {
  const img = state.images[state.idx];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <button onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 z-10">
        <XIcon size={20} />
      </button>
      {state.images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); onNav(-1); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 z-10">
            <ChevronLeft size={20} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onNav(1); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 z-10">
            <ChevronRight size={20} />
          </button>
        </>
      )}
      <motion.div key={state.idx} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()} className="max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.photoUrl} alt={img.description || ""} className="max-h-[75vh] max-w-full object-contain rounded-xl" />
        <div className="mt-3 text-center text-white/80 text-sm max-w-2xl">
          <p className="text-xs text-white/50 mb-1">{state.userName} · Foto {state.idx + 1}/{state.images.length}</p>
          {img.description && <p>{img.description}</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}

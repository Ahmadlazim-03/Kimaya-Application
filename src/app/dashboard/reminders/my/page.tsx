"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bell, Clock, Check, Camera, ChevronRight, Loader2, Inbox, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import NotificationSubscriptionCard from "@/components/NotificationSubscriptionCard";

type Period = "today" | "week" | "month";

interface ReminderItem {
  logId: string;
  reminderId: string;
  reminderTitle: string;
  sentAt: string;
  renderedMessage: string;
  respondHref: string;
  response: {
    id: string;
    respondedAt: string;
    updatedAt: string;
    imageCount: number;
    thumbs: string[];
    caption: string | null;
  } | null;
}

interface ApiResponse {
  period: Period;
  items: ReminderItem[];
  stats: { total: number; pending: number; responded: number };
}

const periodLabels: Record<Period, string> = {
  today: "Hari Ini",
  week: "Minggu Ini",
  month: "Bulan Ini",
};

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function MyRemindersPage() {
  const [period, setPeriod] = useState<Period>("today");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reminders/my?period=${period}`);
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* ignore */ }
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pending = (data?.items || []).filter((i) => !i.response);
  const responded = (data?.items || []).filter((i) => i.response);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-5 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif text-kimaya-brown">Reminder Saya</h1>
        <p className="text-sm text-kimaya-brown-light/60 mt-1">
          Tugas dan pengingat yang dikirim untuk Anda
        </p>
      </div>

      {/* Notification subscription status — persistent so therapist can subscribe at any time */}
      <NotificationSubscriptionCard />

      {/* Period tabs */}
      <div className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-1 flex gap-1">
        {(["today", "week", "month"] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={cn("flex-1 py-2.5 rounded-xl text-sm font-medium transition-all",
              period === p
                ? "bg-kimaya-olive text-white shadow-md shadow-kimaya-olive/20"
                : "text-kimaya-brown-light/60 hover:text-kimaya-brown hover:bg-kimaya-cream/30"
            )}>
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-4 text-center">
            <p className="text-2xl font-bold text-kimaya-brown">{data.stats.total}</p>
            <p className="text-[10px] uppercase tracking-wider text-kimaya-brown-light/50 mt-1">Total</p>
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{data.stats.pending}</p>
            <p className="text-[10px] uppercase tracking-wider text-amber-600/70 mt-1">Belum Dibalas</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{data.stats.responded}</p>
            <p className="text-[10px] uppercase tracking-wider text-emerald-600/70 mt-1">Sudah Dibalas</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-kimaya-olive" />
        </div>
      )}

      {!loading && data && data.items.length === 0 && (
        <div className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-12 text-center">
          <Inbox size={40} className="mx-auto text-kimaya-brown-light/30 mb-3" />
          <p className="text-sm text-kimaya-brown-light/50">
            Belum ada reminder untuk {periodLabels[period].toLowerCase()}.
          </p>
        </div>
      )}

      {/* Pending section */}
      {!loading && pending.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/70 mb-2 flex items-center gap-1.5">
            <Clock size={12} /> Belum Dibalas ({pending.length})
          </p>
          <div className="space-y-2.5">
            {pending.map((item) => <PendingCard key={item.logId} item={item} />)}
          </div>
        </section>
      )}

      {/* Responded section */}
      {!loading && responded.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700/70 mb-2 flex items-center gap-1.5">
            <Check size={12} /> Sudah Dibalas ({responded.length})
          </p>
          <div className="space-y-2.5">
            {responded.map((item) => <RespondedCard key={item.logId} item={item} />)}
          </div>
        </section>
      )}
    </motion.div>
  );
}

function PendingCard({ item }: { item: ReminderItem }) {
  return (
    <Link href={item.respondHref}>
      <motion.div whileTap={{ scale: 0.98 }}
        className="bg-white rounded-2xl border-2 border-amber-200 p-4 hover:shadow-md transition-all cursor-pointer">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Bell size={18} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-kimaya-brown truncate">{item.reminderTitle}</h3>
              <span className="text-[10px] text-amber-600 font-medium flex-shrink-0">
                {formatRelative(item.sentAt)}
              </span>
            </div>
            <p className="text-xs text-kimaya-brown-light/60 mt-1 line-clamp-2">
              {item.renderedMessage}
            </p>
            <div className="flex items-center justify-between mt-3">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                <Camera size={10} /> Tap untuk balas
              </span>
              <ChevronRight size={16} className="text-amber-500" />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

function RespondedCard({ item }: { item: ReminderItem }) {
  return (
    <Link href={item.respondHref}>
      <motion.div whileTap={{ scale: 0.98 }}
        className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-4 hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Check size={18} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-kimaya-brown truncate">{item.reminderTitle}</h3>
            <p className="text-[11px] text-kimaya-brown-light/50 mt-0.5">
              Dikirim {formatRelative(item.sentAt)} · Dibalas {formatRelative(item.response!.respondedAt)}
            </p>
            {item.response!.thumbs.length > 0 && (
              <div className="mt-2.5 flex gap-1.5">
                {item.response!.thumbs.slice(0, 4).map((t, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={t} alt="" className="w-12 h-12 rounded-lg object-cover border border-kimaya-cream-dark/30" />
                ))}
                {item.response!.imageCount > 4 && (
                  <div className="w-12 h-12 rounded-lg bg-kimaya-cream flex items-center justify-center text-[10px] font-medium text-kimaya-brown-light">
                    +{item.response!.imageCount - 4}
                  </div>
                )}
              </div>
            )}
            {item.response!.caption && (
              <p className="text-xs text-kimaya-brown-light/70 mt-2 line-clamp-2 italic">
                &ldquo;{item.response!.caption}&rdquo;
              </p>
            )}
          </div>
          <ChevronRight size={16} className="text-kimaya-brown-light/30 flex-shrink-0" />
        </div>
      </motion.div>
    </Link>
  );
}

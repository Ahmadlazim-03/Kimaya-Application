"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X as XIcon, Filter, FileText, FileSpreadsheet, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Report {
  id: string;
  title: string;
  by: string;
  date: string;
  category: string;
  status: string;
  fileType: string;
  avatar: string;
}

interface ReportStats {
  total: number;
  approved: number;
  pending: number;
  revision: number;
}

const categories = ["Semua", "Kunjungan Klien", "Progress Proyek", "Laporan Harian", "Bukti Pengeluaran"];

const statusBadges: Record<string, { label: string; cls: string }> = {
  approved: { label: "Disetujui", cls: "bg-kimaya-olive/10 text-kimaya-olive" },
  submitted: { label: "Menunggu Review", cls: "bg-amber-100 text-amber-700" },
  revision: { label: "Perlu Revisi", cls: "bg-red-50 text-red-500" },
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-500" },
};

const fileIcons: Record<string, { cls: string; Icon: typeof FileText }> = {
  PDF: { cls: "bg-red-100 text-red-500", Icon: FileText },
  DOCX: { cls: "bg-blue-100 text-blue-500", Icon: FileText },
  XLSX: { cls: "bg-green-100 text-green-500", Icon: FileSpreadsheet },
  JPG: { cls: "bg-purple-100 text-purple-500", Icon: ImageIcon },
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ReportStats>({ total: 0, approved: 0, pending: 0, revision: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [showUpload, setShowUpload] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      // Map UI category to API category
      const categoryMap: Record<string, string> = {
        "Kunjungan Klien": "CLIENT_VISIT",
        "Progress Proyek": "PROJECT_PROGRESS",
        "Laporan Harian": "DAILY_REPORT",
        "Bukti Pengeluaran": "EXPENSE_PROOF",
      };
      if (selectedCategory !== "Semua" && categoryMap[selectedCategory]) {
        params.set("category", categoryMap[selectedCategory]);
      }
      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        setStats(data.stats || { total: 0, approved: 0, pending: 0, revision: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px] mx-auto">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown">Laporan</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">Upload bukti &amp; kelola laporan kerja</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowUpload(true)}
          className="px-5 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center gap-2 w-fit"
        >
          <Upload size={16} /> Upload Laporan
        </motion.button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Laporan", value: stats.total },
          { label: "Disetujui", value: stats.approved },
          { label: "Menunggu", value: stats.pending },
          { label: "Perlu Revisi", value: stats.revision },
        ].map((s) => (
          <motion.div key={s.label} variants={item} className="bg-white rounded-2xl p-4 border border-kimaya-cream-dark/30">
            <p className="text-2xl font-semibold text-kimaya-brown">{s.value}</p>
            <p className="text-xs text-kimaya-brown-light/50 mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Category Filter */}
      <motion.div variants={item} className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setSelectedCategory(cat)} className={cn(
            "px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all",
            selectedCategory === cat
              ? "bg-kimaya-olive text-white"
              : "bg-white border border-kimaya-cream-dark/30 text-kimaya-brown-light/60 hover:text-kimaya-brown hover:border-kimaya-olive/30"
          )}>
            {cat === "Semua" && <Filter size={12} className="inline mr-1" />}{cat}
          </button>
        ))}
      </motion.div>

      {/* Reports Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-kimaya-olive" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-kimaya-brown-light/40 bg-white rounded-2xl border border-kimaya-cream-dark/30">
          <FileText size={32} className="mb-2 opacity-30" />
          <p className="text-sm">Belum ada laporan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {reports.map((report) => {
            const badge = statusBadges[report.status] || statusBadges.draft;
            const fi = fileIcons[report.fileType] || fileIcons.PDF;
            const Icon = fi.Icon;
            return (
              <motion.div
                key={report.id}
                variants={item}
                whileHover={{ y: -3, boxShadow: "0 8px 30px rgba(91,99,61,0.06)" }}
                className="bg-white rounded-2xl p-5 border border-kimaya-cream-dark/30 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", fi.cls)}>
                    <Icon size={18} />
                  </div>
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", badge.cls)}>{badge.label}</span>
                </div>
                <h3 className="text-sm font-medium text-kimaya-brown mb-2 leading-snug group-hover:text-kimaya-olive transition-colors">{report.title}</h3>
                <p className="text-xs text-kimaya-brown-light/40 mb-3">Kategori: {report.category}</p>
                <div className="flex items-center justify-between pt-3 border-t border-kimaya-cream-dark/20">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-kimaya-olive/10 flex items-center justify-center text-[10px] font-semibold text-kimaya-olive">{report.avatar}</div>
                    <span className="text-xs text-kimaya-brown-light/60">{report.by}</span>
                  </div>
                  <span className="text-xs text-kimaya-brown-light/40">{report.date}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUpload(false)} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: "spring", damping: 25 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-serif text-kimaya-brown">Upload Laporan</h2>
                <button onClick={() => setShowUpload(false)} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40"><XIcon size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Judul Laporan</label>
                  <input type="text" placeholder="Masukkan judul laporan" className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Kategori</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 transition-all">
                    <option>Pilih Kategori</option>
                    {categories.filter((c) => c !== "Semua").map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={() => setDragActive(false)}
                  className={cn("border-2 border-dashed rounded-2xl p-8 text-center transition-all", dragActive ? "border-kimaya-olive bg-kimaya-olive/5" : "border-kimaya-cream-dark")}
                >
                  <div className="w-14 h-14 rounded-full bg-kimaya-olive/10 flex items-center justify-center mx-auto mb-3">
                    <Upload size={24} className="text-kimaya-olive" />
                  </div>
                  <p className="text-sm text-kimaya-brown mb-1">Drag &amp; drop file disini</p>
                  <p className="text-xs text-kimaya-brown-light/40 mb-3">JPG, PNG, PDF, DOCX, XLSX (Maks. 25 MB)</p>
                  <button type="button" className="text-sm font-medium text-kimaya-olive hover:text-kimaya-olive-dark transition-colors">atau pilih file →</button>
                </div>
                <motion.button whileTap={{ scale: 0.98 }} className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20">
                  Kirim Laporan
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

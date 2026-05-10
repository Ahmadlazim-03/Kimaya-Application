"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Camera, Image as ImageIcon, X, Loader2, Check, Send,
  Clock, MessageCircle, Trash2, Edit3, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

interface ImageItem {
  /** Stable id for React key — uses existing DB id when editing, else random. */
  key: string;
  photoUrl: string;
  description: string;
  /** True if this image was loaded from the server (already saved). */
  existing: boolean;
}

interface LoadedData {
  log: { id: string; sentAt: string; renderedMessage: string | null; reminder: { id: string; title: string; messageTemplate: string } };
  response: {
    id: string;
    caption: string | null;
    respondedAt: string;
    updatedAt: string;
    user: { id: string; fullName: string; avatarUrl: string | null };
    images: { id: string; photoUrl: string; description: string | null; order: number }[];
  } | null;
}

const MAX_IMAGES = 8;

// Compress base64 image to JPEG with max dimension 1280px @ 0.82 quality.
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("File bukan gambar valid"));
      img.onload = () => {
        const MAX_DIM = 1280;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas tidak tersedia"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function RespondPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const reminderId = params.id;
  const logId = searchParams.get("logId");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<LoadedData | null>(null);

  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [editingDescIdx, setEditingDescIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const loadData = useCallback(async () => {
    if (!logId) {
      setError("Link tidak valid: logId tidak ditemukan");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/reminders/${reminderId}/respond?logId=${logId}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal memuat data");
        setLoading(false);
        return;
      }
      setData(json);
      if (json.response) {
        setCaption(json.response.caption || "");
        setImages(
          json.response.images.map((img: { id: string; photoUrl: string; description: string | null }) => ({
            key: img.id,
            photoUrl: img.photoUrl,
            description: img.description || "",
            existing: true,
          }))
        );
      }
    } catch {
      setError("Tidak dapat terhubung ke server");
    }
    setLoading(false);
  }, [reminderId, logId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (images.length + fileList.length > MAX_IMAGES) {
      showToast(`❌ Maksimal ${MAX_IMAGES} foto. Hapus dulu yang ada.`);
      return;
    }
    setAdding(true);
    const arr = Array.from(fileList);
    try {
      const compressed = await Promise.all(arr.map((f) => compressImage(f)));
      setImages((prev) => [
        ...prev,
        ...compressed.map((photoUrl) => ({
          key: crypto.randomUUID(),
          photoUrl,
          description: "",
          existing: false,
        })),
      ]);
    } catch (err) {
      showToast(`❌ ${err instanceof Error ? err.message : "Gagal memproses gambar"}`);
    }
    setAdding(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    if (editingDescIdx === idx) setEditingDescIdx(null);
  };

  const updateDescription = (idx: number, desc: string) => {
    setImages((prev) => prev.map((img, i) => (i === idx ? { ...img, description: desc.slice(0, 500) } : img)));
  };

  const handleSubmit = async () => {
    if (images.length === 0) {
      showToast("❌ Tambahkan minimal 1 foto");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reminders/${reminderId}/respond?logId=${logId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: caption.trim() || null,
          images: images.map((img) => ({ photoUrl: img.photoUrl, description: img.description.trim() || null })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(`❌ ${json.error || "Gagal menyimpan"}`);
      } else {
        showToast(`✅ ${json.message}`);
        // Re-load to refresh `existing` flags
        await loadData();
      }
    } catch {
      showToast("❌ Tidak dapat terhubung ke server");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error || "Data tidak ditemukan"}</p>
          <button onClick={() => router.push("/dashboard/reminders/my")}
            className="mt-4 px-4 py-2 rounded-xl bg-kimaya-olive text-white text-sm">
            Kembali ke Reminder Saya
          </button>
        </div>
      </div>
    );
  }

  const sentAt = new Date(data.log.sentAt);
  const isEdit = !!data.response;

  return (
    <div className="max-w-3xl mx-auto pb-32 lg:pb-12">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-kimaya-brown text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile-friendly back button */}
      <button onClick={() => router.push("/dashboard/reminders/my")}
        className="flex items-center gap-2 text-sm text-kimaya-brown-light/60 hover:text-kimaya-brown transition mb-4">
        <ArrowLeft size={16} /> Kembali ke Reminder Saya
      </button>

      {/* Reminder header card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-5 sm:p-6 mb-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-kimaya-olive/10 flex items-center justify-center flex-shrink-0">
            <MessageCircle size={22} className="text-kimaya-olive" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-serif text-kimaya-brown leading-tight">{data.log.reminder.title}</h1>
            <p className="text-xs text-kimaya-brown-light/50 mt-1 flex items-center gap-1.5">
              <Clock size={11} />
              Dikirim {sentAt.toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            </p>
            {data.log.renderedMessage && (
              <div className="mt-3 p-3 rounded-xl bg-kimaya-cream/40 text-sm text-kimaya-brown whitespace-pre-wrap">
                {data.log.renderedMessage}
              </div>
            )}
          </div>
        </div>

        {isEdit && (
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium">
            <Check size={12} />
            Sudah ditanggapi {new Date(data.response!.respondedAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            {data.response!.updatedAt !== data.response!.respondedAt && " (diedit)"}
          </div>
        )}
      </motion.div>

      {/* Response form */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-kimaya-olive overflow-hidden flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
            ) : (
              <span>{user?.fullName?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-kimaya-brown">{user?.fullName || "Saya"}</p>
            <p className="text-[11px] text-kimaya-brown-light/50">
              {isEdit ? "Mengedit tanggapan" : "Membuat tanggapan baru"} · {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-kimaya-brown-light mb-1.5">
            Caption (opsional)
          </label>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 1000))}
            rows={3} placeholder="Misal: Cuci gudang sudah selesai, tinggal rapikan rak terakhir."
            className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light/50 text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 resize-none" />
          <p className="text-[10px] text-kimaya-brown-light/40 mt-1 text-right">{caption.length}/1000</p>
        </div>

        {/* Image grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-kimaya-brown-light">
              Foto Bukti <span className="text-red-400">*</span>
            </label>
            <span className="text-[11px] text-kimaya-brown-light/40">{images.length}/{MAX_IMAGES}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img, idx) => (
              <motion.div key={img.key} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="relative aspect-square rounded-xl overflow-hidden bg-kimaya-cream group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.photoUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />

                {/* Description overlay */}
                {img.description && editingDescIdx !== idx && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                    <p className="text-[11px] text-white line-clamp-2">{img.description}</p>
                  </div>
                )}

                {/* Action overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={() => setEditingDescIdx(idx === editingDescIdx ? null : idx)}
                    className="w-8 h-8 rounded-full bg-white/90 text-kimaya-brown flex items-center justify-center hover:bg-white"
                    title="Edit deskripsi">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => removeImage(idx)}
                    className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                    title="Hapus foto">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Inline description editor */}
                {editingDescIdx === idx && (
                  <div className="absolute inset-x-0 bottom-0 bg-white p-2 border-t border-kimaya-cream-dark">
                    <textarea value={img.description} onChange={(e) => updateDescription(idx, e.target.value)}
                      rows={2} placeholder="Keterangan foto…"
                      className="w-full text-[11px] px-2 py-1 rounded border border-kimaya-cream-dark focus:outline-none focus:border-kimaya-olive resize-none"
                      autoFocus onBlur={() => setEditingDescIdx(null)} />
                  </div>
                )}
              </motion.div>
            ))}

            {/* Upload tile */}
            {images.length < MAX_IMAGES && (
              <div className="aspect-square rounded-xl border-2 border-dashed border-kimaya-olive/30 hover:border-kimaya-olive/60 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer relative overflow-hidden">
                {adding ? (
                  <Loader2 className="w-6 h-6 animate-spin text-kimaya-olive" />
                ) : (
                  <>
                    <button type="button" onClick={() => cameraInputRef.current?.click()}
                      className="flex flex-col items-center gap-1 text-kimaya-olive hover:scale-105 transition-transform">
                      <Camera size={22} />
                      <span className="text-[10px] font-medium">Kamera</span>
                    </button>
                    <span className="text-[10px] text-kimaya-brown-light/40">atau</span>
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center gap-1 text-kimaya-olive/70 hover:text-kimaya-olive">
                      <ImageIcon size={18} />
                      <span className="text-[10px] font-medium">Galeri</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple
            className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>
      </motion.div>

      {/* Submit bar — sticky on mobile */}
      <div className="fixed lg:static bottom-0 left-0 right-0 lg:mt-5 px-4 py-3 lg:p-0 bg-white lg:bg-transparent border-t lg:border-0 border-kimaya-cream-dark/30 z-30">
        <button onClick={handleSubmit} disabled={submitting || images.length === 0 || adding}
          className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition shadow-lg shadow-kimaya-olive/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {submitting ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Kirim Tanggapan"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User as UserIcon, Camera, Loader2, Check, X as XIcon, Lock, Phone, MapPin, Mail,
  Eye, EyeOff, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

interface MeData {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  address: string | null;
  avatarUrl: string | null;
  facePhotoUrl: string | null;
  role: string;
}

const MAX_AVATAR_BYTES = 2_000_000;

/** Compress to JPEG ≤ 512px @ 0.85. Returns dataURL. */
async function compressAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal baca file"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("File bukan gambar"));
      img.onload = () => {
        const MAX = 512;
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
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const [tab, setTab] = useState<"info" | "security">("info");

  // Info form
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [savingInfo, setSavingInfo] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  // Password form
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confPwd, setConfPwd] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const showToast = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (res.ok && data.user) {
        const u = data.user;
        setMe(u);
        setFullName(u.fullName || "");
        setPhone(u.phone || "");
        setAddress(u.address || "");
        setAvatar(u.avatarUrl);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const handlePickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await compressAvatar(file);
      if (url.length > MAX_AVATAR_BYTES) {
        showToast("err", "Foto profil terlalu besar setelah dikompres");
        return;
      }
      setAvatar(url);
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Gagal memproses foto");
    }
    if (e.target) e.target.value = "";
  };

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, address, avatarUrl: avatar || "" }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("ok", "Profil berhasil diperbarui");
        await refreshUser();
        await fetchMe();
      } else {
        showToast("err", data.error || "Gagal menyimpan");
      }
    } catch {
      showToast("err", "Tidak dapat terhubung ke server");
    }
    setSavingInfo(false);
  };

  const handleSavePwd = async () => {
    if (newPwd !== confPwd) { showToast("err", "Konfirmasi kata sandi tidak cocok"); return; }
    if (newPwd.length < 8) { showToast("err", "Kata sandi baru minimal 8 karakter"); return; }
    setSavingPwd(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd, confirmPassword: confPwd }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("ok", "Kata sandi berhasil diubah");
        setCurPwd(""); setNewPwd(""); setConfPwd("");
      } else {
        showToast("err", data.error || "Gagal mengubah kata sandi");
      }
    } catch {
      showToast("err", "Tidak dapat terhubung ke server");
    }
    setSavingPwd(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>;
  }
  if (!me) return null;

  const initials = me.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-5 pb-12">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={cn("fixed top-6 right-6 z-[60] px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm",
              toast.kind === "ok" ? "bg-kimaya-olive text-white" : "bg-red-500 text-white")}>
            {toast.kind === "ok" ? <Check size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <h1 className="text-2xl font-serif text-kimaya-brown">Profil Saya</h1>
        <p className="text-sm text-kimaya-brown-light/60 mt-1">
          Ubah data pribadi, foto profil, dan kata sandi
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-1 flex gap-1">
        <button onClick={() => setTab("info")}
          className={cn("flex-1 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2",
            tab === "info" ? "bg-kimaya-olive text-white shadow-md" : "text-kimaya-brown-light/60 hover:text-kimaya-brown")}>
          <UserIcon size={14} /> Data Pribadi
        </button>
        <button onClick={() => setTab("security")}
          className={cn("flex-1 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2",
            tab === "security" ? "bg-kimaya-olive text-white shadow-md" : "text-kimaya-brown-light/60 hover:text-kimaya-brown")}>
          <Lock size={14} /> Kata Sandi
        </button>
      </div>

      {tab === "info" && (
        <div className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-5 sm:p-6 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-kimaya-olive flex items-center justify-center text-white text-2xl font-semibold ring-4 ring-kimaya-cream">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt={me.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <button onClick={() => avatarRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-kimaya-olive text-white flex items-center justify-center shadow-lg hover:bg-kimaya-olive-dark transition">
                <Camera size={14} />
              </button>
              <input ref={avatarRef} type="file" accept="image/*" onChange={handlePickAvatar} className="hidden" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-kimaya-brown">{me.fullName}</p>
              <p className="text-xs text-kimaya-brown-light/60 flex items-center gap-1.5 mt-1">
                <Mail size={11} /> {me.email}
              </p>
              <p className="text-[10px] text-kimaya-olive uppercase tracking-wider font-medium mt-1.5">{me.role}</p>
              {avatar && avatar !== me.avatarUrl && (
                <button onClick={() => setAvatar(me.avatarUrl)}
                  className="text-[11px] text-kimaya-brown-light/50 hover:text-kimaya-brown mt-2 underline">
                  Batalkan perubahan foto
                </button>
              )}
            </div>
          </div>

          {/* Email read-only note */}
          <div className="rounded-xl bg-kimaya-cream/40 px-4 py-2.5 text-[11px] text-kimaya-brown-light/70 flex items-start gap-2">
            <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
            <span>Email tidak bisa diubah sendiri. Hubungi admin jika perlu mengganti email.</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nama Lengkap" required>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light/50 text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
            </Field>
            <Field label="Nomor WhatsApp" icon={<Phone size={14} />}>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+62 812 3456 7890"
                className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light/50 text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
            </Field>
          </div>

          <Field label="Alamat" icon={<MapPin size={14} />}>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3}
              placeholder="Alamat tempat tinggal"
              className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light/50 text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 resize-none" />
          </Field>

          <div className="flex justify-end">
            <motion.button whileTap={{ scale: 0.98 }} onClick={handleSaveInfo} disabled={savingInfo}
              className="px-6 py-2.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition shadow-lg shadow-kimaya-olive/20 disabled:opacity-50 flex items-center gap-2">
              {savingInfo ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Simpan Perubahan
            </motion.button>
          </div>
        </div>
      )}

      {tab === "security" && (
        <div className="bg-white rounded-2xl border border-kimaya-cream-dark/30 p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Lock size={18} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-kimaya-brown">Ubah Kata Sandi</h2>
              <p className="text-[11px] text-kimaya-brown-light/60">Gunakan kombinasi huruf, angka, dan simbol untuk keamanan</p>
            </div>
          </div>

          <Field label="Kata Sandi Saat Ini" required>
            <div className="relative">
              <input type={showCur ? "text" : "password"} value={curPwd} onChange={(e) => setCurPwd(e.target.value)}
                placeholder="Masukkan kata sandi saat ini"
                className="w-full px-4 py-3 pr-12 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light/50 text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
              <button type="button" onClick={() => setShowCur(!showCur)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-kimaya-brown-light/40 hover:text-kimaya-olive">
                {showCur ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Kata Sandi Baru" required>
              <div className="relative">
                <input type={showNew ? "text" : "password"} value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light/50 text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-kimaya-brown-light/40 hover:text-kimaya-olive">
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <Field label="Konfirmasi Kata Sandi Baru" required>
              <input type={showNew ? "text" : "password"} value={confPwd} onChange={(e) => setConfPwd(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                className={cn("w-full px-4 py-3 rounded-xl border bg-kimaya-cream-light/50 text-sm focus:outline-none focus:ring-2",
                  confPwd && newPwd !== confPwd ? "border-red-300 focus:ring-red-200" : "border-kimaya-cream-dark focus:ring-kimaya-olive/30")} />
              {confPwd && newPwd !== confPwd && (
                <p className="text-[11px] text-red-500 mt-1">Tidak cocok dengan kata sandi baru</p>
              )}
            </Field>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2">
            <a href="/forgot-password" className="text-xs text-kimaya-brown-light/60 hover:text-kimaya-olive underline">
              Lupa kata sandi?
            </a>
            <motion.button whileTap={{ scale: 0.98 }} onClick={handleSavePwd}
              disabled={savingPwd || !curPwd || !newPwd || !confPwd}
              className="px-6 py-2.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition shadow-lg shadow-kimaya-olive/20 disabled:opacity-50 flex items-center justify-center gap-2">
              {savingPwd ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              Ubah Kata Sandi
            </motion.button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Field({ label, required, icon, children }: { label: string; required?: boolean; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-kimaya-brown-light mb-1.5 flex items-center gap-1.5">
        {icon}
        <span>{label}</span>
        {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Lock, Eye, EyeOff, Check, AlertCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [pwd, setPwd] = useState("");
  const [conf, setConf] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setValid(!!d.valid))
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pwd.length < 8) { setError("Kata sandi minimal 8 karakter"); return; }
    if (pwd !== conf) { setError("Konfirmasi kata sandi tidak cocok"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: pwd, confirmPassword: conf }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push("/login"), 3000);
      } else {
        setError(data.error || "Gagal mengubah kata sandi");
      }
    } catch {
      setError("Tidak dapat terhubung ke server");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-kimaya-cream-light">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-16 h-16 rounded-full overflow-hidden shadow-lg ring-2 ring-kimaya-olive/20">
            <Image src="/icons/kimaya-icon.png" alt="Kimaya" fill sizes="64px" className="object-cover" priority />
          </div>
          <h1 className="text-xl font-serif text-kimaya-brown mt-4">Kimaya Management</h1>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-black/5 border border-kimaya-cream-dark/30 p-7">
          {checking ? (
            <div className="text-center py-8">
              <Loader2 size={28} className="animate-spin text-kimaya-olive mx-auto mb-3" />
              <p className="text-sm text-kimaya-brown-light/60">Memeriksa link…</p>
            </div>
          ) : !valid ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-500" />
              </div>
              <h2 className="text-xl font-serif text-kimaya-brown mb-2">Link Tidak Berlaku</h2>
              <p className="text-sm text-kimaya-brown-light/70 leading-relaxed">
                Link reset kata sandi ini sudah kedaluwarsa atau tidak valid.
                Minta link baru di halaman lupa kata sandi.
              </p>
              <Link href="/forgot-password"
                className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition">
                Minta Link Baru
              </Link>
            </div>
          ) : done ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-emerald-500" />
              </div>
              <h2 className="text-xl font-serif text-kimaya-brown mb-2">Kata Sandi Berhasil Diubah</h2>
              <p className="text-sm text-kimaya-brown-light/70 leading-relaxed">
                Anda akan diarahkan ke halaman masuk dalam beberapa detik…
              </p>
              <Loader2 size={20} className="animate-spin text-kimaya-olive mx-auto mt-4" />
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-serif text-kimaya-brown mb-2">Buat Kata Sandi Baru</h2>
              <p className="text-sm text-kimaya-brown-light/70 leading-relaxed mb-6">
                Pilih kata sandi yang kuat dan mudah Anda ingat.
              </p>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Kata Sandi Baru</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-kimaya-olive-light" />
                    <input type={show ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)}
                      placeholder="Minimal 8 karakter" required autoFocus
                      className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-white text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 focus:border-kimaya-olive" />
                    <button type="button" onClick={() => setShow(!show)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-kimaya-brown-light/40 hover:text-kimaya-olive">
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Konfirmasi Kata Sandi</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-kimaya-olive-light" />
                    <input type={show ? "text" : "password"} value={conf} onChange={(e) => setConf(e.target.value)}
                      placeholder="Ulangi kata sandi baru" required
                      className={cn("w-full pl-12 pr-4 py-3.5 rounded-xl border bg-kimaya-white text-sm text-kimaya-brown focus:outline-none focus:ring-2",
                        conf && pwd !== conf ? "border-red-300 focus:ring-red-200" : "border-kimaya-cream-dark focus:ring-kimaya-olive/30 focus:border-kimaya-olive")} />
                  </div>
                </div>

                <button type="submit" disabled={submitting || !pwd || !conf}
                  className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition shadow-lg shadow-kimaya-olive/20 disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                  Atur Kata Sandi Baru
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center border-t border-kimaya-cream-dark/30 pt-5">
            <Link href="/login" className="text-sm text-kimaya-brown-light/60 hover:text-kimaya-olive inline-flex items-center gap-1.5">
              <ArrowLeft size={14} /> Kembali ke Halaman Masuk
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

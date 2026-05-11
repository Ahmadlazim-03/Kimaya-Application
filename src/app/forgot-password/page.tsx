"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Mail, ArrowLeft, Check } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) setDone(true);
      else setError(data.error || "Gagal memproses permintaan");
    } catch {
      setError("Tidak dapat terhubung ke server");
    }
    setLoading(false);
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
          {!done ? (
            <>
              <h2 className="text-2xl font-serif text-kimaya-brown mb-2">Lupa Kata Sandi?</h2>
              <p className="text-sm text-kimaya-brown-light/70 leading-relaxed mb-6">
                Masukkan email akun Anda. Kami akan kirim link untuk reset kata sandi.
              </p>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Email</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-kimaya-olive-light" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com" required autoFocus
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-white text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 focus:border-kimaya-olive" />
                  </div>
                </div>

                <button type="submit" disabled={loading || !email}
                  className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition shadow-lg shadow-kimaya-olive/20 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  Kirim Link Reset
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-emerald-500" />
              </div>
              <h2 className="text-xl font-serif text-kimaya-brown mb-2">Periksa Email Anda</h2>
              <p className="text-sm text-kimaya-brown-light/70 leading-relaxed mb-2">
                Jika email <span className="font-semibold text-kimaya-brown">{email}</span> terdaftar di sistem kami,
                Anda akan menerima link reset kata sandi dalam beberapa menit.
              </p>
              <p className="text-xs text-kimaya-brown-light/50 mt-4">
                Link berlaku selama 1 jam. Cek folder Spam jika tidak menemukannya.
              </p>
            </div>
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

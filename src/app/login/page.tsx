"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError(data.error || "Login gagal");
      }
    } catch {
      setError("Tidak dapat terhubung ke server");
    }
    setLoading(false);
  };

  // Quick login cards for demo
  const demoAccounts = [
    { label: "Developer (IT)", email: "rizky@kimayaexperience.com", role: "DEVELOPER", color: "bg-blue-500" },
    { label: "Admin", email: "admin@kimayaexperience.com", role: "ADMIN", color: "bg-kimaya-olive" },
    { label: "Rina (Therapist)", email: "rina@kimayaexperience.com", role: "THERAPIST", color: "bg-purple-500" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left - Branding Panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-kimaya-brown flex-col justify-between p-12">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-kimaya-gold blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-kimaya-olive blur-[100px]" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-kimaya-cream blur-[80px]" />
        </div>

        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="leaf-pattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
              <path d="M60 10 C40 25, 20 50, 60 90 C100 50, 80 25, 60 10Z" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#leaf-pattern)" />
        </svg>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-kimaya-gold/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8 6 4 10 4 14C4 18.4183 7.58172 22 12 22C16.4183 22 20 18.4183 20 14C20 10 16 6 12 2Z" stroke="#C5A059" strokeWidth="1.5" fill="none"/>
                <path d="M12 8C10 11 8 13 8 15C8 17.2091 9.79086 19 12 19C14.2091 19 16 17.2091 16 15C16 13 14 11 12 8Z" fill="#C5A059" opacity="0.3"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-serif text-kimaya-cream tracking-wide">Kimaya</h1>
              <p className="text-xs text-kimaya-gold tracking-[0.2em] uppercase">Spa • Beauty Experience</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl xl:text-5xl font-serif text-kimaya-cream leading-tight">
            Selamat Datang di<br />
            <span className="text-kimaya-gold">Kimaya Management</span>
          </h2>
          <p className="text-kimaya-cream/70 text-lg leading-relaxed max-w-lg">
            Sistem Absensi, Reminder, Upload Bukti Report &amp; Skoring Karyawan —
            platform terintegrasi untuk mengelola kinerja tim Kimaya Experience.
          </p>
          <div className="flex gap-8 pt-4">
            <div className="text-center">
              <div className="text-3xl font-serif text-kimaya-gold">4</div>
              <div className="text-xs text-kimaya-cream/50 uppercase tracking-wider mt-1">Role</div>
            </div>
            <div className="w-px bg-kimaya-cream/10" />
            <div className="text-center">
              <div className="text-3xl font-serif text-kimaya-gold">RBAC</div>
              <div className="text-xs text-kimaya-cream/50 uppercase tracking-wider mt-1">Kontrol</div>
            </div>
            <div className="w-px bg-kimaya-cream/10" />
            <div className="text-center">
              <div className="text-3xl font-serif text-kimaya-gold">WA</div>
              <div className="text-xs text-kimaya-cream/50 uppercase tracking-wider mt-1">Integrasi</div>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-kimaya-cream/30 text-sm">
            © 2026 Kimaya Experience. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-kimaya-cream-light">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-full bg-kimaya-olive/10 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8 6 4 10 4 14C4 18.4183 7.58172 22 12 22C16.4183 22 20 18.4183 20 14C20 10 16 6 12 2Z" stroke="#5B633D" strokeWidth="1.5"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-serif text-kimaya-brown">Kimaya Management</h1>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-serif text-kimaya-brown mb-2">Masuk ke Akun</h2>
            <p className="text-kimaya-brown-light/70 text-sm">
              Silakan masukkan kredensial Anda untuk mengakses dashboard
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {error}
            </div>
          )}

          {/* Quick Login Cards */}
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-kimaya-brown-light/40 uppercase tracking-[0.15em] mb-3">Quick Login (Demo)</p>
            <div className="grid grid-cols-3 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => { setEmail(acc.email); setPassword("kimaya2026"); setError(""); }}
                  className="p-3 rounded-xl border border-kimaya-cream-dark/30 bg-white hover:bg-kimaya-cream/30 transition-all text-center group"
                >
                  <div className={`w-8 h-8 rounded-full ${acc.color} flex items-center justify-center text-white text-[10px] font-semibold mx-auto mb-1.5`}>
                    {acc.label.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                  <p className="text-[11px] font-medium text-kimaya-brown truncate">{acc.label}</p>
                  <p className="text-[9px] text-kimaya-brown-light/40 mt-0.5">{acc.role}</p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-kimaya-brown-light mb-2">Email</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-kimaya-olive-light">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="4" width="20" height="16" rx="3" /><path d="M2 7l10 6 10-6" />
                  </svg>
                </div>
                <input
                  id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@kimayaexperience.com" required
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-white text-kimaya-brown placeholder-kimaya-brown-light/40 text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 focus:border-kimaya-olive transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-kimaya-brown-light mb-2">Kata Sandi</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-kimaya-olive-light">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="11" width="18" height="11" rx="3" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  id="password" type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-white text-kimaya-brown placeholder-kimaya-brown-light/40 text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 focus:border-kimaya-olive transition-all"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-kimaya-brown-light/40 hover:text-kimaya-olive transition-colors">
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-kimaya-cream-dark text-kimaya-olive focus:ring-kimaya-olive/30" />
                <span className="text-sm text-kimaya-brown-light/70">Ingat saya</span>
              </label>
              <a href="#" className="text-sm text-kimaya-olive hover:text-kimaya-olive-dark font-medium transition-colors">Lupa kata sandi?</a>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-kimaya-olive text-kimaya-white font-medium text-sm tracking-wide hover:bg-kimaya-olive-dark active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-kimaya-olive/20">
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                  Memproses...
                </>
              ) : "Masuk"}
            </button>
          </form>

          {/* Role Info */}
          <div className="mt-8 p-4 rounded-xl bg-kimaya-cream/50 border border-kimaya-cream-dark/20">
            <p className="text-[10px] font-semibold text-kimaya-brown-light/40 uppercase tracking-[0.15em] mb-2">Role & Hak Akses</p>
            <div className="space-y-1.5">
              {[
                { role: "Developer (IT)", desc: "Akses penuh semua menu + konfigurasi sistem" },
                { role: "Admin", desc: "Monitoring, skoring, reminder, kelola karyawan (tanpa absen)" },
                { role: "Therapist", desc: "Absensi, upload laporan, lihat skor pribadi" },
              ].map((r) => (
                <div key={r.role} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-kimaya-olive mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-medium text-kimaya-brown">{r.role}</span>
                    <span className="text-xs text-kimaya-brown-light/40"> — {r.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

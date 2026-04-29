"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"employee" | "admin">("employee");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate login
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    router.push("/dashboard");
  };

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

        {/* Leaf pattern SVG overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="leaf-pattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
              <path d="M60 10 C40 25, 20 50, 60 90 C100 50, 80 25, 60 10Z" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#leaf-pattern)" />
        </svg>

        <div className="relative z-10">
          {/* Logo */}
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
            <span className="text-kimaya-gold">SIYAP</span>
          </h2>
          <p className="text-kimaya-cream/70 text-lg leading-relaxed max-w-lg">
            Sistem Absensi, Reminder, Upload Bukti Report &amp; Skoring Karyawan — 
            platform terintegrasi untuk mengelola kinerja tim Kimaya Experience.
          </p>
          <div className="flex gap-8 pt-4">
            <div className="text-center">
              <div className="text-3xl font-serif text-kimaya-gold">4</div>
              <div className="text-xs text-kimaya-cream/50 uppercase tracking-wider mt-1">Modul</div>
            </div>
            <div className="w-px bg-kimaya-cream/10" />
            <div className="text-center">
              <div className="text-3xl font-serif text-kimaya-gold">24/7</div>
              <div className="text-xs text-kimaya-cream/50 uppercase tracking-wider mt-1">Akses</div>
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
              <h1 className="text-xl font-serif text-kimaya-brown">Kimaya SIYAP</h1>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-serif text-kimaya-brown mb-2">Masuk ke Akun</h2>
            <p className="text-kimaya-brown-light/70 text-sm">
              Silakan masukkan kredensial Anda untuk mengakses dashboard
            </p>
          </div>

          {/* Role Toggle */}
          <div className="flex bg-kimaya-cream rounded-xl p-1 mb-8">
            <button
              type="button"
              onClick={() => setRole("employee")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                role === "employee"
                  ? "bg-kimaya-white text-kimaya-brown shadow-sm"
                  : "text-kimaya-brown-light/60 hover:text-kimaya-brown-light"
              }`}
            >
              Karyawan
            </button>
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                role === "admin"
                  ? "bg-kimaya-white text-kimaya-brown shadow-sm"
                  : "text-kimaya-brown-light/60 hover:text-kimaya-brown-light"
              }`}
            >
              Admin / HR
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-kimaya-brown-light mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-kimaya-olive-light">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="4" width="20" height="16" rx="3" />
                    <path d="M2 7l10 6 10-6" />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@kimayaexperience.com"
                  required
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-white text-kimaya-brown placeholder-kimaya-brown-light/40 text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 focus:border-kimaya-olive transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-kimaya-brown-light mb-2">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-kimaya-olive-light">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="11" width="18" height="11" rx="3" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-white text-kimaya-brown placeholder-kimaya-brown-light/40 text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 focus:border-kimaya-olive transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-kimaya-brown-light/40 hover:text-kimaya-olive transition-colors"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-kimaya-cream-dark text-kimaya-olive focus:ring-kimaya-olive/30"
                />
                <span className="text-sm text-kimaya-brown-light/70">Ingat saya</span>
              </label>
              <a href="#" className="text-sm text-kimaya-olive hover:text-kimaya-olive-dark font-medium transition-colors">
                Lupa kata sandi?
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-kimaya-olive text-kimaya-white font-medium text-sm tracking-wide hover:bg-kimaya-olive-dark active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-kimaya-olive/20"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                  Memproses...
                </>
              ) : (
                "Masuk"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-kimaya-cream-dark" />
            <span className="text-xs text-kimaya-brown-light/40 uppercase tracking-wider">atau</span>
            <div className="flex-1 h-px bg-kimaya-cream-dark" />
          </div>

          {/* Google SSO */}
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full py-3.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-white text-kimaya-brown font-medium text-sm hover:bg-kimaya-cream transition-all duration-200 flex items-center justify-center gap-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Masuk dengan Google
          </button>

          {/* WhatsApp login */}
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full mt-3 py-3.5 rounded-xl border border-kimaya-cream-dark bg-kimaya-white text-kimaya-brown font-medium text-sm hover:bg-kimaya-cream transition-all duration-200 flex items-center justify-center gap-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
            </svg>
            Masuk via WhatsApp OTP
          </button>
        </div>
      </div>
    </div>
  );
}

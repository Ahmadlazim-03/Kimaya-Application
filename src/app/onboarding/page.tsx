"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import dynamicImport from "next/dynamic";

const FaceDetector = dynamicImport(() => import("@/app/components/FaceDetector"), { ssr: false });

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(1); // 1: face, 2: profile
  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFaceCaptured = (photo: string) => {
    setFacePhoto(photo);
    setShowFaceCapture(false);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facePhoto) { setError("Foto wajah wajib diambil"); return; }
    if (!phone || phone.trim().length < 8) { setError("Nomor WhatsApp minimal 8 digit"); return; }
    if (!address || address.trim().length < 10) { setError("Alamat minimal 10 karakter"); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facePhoto, phone, address }),
      });
      const data = await res.json();

      if (res.ok) {
        await refreshUser();
        router.push("/dashboard");
      } else {
        setError(data.error || "Gagal menyimpan data");
      }
    } catch {
      setError("Tidak dapat terhubung ke server");
    }
    setLoading(false);
  };

  const isFormValid = facePhoto && phone.trim().length >= 8 && address.trim().length >= 10;

  return (
    <div className="min-h-screen flex">
      {/* Left - Branding Panel */}
      <div className="hidden lg:flex lg:w-[50%] relative overflow-hidden bg-kimaya-brown flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-kimaya-gold blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-kimaya-olive blur-[100px]" />
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
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-kimaya-gold/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2C8 6 4 10 4 14C4 18.4183 7.58172 22 12 22C16.4183 22 20 18.4183 20 14C20 10 16 6 12 2Z" stroke="#C5A059" strokeWidth="1.5" fill="none"/><path d="M12 8C10 11 8 13 8 15C8 17.2091 9.79086 19 12 19C14.2091 19 16 17.2091 16 15C16 13 14 11 12 8Z" fill="#C5A059" opacity="0.3"/></svg>
            </div>
            <div>
              <h1 className="text-2xl font-serif text-kimaya-cream tracking-wide">Kimaya</h1>
              <p className="text-xs text-kimaya-gold tracking-[0.2em] uppercase">Employee Management</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl xl:text-5xl font-serif text-kimaya-cream leading-tight">
            Selamat Datang,<br />
            <span className="text-kimaya-gold">{user?.fullName || "Therapist"}!</span>
          </h2>
          <p className="text-kimaya-cream/70 text-lg leading-relaxed max-w-lg">
            Lengkapi profil Anda untuk memulai. Data wajah akan digunakan untuk verifikasi identitas saat absensi harian.
          </p>

          {/* Steps indicator */}
          <div className="flex gap-6 pt-4">
            <div className={`flex items-center gap-3 ${step >= 1 ? "opacity-100" : "opacity-40"}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${step === 1 ? "bg-kimaya-gold text-kimaya-brown" : facePhoto ? "bg-kimaya-olive text-white" : "bg-kimaya-cream/20 text-kimaya-cream"}`}>
                {facePhoto ? "✓" : "1"}
              </div>
              <div>
                <p className="text-sm text-kimaya-cream font-medium">Verifikasi Wajah</p>
                <p className="text-xs text-kimaya-cream/40">Scan wajah Anda</p>
              </div>
            </div>
            <div className={`flex items-center gap-3 ${step >= 2 ? "opacity-100" : "opacity-40"}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${step === 2 ? "bg-kimaya-gold text-kimaya-brown" : "bg-kimaya-cream/20 text-kimaya-cream"}`}>
                2
              </div>
              <div>
                <p className="text-sm text-kimaya-cream font-medium">Data Profil</p>
                <p className="text-xs text-kimaya-cream/40">WhatsApp & Alamat</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-kimaya-cream/30 text-sm">© 2026 Kimaya Experience. All rights reserved.</p>
        </div>
      </div>

      {/* Right - Onboarding Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-kimaya-cream-light overflow-y-auto">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-full bg-kimaya-olive/10 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2C8 6 4 10 4 14C4 18.4183 7.58172 22 12 22C16.4183 22 20 18.4183 20 14C20 10 16 6 12 2Z" stroke="#5B633D" strokeWidth="1.5"/></svg>
            </div>
            <h1 className="text-xl font-serif text-kimaya-brown">Onboarding</h1>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-serif text-kimaya-brown mb-2">
              {step === 1 ? "Verifikasi Wajah" : "Lengkapi Profil"}
            </h2>
            <p className="text-kimaya-brown-light/70 text-sm">
              {step === 1
                ? "Ambil foto wajah Anda untuk pendaftaran identitas biometrik"
                : "Isi data profil untuk melanjutkan ke dashboard"}
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {error}
            </div>
          )}

          {/* ── STEP 1: Face Capture ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="border-2 border-dashed border-kimaya-olive/30 rounded-2xl p-8 bg-kimaya-olive/[0.03] text-center">
                {facePhoto ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-32 h-32 rounded-2xl overflow-hidden border-3 border-kimaya-olive/40 shadow-lg">
                      <img src={facePhoto} alt="Face" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-sm text-kimaya-olive font-semibold flex items-center justify-center gap-1.5">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2.5 2.5L16 9"/></svg>
                        Wajah berhasil direkam
                      </p>
                      <button type="button" onClick={() => setShowFaceCapture(true)}
                        className="text-xs text-kimaya-olive/60 hover:text-kimaya-olive mt-1.5 underline">
                        Ambil ulang
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-kimaya-olive/10 flex items-center justify-center">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#5B633D" strokeWidth="1.5">
                        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-kimaya-brown">Scan Wajah Anda</p>
                      <p className="text-xs text-kimaya-brown-light/50 mt-1">
                        Pastikan pencahayaan baik dan wajah terlihat jelas
                      </p>
                    </div>
                    <button type="button" onClick={() => setShowFaceCapture(true)}
                      className="px-6 py-3 rounded-xl bg-kimaya-olive text-white text-sm font-semibold hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center justify-center gap-2 mx-auto active:scale-[0.98]">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>
                      </svg>
                      Mulai Scan Wajah
                    </button>
                  </div>
                )}
              </div>

              {facePhoto && (
                <button type="button" onClick={() => setStep(2)}
                  className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center justify-center gap-2">
                  Lanjut ke Data Profil
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              )}
            </div>
          )}

          {/* ── STEP 2: Profile Data ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Face photo preview */}
              {facePhoto && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-kimaya-olive/5 border border-kimaya-olive/20">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-kimaya-olive/30">
                    <img src={facePhoto} alt="Face" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-kimaya-olive font-semibold flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2.5 2.5L16 9"/></svg>
                      Wajah teregistrasi
                    </p>
                    <button type="button" onClick={() => setStep(1)} className="text-[10px] text-kimaya-olive/50 hover:underline">Ubah foto</button>
                  </div>
                </div>
              )}

              {/* WhatsApp Number */}
              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-kimaya-brown-light mb-1.5">
                  Nomor WhatsApp <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-kimaya-olive-light">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.574 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+62 812-XXXX-XXXX" required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-white text-kimaya-brown placeholder-kimaya-brown-light/40 text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 focus:border-kimaya-olive transition-all" />
                </div>
                <p className="text-[10px] text-kimaya-brown-light/40 mt-1">Digunakan untuk notifikasi & reminder WhatsApp</p>
              </div>

              {/* Address */}
              <div>
                <label htmlFor="address" className="block text-xs font-medium text-kimaya-brown-light mb-1.5">
                  Alamat Lengkap <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-3 text-kimaya-olive-light">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)}
                    placeholder="Jl. Contoh No. 123, Kelurahan, Kecamatan, Kota, Provinsi" required rows={3}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-white text-kimaya-brown placeholder-kimaya-brown-light/40 text-sm focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30 focus:border-kimaya-olive transition-all resize-none" />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)}
                  className="px-4 py-3 rounded-xl border border-kimaya-cream-dark text-kimaya-brown-light text-sm font-medium hover:bg-kimaya-cream transition-all">
                  ← Kembali
                </button>
                <button type="submit" disabled={loading || !isFormValid}
                  className="flex-1 py-3 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      Selesai & Masuk Dashboard
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Face Detector Modal */}
      {showFaceCapture && (
        <FaceDetector
          mode="register"
          onCapture={handleFaceCaptured}
          onClose={() => setShowFaceCapture(false)}
        />
      )}
    </div>
  );
}

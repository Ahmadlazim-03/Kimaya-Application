"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Bell, Camera, MapPin, CheckCircle2, ChevronRight, X } from "lucide-react";

const STORAGE_KEY = "kimaya_permissions_requested_v1";

type PermStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported";

interface PermState {
  notifications: PermStatus;
  camera: PermStatus;
  location: PermStatus;
}

const STEPS: Array<{
  key: keyof PermState;
  icon: React.ReactNode;
  title: string;
  desc: string;
  why: string;
  color: string;
  bgColor: string;
}> = [
  {
    key: "notifications",
    icon: <Bell size={26} />,
    title: "Notifikasi Push",
    desc: "Terima reminder dan pengingat langsung di HP",
    why: "Agar Anda tidak melewatkan tugas, reminder dari manager, dan update absensi.",
    color: "text-kimaya-olive",
    bgColor: "bg-kimaya-olive/10",
  },
  {
    key: "camera",
    icon: <Camera size={26} />,
    title: "Kamera",
    desc: "Digunakan untuk verifikasi wajah saat absensi",
    why: "Sistem absensi membutuhkan foto wajah untuk konfirmasi kehadiran.",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    key: "location",
    icon: <MapPin size={26} />,
    title: "Lokasi (GPS)",
    desc: "Pastikan absensi dilakukan di lokasi kerja",
    why: "Validasi geofencing memastikan check-in hanya bisa dilakukan di area spa.",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
];

export default function PermissionSetup() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0); // 0 = welcome, 1-3 = each perm, 4 = done
  const [perms, setPerms] = useState<PermState>({
    notifications: "idle",
    camera: "idle",
    location: "idle",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only show on mobile / PWA
    const isPWA = window.matchMedia("(display-mode: standalone)").matches;
    const isMobile = window.innerWidth < 1024;
    if (!isPWA && !isMobile) return;
    // Only show once per install
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }, []);

  const requestNotifications = async (): Promise<PermStatus> => {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    try {
      const result = await Notification.requestPermission();
      return result === "granted" ? "granted" : "denied";
    } catch {
      return "denied";
    }
  };

  const requestCamera = async (): Promise<PermStatus> => {
    if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      return "granted";
    } catch {
      return "denied";
    }
  };

  const requestLocation = async (): Promise<PermStatus> => {
    if (!navigator.geolocation) return "unsupported";
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve("granted"),
        () => resolve("denied"),
        { timeout: 8000 }
      );
    });
  };

  const handleRequest = async () => {
    if (step === 0) { setStep(1); return; }

    const current = STEPS[step - 1];
    setPerms((p) => ({ ...p, [current.key]: "requesting" }));

    let result: PermStatus;
    if (current.key === "notifications") result = await requestNotifications();
    else if (current.key === "camera") result = await requestCamera();
    else result = await requestLocation();

    setPerms((p) => ({ ...p, [current.key]: result }));

    // Move to next step after short delay
    setTimeout(() => {
      if (step < STEPS.length) {
        setStep((s) => s + 1);
      } else {
        setStep(4);
      }
    }, 600);
  };

  const handleSkip = () => {
    if (step < STEPS.length) {
      setPerms((p) => ({ ...p, [STEPS[step - 1].key]: "denied" }));
      if (step < STEPS.length) setStep((s) => s + 1);
      else setStep(4);
    }
  };

  if (!visible) return null;

  const isDone = step === 4 || (step === 0 && false);
  const currentStep = step > 0 && step <= STEPS.length ? STEPS[step - 1] : null;
  const progress = step === 0 ? 0 : Math.round((step / STEPS.length) * 100);

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm">
      <div className="w-full sm:max-w-sm bg-kimaya-cream-light rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up">

        {/* Progress bar */}
        {step > 0 && !isDone && (
          <div className="h-1 bg-kimaya-cream-dark/30">
            <div
              className="h-full bg-kimaya-olive transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="p-6">
          {/* Close button (only visible from step 2+) */}
          {step > 1 && !isDone && (
            <button onClick={dismiss} className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-black/5 text-kimaya-brown-light/50">
              <X size={18} />
            </button>
          )}

          {/* ── Welcome screen ── */}
          {step === 0 && (
            <div className="text-center py-2">
              <div className="flex justify-center mb-5">
                <div className="relative w-20 h-20 rounded-full overflow-hidden shadow-lg ring-4 ring-kimaya-gold/30">
                  <Image src="/icons/kimaya-icon.png" alt="Kimaya" fill sizes="80px" className="object-cover" />
                </div>
              </div>
              <h2 className="text-xl font-serif text-kimaya-brown mb-2">Selamat Datang!</h2>
              <p className="text-sm text-kimaya-brown-light/70 leading-relaxed mb-6">
                Untuk pengalaman terbaik, aplikasi Kimaya memerlukan beberapa izin.
                Kami akan meminta satu per satu.
              </p>
              <div className="flex flex-col gap-2 mb-6">
                {STEPS.map((s) => (
                  <div key={s.key} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${s.bgColor}`}>
                    <span className={s.color}>{s.icon}</span>
                    <span className="text-sm text-kimaya-brown font-medium">{s.title}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleRequest}
                className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-semibold text-sm hover:bg-kimaya-olive-dark transition-colors flex items-center justify-center gap-2"
              >
                Mulai Pengaturan <ChevronRight size={16} />
              </button>
              <button onClick={dismiss} className="mt-3 text-xs text-kimaya-brown-light/50 hover:text-kimaya-brown-light">
                Lewati untuk sekarang
              </button>
            </div>
          )}

          {/* ── Per-permission step ── */}
          {currentStep && !isDone && (
            <div className="text-center py-2">
              <div className={`w-16 h-16 rounded-2xl ${currentStep.bgColor} flex items-center justify-center mx-auto mb-4`}>
                <span className={currentStep.color}>{currentStep.icon}</span>
              </div>
              <p className="text-xs text-kimaya-olive font-medium tracking-wide mb-1">
                {step} / {STEPS.length}
              </p>
              <h2 className="text-xl font-serif text-kimaya-brown mb-2">{currentStep.title}</h2>
              <p className="text-sm text-kimaya-brown-light/70 leading-relaxed mb-2">
                {currentStep.desc}
              </p>
              <p className="text-xs text-kimaya-brown-light/50 bg-kimaya-cream px-3 py-2 rounded-xl leading-relaxed mb-6">
                💡 {currentStep.why}
              </p>

              {perms[currentStep.key] === "granted" ? (
                <div className="flex items-center justify-center gap-2 py-3 text-emerald-600">
                  <CheckCircle2 size={20} />
                  <span className="font-medium text-sm">Izin diberikan!</span>
                </div>
              ) : perms[currentStep.key] === "denied" ? (
                <div className="text-sm text-red-500 py-2">
                  Izin ditolak — bisa diubah nanti di pengaturan browser.
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={handleRequest}
                    disabled={perms[currentStep.key] === "requesting"}
                    className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-semibold text-sm hover:bg-kimaya-olive-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {perms[currentStep.key] === "requesting" ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.3" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                        </svg>
                        Menunggu...
                      </>
                    ) : (
                      <>Izinkan {currentStep.title} <ChevronRight size={16} /></>
                    )}
                  </button>
                  <button
                    onClick={handleSkip}
                    disabled={perms[currentStep.key] === "requesting"}
                    className="w-full py-2.5 rounded-xl border border-kimaya-cream-dark/50 text-kimaya-brown-light/60 text-sm hover:bg-kimaya-cream transition-colors"
                  >
                    Lewati
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Done screen ── */}
          {isDone && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <h2 className="text-xl font-serif text-kimaya-brown mb-2">Siap Digunakan!</h2>
              <p className="text-sm text-kimaya-brown-light/70 leading-relaxed mb-2">
                Pengaturan izin selesai. Izin yang ditolak bisa diaktifkan kapan saja melalui pengaturan browser.
              </p>
              <div className="flex flex-col gap-1.5 mb-6 text-left">
                {STEPS.map((s) => {
                  const st = perms[s.key];
                  return (
                    <div key={s.key} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-kimaya-cream">
                      <span className={st === "granted" ? "text-emerald-500" : "text-gray-300"}>
                        <CheckCircle2 size={16} />
                      </span>
                      <span className={`text-xs font-medium ${st === "granted" ? "text-kimaya-brown" : "text-kimaya-brown-light/40"}`}>
                        {s.title} {st === "granted" ? "✓" : st === "unsupported" ? "(tidak didukung perangkat ini)" : "(dilewati)"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={dismiss}
                className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-semibold text-sm hover:bg-kimaya-olive-dark transition-colors"
              >
                Mulai Menggunakan Aplikasi
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.35s cubic-bezier(0.34, 1.25, 0.64, 1) both; }
      `}</style>
    </div>
  );
}

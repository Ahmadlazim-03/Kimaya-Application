"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Animated splash screen shown on PWA cold-start.
 *
 * Only visible when running as an installed PWA (display-mode: standalone)
 * OR on a narrow mobile viewport (< 768 px). On desktop browser it is skipped
 * because the page loads fast enough that a splash would be distracting.
 *
 * Auto-dismisses after ~2.2 s with a fade-out. Unmounts from DOM after the
 * fade so it does not block interaction.
 */
export default function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isPWA = window.matchMedia("(display-mode: standalone)").matches;
    const isMobile = window.innerWidth < 768;

    // Show only for PWA or mobile viewport; skip for desktop browser.
    if (!isPWA && !isMobile) {
      setShouldShow(false);
      return;
    }

    setShouldShow(true);

    // Logo flies in: 0 → 800 ms
    // Logo holds: 800 → 1600 ms
    // Start fade: 1600 ms
    // Fully gone + unmount: 2100 ms
    const fadeTimer = setTimeout(() => setPhase("fading"), 1600);
    const doneTimer = setTimeout(() => setPhase("gone"), 2100);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (!shouldShow || phase === "gone") return null;

  return (
    <div
      aria-hidden="true"
      style={{ transition: "opacity 500ms ease" }}
      className={[
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center",
        "bg-kimaya-brown",
        phase === "fading" ? "opacity-0" : "opacity-100",
      ].join(" ")}
    >
      {/* Soft radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-kimaya-gold/10 blur-[80px]" />
      </div>

      {/* Logo mark — bounces in */}
      <div
        style={{
          animation: "splash-logo 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
        className="relative flex flex-col items-center gap-6"
      >
        {/* Icon */}
        <div className="relative w-28 h-28">
          <div className="absolute inset-0 rounded-full bg-kimaya-gold/20 blur-xl scale-125" />
          <div className="relative w-full h-full rounded-full overflow-hidden shadow-2xl">
            <Image
              src="/icons/kimaya-icon.png"
              alt="Kimaya"
              fill
              sizes="112px"
              className="object-cover"
              priority
            />
          </div>
        </div>

        {/* Word-mark */}
        <div className="text-center" style={{ animation: "splash-text 0.5s 0.35s ease both" }}>
          <p className="text-3xl font-serif text-kimaya-cream tracking-widest">Kimaya</p>
          <p className="text-[11px] text-kimaya-gold tracking-[0.35em] uppercase mt-1">
            Spa &bull; Beauty Experience
          </p>
        </div>
      </div>

      {/* Bottom loading dots */}
      <div
        className="absolute bottom-16 flex gap-2"
        style={{ animation: "splash-text 0.4s 0.6s ease both" }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-kimaya-gold/60"
            style={{ animation: `dot-pulse 1.2s ${i * 0.2}s ease-in-out infinite` }}
          />
        ))}
      </div>

      {/* Keyframe injections via inline style tag */}
      <style>{`
        @keyframes splash-logo {
          from { opacity: 0; transform: scale(0.65) translateY(20px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes splash-text {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dot-pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

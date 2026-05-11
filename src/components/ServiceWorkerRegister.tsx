"use client";

import { useEffect } from "react";

/**
 * Explicit Service Worker registrar.
 *
 * Why this exists:
 * `@ducanh2912/next-pwa` is supposed to auto-inject a registration script into
 * the HTML head. With Next 16 App Router + Turbopack that injection is flaky —
 * the script either never runs, or runs too late on iOS PWAs that boot
 * straight into a cached `start_url`. The symptom: `navigator.serviceWorker.ready`
 * hangs forever and our NotificationSubscriptionCard reports "SW belum aktif"
 * after its 6s timeout, while desktop browsers (which still pick up the script
 * fine) work normally.
 *
 * Fix: register `/sw.js` ourselves, idempotently, from a client component
 * mounted in the root layout. Safe to call repeatedly — the browser dedupes
 * by scope+script URL.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) {
      console.log("[SW] navigator.serviceWorker unavailable, skipping");
      return;
    }
    // Push API requires a secure context. Avoid spamming console errors on
    // plain-HTTP LAN testing.
    if (!window.isSecureContext) {
      console.warn(
        `[SW] insecure context (${window.location.origin}) — skipping SW register; Push needs HTTPS`
      );
      return;
    }

    let cancelled = false;

    const register = async () => {
      try {
        // Was the SW already registered (by next-pwa auto-injector, or a
        // previous mount)? If so, just log and return.
        const existing = await navigator.serviceWorker.getRegistration("/");
        if (existing && existing.active) {
          if (!cancelled) console.log("[SW] already active, scope:", existing.scope);
          return;
        }

        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none", // always re-fetch sw.js, never use HTTP cache
        });
        if (cancelled) return;

        console.log("[SW] registered, scope:", reg.scope, "state:", {
          installing: !!reg.installing,
          waiting: !!reg.waiting,
          active: !!reg.active,
        });

        // When a new SW finishes installing, force-activate so installed PWAs
        // don't get stuck on the previous version.
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            console.log("[SW] new worker state:", nw.state);
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              // There's an old SW controlling the page. Tell the new one to
              // skip waiting (our worker already calls skipWaiting on install,
              // but this is a belt-and-suspenders for older registrations).
              try { nw.postMessage({ type: "SKIP_WAITING" }); } catch {}
            }
          });
        });

        // Trigger an update check on mount — useful when the user re-opens
        // an installed PWA after we shipped a new SW.
        try { await reg.update(); } catch { /* network blip, ignore */ }
      } catch (err) {
        console.error("[SW] register failed:", err);
      }
    };

    // Defer slightly so the rest of the page can mount first (iOS PWA cold
    // start is fragile if you hit serviceWorker.register during hydration).
    const t = setTimeout(register, 100);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  return null;
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Bell, BellOff, BellRing, Check, AlertCircle, Loader2, Send, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Persistent notification subscription card.
 *
 * Unlike the floating banner in PushSubscriptionManager, this card is
 * always visible on a page (e.g. /dashboard/reminders/my) so the user
 * can:
 *   - See whether their device is subscribed (real DB state, not just browser)
 *   - Manually trigger subscribe if auto-subscribe failed
 *   - Send a test push to verify end-to-end delivery
 *   - Read the specific error if subscribe / push fails
 */

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

type Status =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "insecure-context" }
  | { kind: "sw-not-ready" }
  | { kind: "denied" }
  | { kind: "needs-permission" }
  | { kind: "needs-subscribe" }
  | { kind: "subscribed" }
  | { kind: "error"; message: string };

/** Race a promise against a timeout. Throws "TIMEOUT" if the timeout fires first. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`TIMEOUT: ${label}`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export default function NotificationSubscriptionCard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [serverSubs, setServerSubs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState("");

  const refreshServerStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/push/diagnose");
      if (res.ok) {
        const data = await res.json();
        setServerSubs(data.me.subscriptions);
        return data.me.subscriptions as number;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  const detect = useCallback(async () => {
    console.log("[NotifCard] detect() running, user:", user?.id || "null");

    if (typeof window === "undefined") {
      console.log("[NotifCard] no window — SSR");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("[NotifCard] browser doesn't support SW or PushManager");
      setStatus({ kind: "unsupported" });
      return;
    }

    // Push API requires a secure context. localhost counts as secure; HTTP via
    // LAN IP does not. On phones over HTTP, navigator.serviceWorker.ready can
    // hang forever, so detect this first.
    if (typeof window.isSecureContext !== "undefined" && !window.isSecureContext) {
      console.warn(
        `[NotifCard] not a secure context (origin=${window.location.origin}) — Push API disabled`
      );
      setStatus({ kind: "insecure-context" });
      return;
    }

    if (!user) {
      console.log("[NotifCard] user not loaded yet, staying in loading state");
      setStatus({ kind: "loading" });
      return;
    }

    try {
      // navigator.serviceWorker.ready hangs forever if the SW never registers
      // (e.g., next-pwa is still warming up, or registration silently failed
      // on this device). Cap at 6s so we can show a helpful error instead.
      let registration: ServiceWorkerRegistration;
      try {
        registration = await withTimeout(navigator.serviceWorker.ready, 6000, "serviceWorker.ready");
        console.log("[NotifCard] SW ready:", registration.scope);
      } catch (timeoutErr) {
        console.error("[NotifCard]", timeoutErr);
        // Try one fallback: see if any registration exists at all.
        const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
        console.log("[NotifCard] existing registrations:", regs.length);
        setStatus({ kind: "sw-not-ready" });
        return;
      }

      const browserSub = await registration.pushManager.getSubscription();
      const serverCount = await refreshServerStatus();
      const perm = Notification.permission;
      console.log("[NotifCard] state →", { perm, browserSub: !!browserSub, serverCount });

      if (perm === "denied") return setStatus({ kind: "denied" });

      if (browserSub && serverCount && serverCount > 0) return setStatus({ kind: "subscribed" });

      if (browserSub && (!serverCount || serverCount === 0)) {
        console.log("[NotifCard] resyncing browser sub to server");
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(browserSub),
        });
        if (res.ok) {
          await refreshServerStatus();
          return setStatus({ kind: "subscribed" });
        }
        return setStatus({ kind: "error", message: `Sinkronisasi server gagal (HTTP ${res.status})` });
      }

      if (perm === "default") return setStatus({ kind: "needs-permission" });
      return setStatus({ kind: "needs-subscribe" });
    } catch (err) {
      console.error("[NotifCard] detect() failed:", err);
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Gagal mengecek status notifikasi" });
    }
  }, [user, refreshServerStatus]);

  useEffect(() => { detect(); }, [detect]);

  // Watch for permission flip from another tab / settings.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    let removed = false;
    navigator.permissions.query({ name: "notifications" as PermissionName })
      .then((s) => {
        const handler = () => { if (!removed) detect(); };
        s.addEventListener("change", handler);
        return () => { removed = true; s.removeEventListener("change", handler); };
      })
      .catch(() => { /* ignore */ });
  }, [detect]);

  const subscribe = async () => {
    setBusy(true);
    setTestResult("");
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setStatus({ kind: "error", message: "VAPID public key tidak ditemukan di build. Hubungi admin untuk rebuild dengan .env yang benar." });
        setBusy(false);
        return;
      }

      // Permission first.
      if (Notification.permission === "default") {
        const result = await Notification.requestPermission();
        if (result === "denied") { setStatus({ kind: "denied" }); setBusy(false); return; }
        if (result !== "granted") { setBusy(false); return; }
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Drop any subscription that uses a different VAPID key.
        const expected = urlBase64ToUint8Array(publicKey);
        const existing = subscription.options.applicationServerKey;
        const same =
          existing instanceof ArrayBuffer &&
          new Uint8Array(existing).every((v, i) => v === expected[i]);
        if (!same) {
          await subscription.unsubscribe();
          subscription = null;
        }
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setStatus({ kind: "error", message: `Server menolak subscription (HTTP ${res.status}). ${txt.slice(0, 80)}` });
        setBusy(false);
        return;
      }

      await refreshServerStatus();
      setStatus({ kind: "subscribed" });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Subscribe gagal" });
    }
    setBusy(false);
  };

  const sendTest = async () => {
    setBusy(true);
    setTestResult("");
    try {
      const res = await fetch("/api/push/test", { method: "POST", body: JSON.stringify({}), headers: { "Content-Type": "application/json" } });
      const json = await res.json();
      setTestResult(json.summary || json.error || "Tidak ada respons");
    } catch (err) {
      setTestResult(`❌ ${err instanceof Error ? err.message : "Gagal connect"}`);
    }
    setBusy(false);
  };

  const reset = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        // Unsubscribe locally and notify server.
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
    } catch { /* ignore */ }
    setBusy(false);
    detect();
  };

  // Always render SOMETHING — never silently disappear, otherwise user can't
  // tell whether the card failed to load or simply isn't needed.
  if (status.kind === "loading") {
    return (
      <div className="bg-white border border-kimaya-cream-dark/30 rounded-2xl p-4 flex items-center gap-3">
        <Loader2 size={18} className="animate-spin text-kimaya-brown-light/40" />
        <p className="text-xs text-kimaya-brown-light/60">Mengecek status notifikasi…</p>
      </div>
    );
  }
  if (status.kind === "unsupported") {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-start gap-3">
        <BellOff size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-gray-700">Browser tidak mendukung Push Notification</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Buka aplikasi ini di Chrome, Edge, Firefox, atau Safari (iOS 16.4+) yang sudah di-install ke home screen.
          </p>
        </div>
      </div>
    );
  }

  if (status.kind === "insecure-context") {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return (
      <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle size={20} className="text-orange-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-orange-700">Push butuh HTTPS / localhost</p>
          <p className="text-[11px] text-orange-700/80 mt-1 leading-relaxed break-words">
            Anda mengakses via <code className="bg-white px-1 rounded">{origin}</code>. Browser tidak izinkan Push Notification di luar HTTPS atau <code>localhost</code>. Untuk mobile:
          </p>
          <ul className="text-[11px] text-orange-700/80 mt-1.5 space-y-0.5 list-disc pl-4">
            <li>Setup reverse proxy (Nginx/Caddy) dengan SSL cert (Let&apos;s Encrypt)</li>
            <li>Atau pakai tunnel sementara (cloudflared / ngrok https URL)</li>
            <li>Atau test dari laptop pakai localhost</li>
          </ul>
        </div>
      </div>
    );
  }

  if (status.kind === "sw-not-ready") {
    return (
      <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-700">Service Worker belum aktif</p>
            <p className="text-[11px] text-orange-700/80 mt-1 leading-relaxed">
              Service Worker tidak siap dalam 6 detik. Penyebab umum:
            </p>
            <ul className="text-[11px] text-orange-700/80 mt-1.5 space-y-0.5 list-disc pl-4">
              <li>PWA cache versi lama — tutup penuh aplikasi/tab, lalu buka lagi</li>
              <li>Build belum include service worker — pastikan sudah <code>docker compose up -d --build</code></li>
              <li>Akses lewat HTTP dari LAN — Push butuh HTTPS</li>
            </ul>
            <button onClick={() => detect()} disabled={busy}
              className="mt-2 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-1.5">
              <RefreshCw size={12} /> Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render variants ──
  if (status.kind === "subscribed") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <BellRing size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-700">Notifikasi push aktif</p>
          <p className="text-[11px] text-emerald-600/80">
            {serverSubs ?? 0} device terdaftar · Anda akan terima push saat reminder dikirim
          </p>
        </div>
        <button onClick={sendTest} disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-700 text-xs font-medium hover:bg-emerald-50 disabled:opacity-50 flex items-center gap-1.5"
          title="Kirim test push ke device ini">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Test
        </button>
        {testResult && (
          <div className="absolute right-4 top-full mt-2 max-w-xs bg-white border border-emerald-200 rounded-xl px-3 py-2 text-[11px] text-kimaya-brown shadow-lg z-10">
            {testResult}
          </div>
        )}
      </div>
    );
  }

  if (status.kind === "denied") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
          <BellOff size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-700">Notifikasi diblokir browser</p>
          <p className="text-[11px] text-red-600/80 mt-0.5">
            Buka pengaturan browser/aplikasi → izinkan notifikasi untuk situs ini → kembali ke halaman ini → klik tombol di bawah untuk daftar ulang.
          </p>
          <button onClick={reset} disabled={busy}
            className="mt-2 px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-700 text-xs font-medium hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1.5">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Cek ulang
          </button>
        </div>
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-700">Notifikasi belum siap</p>
            <p className="text-[11px] text-amber-700/80 mt-0.5 break-words">{status.message}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={subscribe} disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5">
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
                Coba Aktifkan Lagi
              </button>
              <button onClick={reset} disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-50 disabled:opacity-50 flex items-center gap-1.5">
                <RefreshCw size={12} /> Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // needs-permission OR needs-subscribe
  const isPermission = status.kind === "needs-permission";
  return (
    <div className={cn("rounded-2xl p-4 border-2",
      isPermission ? "bg-blue-50 border-blue-300" : "bg-amber-50 border-amber-300")}>
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
          isPermission ? "bg-blue-500" : "bg-amber-500")}>
          <Bell size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-semibold", isPermission ? "text-blue-700" : "text-amber-700")}>
            {isPermission ? "Aktifkan Notifikasi Push" : "Selesaikan pendaftaran notifikasi"}
          </p>
          <p className={cn("text-[11px] mt-0.5", isPermission ? "text-blue-600/80" : "text-amber-700/80")}>
            {isPermission
              ? "Klik tombol di bawah untuk izinkan notifikasi. Anda akan menerima push langsung di HP saat ada reminder atau tugas baru."
              : "Izin sudah diberikan, tapi device belum terdaftar di server. Klik untuk selesaikan pendaftaran sekali."}
          </p>
          <button onClick={subscribe} disabled={busy}
            className={cn("mt-2.5 px-4 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-2",
              isPermission ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700")}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
            {isPermission ? "Aktifkan Notifikasi" : "Daftarkan Device"}
          </button>
        </div>
      </div>
    </div>
  );
}

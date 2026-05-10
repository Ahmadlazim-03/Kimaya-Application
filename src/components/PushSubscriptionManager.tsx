"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { BellOff, Bell } from "lucide-react";

// Utility to convert Base64 URL to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushSubscriptionManager() {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");
  const [showBlockedHint, setShowBlockedHint] = useState(false);

  const subscribe = useCallback(async () => {
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        console.error("[Push] VAPID public key not found in NEXT_PUBLIC_VAPID_PUBLIC_KEY");
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      // If an old subscription exists from a different VAPID key, drop it.
      if (subscription) {
        const existingKey = subscription.options.applicationServerKey;
        const expected = urlBase64ToUint8Array(publicKey);
        const same =
          existingKey instanceof ArrayBuffer &&
          new Uint8Array(existingKey).every((v, i) => v === expected[i]);
        if (!same) {
          console.warn("[Push] Existing subscription uses different VAPID key, re-subscribing");
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

      if (res.ok) {
        setIsSubscribed(true);
        console.log("[Push] Subscription saved to server");
        return true;
      }
      const errBody = await res.text().catch(() => "");
      console.error("[Push] Failed to save subscription to server:", res.status, errBody);
      return false;
    } catch (err) {
      console.error("[Push] subscribe() failed:", err);
      return false;
    }
  }, []);

  const checkSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);

      // If logged in & permission already granted but no subscription,
      // (re-)subscribe automatically. This handles:
      //   - First load after permission was granted on another tab
      //   - Subscription expired / dropped
      //   - User cleared site data
      if (!subscription && Notification.permission === "granted") {
        await subscribe();
      }
    } catch (err) {
      console.error("[Push] checkSubscription() failed:", err);
    }
  }, [subscribe]);

  // ── Lifecycle ──
  // Re-runs whenever the logged-in user changes (avoids stale-closure bug
  // where user was null at first mount).
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setIsSupported(false);
      return;
    }
    setPermission(Notification.permission);
    if (user) {
      checkSubscription();
    }
  }, [user, checkSubscription]);

  // Listen for permission changes (some browsers expose this via Permissions API)
  useEffect(() => {
    let cancelled = false;
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions.query({ name: "notifications" as PermissionName })
      .then((status) => {
        const handler = () => {
          if (cancelled) return;
          setPermission(Notification.permission);
          if (Notification.permission === "granted" && user) {
            checkSubscription();
          }
        };
        status.addEventListener("change", handler);
        return () => status.removeEventListener("change", handler);
      })
      .catch(() => { /* not supported, ignore */ });
    return () => { cancelled = true; };
  }, [user, checkSubscription]);

  if (!isSupported || !user) return null;
  if (isSubscribed === null) return null; // still checking

  // Already subscribed → render nothing.
  if (isSubscribed) return null;

  const handleEnable = async () => {
    if (Notification.permission === "denied") {
      setShowBlockedHint(true);
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      await subscribe();
    } else if (result === "denied") {
      setShowBlockedHint(true);
    }
  };

  // Permission denied — show a blocked-hint card so user knows to fix in browser settings.
  if (permission === "denied" || showBlockedHint) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border border-red-200 shadow-xl rounded-2xl p-4 flex flex-col gap-3 z-50">
        <div className="flex items-start gap-3">
          <BellOff size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-kimaya-brown">Notifikasi Diblokir</h4>
            <p className="text-xs text-kimaya-brown-light/70 mt-1">
              Aktifkan notifikasi di pengaturan browser/aplikasi agar bisa menerima reminder. Cari ikon kunci di address bar → Site settings → Notifications → Allow.
            </p>
          </div>
        </div>
        <button onClick={() => setShowBlockedHint(false)}
          className="self-end text-xs text-kimaya-brown-light/60 hover:text-kimaya-brown">
          Tutup
        </button>
      </div>
    );
  }

  // Permission default OR granted-but-not-subscribed → show enable banner.
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border border-kimaya-cream-dark/50 shadow-xl rounded-2xl p-4 flex flex-col gap-3 z-50">
      <div className="flex items-start gap-3">
        <Bell size={20} className="text-kimaya-olive flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-kimaya-brown">Nyalakan Notifikasi</h4>
          <p className="text-xs text-kimaya-brown-light/70 mt-1">
            Dapatkan pemberitahuan langsung di HP Anda ketika ada reminder atau tugas baru.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={handleEnable}
          className="bg-kimaya-olive text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-kimaya-olive-dark">
          Aktifkan Notifikasi
        </button>
      </div>
    </div>
  );
}

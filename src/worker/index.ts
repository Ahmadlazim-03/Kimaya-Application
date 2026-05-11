/// <reference lib="webworker" />
export {};

// The project tsconfig includes the DOM lib, which already types `self` as
// Window & typeof globalThis. We can't redeclare it, so we re-cast to the
// service-worker scope inside this module instead.
const sw = self as unknown as ServiceWorkerGlobalScope;

// Force this SW to skip the "waiting" phase. Without this, when we deploy a
// new build, installed PWAs on phones keep using the OLD (possibly broken)
// SW until every window is fully swipe-killed — which users almost never do.
sw.addEventListener("install", () => {
  sw.skipWaiting();
});

// Allow the client (ServiceWorkerRegister) to nudge a waiting SW to activate
// on demand — used when a new SW installed but old one still controls page.
sw.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    sw.skipWaiting();
  }
});

// As soon as this SW activates, claim every open client so they start using
// it immediately (no need to reload the page). Pairs with skipWaiting above.
sw.addEventListener("activate", (event) => {
  event.waitUntil(sw.clients.claim());
});

// Listen for push events
sw.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    // Default vibration pattern (strong vibration)
    const vibrate = [500, 250, 500, 250, 1000];

    event.waitUntil(
      sw.registration.showNotification(data.title || "Kimaya Management", {
        body: data.body || "Anda memiliki notifikasi baru",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        // `vibrate` & `requireInteraction` are valid Notification options in
        // browsers but not always in lib.dom NotificationOptions; widen here.
        ...({
          vibrate: data.vibrate || vibrate,
          requireInteraction: true,
        } as NotificationOptions),
        data: data.data || { url: "/dashboard" },
      })
    );
  } catch (err) {
    console.error("Push event data error:", err);
  }
});

// Listen for notification clicks
sw.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (sw.clients.openWindow) {
        return sw.clients.openWindow(urlToOpen);
      }
    })
  );
});

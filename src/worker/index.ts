/// <reference lib="webworker" />
export {};

// The project tsconfig includes the DOM lib, which already types `self` as
// Window & typeof globalThis. We can't redeclare it, so we re-cast to the
// service-worker scope inside this module instead.
const sw = self as unknown as ServiceWorkerGlobalScope;

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

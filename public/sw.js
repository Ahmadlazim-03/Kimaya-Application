/// Service Worker for Kimaya PWA — Push Notifications & Offline Support
/// This file is served directly from /public so no build step is needed.

// Force this SW to skip the "waiting" phase immediately.
self.addEventListener("install", function (event) {
    self.skipWaiting();
});

// Claim all open clients as soon as we activate.
self.addEventListener("activate", function (event) {
    event.waitUntil(self.clients.claim());
});

// Listen for manual skip-waiting messages.
self.addEventListener("message", function (event) {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

// ── Push Notification Handler ──
self.addEventListener("push", function (event) {
    if (!event.data) return;

    try {
        var data = event.data.json();

        var vibrate = [500, 250, 500, 250, 1000];

        var options = {
            body: data.body || "Anda memiliki notifikasi baru",
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-192x192.png",
            vibrate: data.vibrate || vibrate,
            requireInteraction: true,
            data: data.data || { url: "/dashboard" },
        };

        event.waitUntil(
            self.registration.showNotification(data.title || "Kimaya Management", options)
        );
    } catch (err) {
        console.error("Push event data error:", err);
    }
});

// ── Notification Click Handler ──
self.addEventListener("notificationclick", function (event) {
    event.notification.close();

    var urlToOpen = event.notification.data && event.notification.data.url
        ? event.notification.data.url
        : "/dashboard";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windowClients) {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url.indexOf(urlToOpen) !== -1 && "focus" in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});

import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  customWorkerSrc: "src/worker",
  disable: process.env.NODE_ENV === "development",
  // We register the SW manually via src/components/ServiceWorkerRegister.tsx
  // because next-pwa's auto-injection is unreliable with Next 16 App Router +
  // Turbopack (especially on iOS standalone PWAs). Setting this false avoids
  // double-registration races.
  register: false,
  // Critical for installed PWAs on phones: when a new SW is built and deployed,
  // the old one sits in `waiting` state until every tab/PWA window is fully
  // closed. On installed PWAs users rarely swipe-kill, so they're stuck on the
  // old SW (which may be the broken HTTP-era registration). skipWaiting forces
  // the new SW to activate immediately, and reloadOnOnline picks up server
  // changes when the device reconnects.
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
  },
  reloadOnOnline: true,
  // Do NOT cache the auth/me, push subscribe, or any /api/* response — these
  // must always hit the server. next-pwa caches API routes by default and that
  // can break login + push diagnose readings.
  cacheStartUrl: false,
  dynamicStartUrl: false,
});

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {},
};

export default withPWA(nextConfig);

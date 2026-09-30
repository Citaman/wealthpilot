"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // A production worker previously registered on localhost keeps controlling
      // the origin after switching back to `next dev`. Its cache-first scripts can
      // then hydrate fresh SSR HTML with an obsolete client bundle.
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      );
      if ("caches" in window) {
        void caches.keys().then((keys) =>
          Promise.all(keys.filter((key) => key.startsWith("wealthpilot-sw-")).map((key) => caches.delete(key)))
        );
      }
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((err) => {
        logger.warn("[WealthPilot] Service worker registration failed", err);
      });
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";
import { BUILD_ID } from "@/lib/build-id";

/**
 * A PWA launched from the Home Screen keeps running whatever JavaScript it
 * booted with — a deploy while it sits in the app switcher leaves it half old,
 * half new, and client-side navigation starts failing silently (buttons that
 * "do nothing"). This watches a tiny version stamp on the server and reloads
 * once when it changes, so the app is never more than one foregrounding behind
 * the deploy.
 */
export function VersionWatch() {
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    let last = 0;
    const check = async () => {
      if (Date.now() - last < 30_000) return; // don't hammer on rapid tab flips
      last = Date.now();
      try {
        const res = await fetch(`${base}/version.txt`, { cache: "no-store" });
        if (!res.ok) return;
        const remote = (await res.text()).trim();
        if (!remote || remote === BUILD_ID) return;
        // reload once per new version — a loop guard for half-deployed states
        const k = "societee.reloaded-for";
        if (window.sessionStorage.getItem(k) === remote) return;
        window.sessionStorage.setItem(k, remote);
        window.location.reload();
      } catch { /* offline on the course — fine */ }
    };
    void check();
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";

/** Registers the offline service worker. No-op where SWs can't run (plain
 *  http over the LAN, the native shell's custom scheme). */
export function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});
  }, []);
  return null;
}

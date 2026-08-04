import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * Every LAN address this machine currently has.
 *
 * The dev server blocks cross-origin requests to /_next/* by default, so
 * opening the site on a phone at http://192.168.x.x:3000 serves the HTML but
 * refuses the JavaScript — the page renders and then does nothing, with no
 * error on screen to explain it. Allowing our own LAN addresses fixes that,
 * and computing them means it keeps working when the router hands out a new IP.
 */
function lanAddresses(): string[] {
  const out = new Set<string>();
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) out.add(a.address);
    }
  }
  return [...out];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: [...lanAddresses(), "*.local"],
};

export default nextConfig;

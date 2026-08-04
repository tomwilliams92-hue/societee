import type { MetadataRoute } from "next";

// The manifest never changes at runtime. Saying so lets the whole app be
// exported as static files, which is what a native iOS shell has to bundle.
export const dynamic = "force-static";

// GitHub Pages serves this from /<repo>/, so icon and start URLs need that
// prefix. Empty for the normal web build and for the native iOS bundle.
const BASE = process.env.PAGES_BASE_PATH ?? "";

/**
 * Makes "Add to Home Screen" produce something that looks and behaves like an
 * app: own icon, no Safari chrome, dark theme, portrait.
 *
 * `display: "standalone"` is the bit that matters — without it iOS opens the
 * link in Safari with the address bar visible and it reads as a website.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Societee — golf society scoring",
    short_name: "Societee",
    description:
      "Live hole-by-hole scoring and a leaderboard on a QR code. No sign-up for anyone but the organiser.",
    start_url: `${BASE}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#06080a",
    theme_color: "#06080a",
    categories: ["sports"],
    icons: [
      { src: `${BASE}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${BASE}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

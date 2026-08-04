import type { MetadataRoute } from "next";

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
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#06080a",
    theme_color: "#06080a",
    categories: ["sports"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

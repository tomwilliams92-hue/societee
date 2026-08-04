import type { NextConfig } from "next";

/**
 * Build config for the native iOS shell only.
 *
 * `output: "export"` writes plain HTML/JS/CSS into out/, which Capacitor copies
 * into the app bundle. The web build (next.config.ts) keeps server rendering.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,   // /society/index.html — the shape a file:// bundle needs
};

export default nextConfig;

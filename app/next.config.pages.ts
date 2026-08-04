import type { NextConfig } from "next";

/**
 * Build for GitHub Pages.
 *
 * Pages serves a project site from /<repo>/, so every asset and link needs that
 * prefix or the page loads as unstyled text. Same static export as the iOS
 * build otherwise.
 */
const base = process.env.PAGES_BASE_PATH ?? "";
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: base || undefined,
  assetPrefix: base || undefined,
};
export default nextConfig;

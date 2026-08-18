import type { Metadata, Viewport } from "next";
import { Archivo, Azeret_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { ScrollReset } from "@/components/ScrollReset";
import { SWRegister } from "@/components/SWRegister";
import { SyncBoot } from "@/components/SyncBoot";
import { AuthGate } from "@/components/AuthGate";
import { VersionWatch } from "@/components/VersionWatch";

/** Set only for the GitHub Pages build, which serves from /<repo>/. */
const BASE = process.env.PAGES_BASE_PATH ?? "";

/**
 * One family doing all the work, using its width axis: condensed and heavy for
 * headlines and scores, near-normal for body. That width shift is what makes
 * broadcast sports graphics feel like a system rather than a pile of fonts.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const monoTech = Azeret_Mono({
  variable: "--font-mono-tech",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Societee — run your golf society without the spreadsheets",
  description:
    "Live hole-by-hole scoring, a leaderboard on a QR code, and no sign-up for anyone but you.",
  applicationName: "Societee",
  // Added to the Home Screen, iOS uses these: full-screen, dark status bar,
  // and the short name under the icon rather than the long page title.
  appleWebApp: {
    capable: true,
    title: "Societee",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: `${BASE}/icon-192.png`, sizes: "192x192", type: "image/png" }],
    apple: [{ url: `${BASE}/apple-icon.png`, sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#06080a",
  // The scorer screen is used one-handed on a fairway; stop iOS zooming when a
  // thumb lands near a stepper, and keep content clear of the home indicator.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-GB"
      className={`${archivo.variable} ${monoTech.variable} h-full antialiased`}
    >
      <body>
        {/* keeps the system clock readable whatever scrolls beneath it */}
        <div aria-hidden className="statusbar-scrim" />
        {/* the app scrolls inside this shell — see .app-scroll in globals.css */}
        <div id="app-scroll" className="app-scroll">
          <AuthGate>{children}</AuthGate>
          <BottomNav />
          <ScrollReset />
        </div>
        <SWRegister />
        <SyncBoot />
        <VersionWatch />
      </body>
    </html>
  );
}

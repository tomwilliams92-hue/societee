import type { Metadata, Viewport } from "next";
import { Archivo, Azeret_Mono } from "next/font/google";
import "./globals.css";

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
};

export const viewport: Viewport = {
  themeColor: "#06080a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-GB"
      className={`${archivo.variable} ${monoTech.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

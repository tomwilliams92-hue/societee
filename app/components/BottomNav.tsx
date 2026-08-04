"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDB, useReady, select } from "@/lib/store";

/**
 * The bottom tab bar — the single strongest "this is an app" signal on iOS.
 *
 * Organiser screens only. The guest screens (/live-board, /scorecard) stay
 * chrome-free on purpose: a spectator scanned a QR code to see a leaderboard,
 * not to be given navigation into somebody else's admin.
 *
 * Squabbit's most-quoted complaint is that reaching the round being played
 * right now takes up to seven levels ("I literally give up eight times out of
 * ten"). So when a day is live, it's a permanent tab. One tap, from anywhere.
 */
export function BottomNav() {
  const db = useDB();
  const ready = useReady();
  const path = usePathname();

  // Guest screens keep zero chrome.
  if (path.startsWith("/live-board") || path.startsWith("/scorecard")) return null;
  if (!ready) return null;

  const live = db.events.find((e) => e.status === "live");
  const liveSociety = live ? db.societies.find((s) => s.id === live.societyId) : undefined;
  const season = db.societies[0] ? select.currentSeason(db, db.societies[0].id) : undefined;
  const seasonSociety = season ? db.societies.find((s) => s.id === season.societyId) : db.societies[0];

  const items: { href: string; label: string; icon: React.ReactNode; on: boolean; live?: boolean }[] = [
    { href: "/", label: "Home", icon: <HomeIcon />, on: path === "/" },
  ];
  if (seasonSociety) {
    items.push({
      href: `/society?s=${seasonSociety.slug}`,
      label: "Season",
      icon: <TrophyIcon />,
      on: path.startsWith("/society"),
    });
  }
  if (live) {
    items.push({
      href: `/event?e=${live.id}`,
      label: "Live day",
      icon: <FlagIcon />,
      on: path.startsWith("/event"),
      live: true,
    });
    items.push({
      href: `/live-board?b=${live.shareToken}`,
      label: "Board",
      icon: <BoardIcon />,
      on: false,
    });
  }

  return (
    <>
      {/* spacer so page content never hides behind the fixed bar */}
      <div className="h-16" aria-hidden />
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-[rgba(6,8,10,0.92)] backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {items.map((it) => (
            <Link
              key={it.label}
              href={it.href}
              className="relative flex min-w-[4.5rem] flex-col items-center gap-1 px-3 pb-2 pt-2.5"
              style={{ color: it.on ? "var(--color-acid)" : "var(--color-dim)" }}
            >
              {it.live && !it.on && (
                <span className="absolute right-3 top-2 h-1.5 w-1.5 rounded-full bg-[var(--color-live)]" />
              )}
              {it.icon}
              <span className="label !text-[0.58rem]" style={{ color: "inherit" }}>
                {it.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

const I = { width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function HomeIcon() {
  return <svg {...I}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
}
function TrophyIcon() {
  return <svg {...I}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M6 3h12v6a6 6 0 0 1-12 0Z" /><path d="M6 5H3v2a3 3 0 0 0 3 3" /><path d="M18 5h3v2a3 3 0 0 1-3 3" /></svg>;
}
function FlagIcon() {
  return <svg {...I}><path d="M5 21V4" /><path d="M5 4c4-2 7 2 14 0v9c-7 2-10-2-14 0" /></svg>;
}
function BoardIcon() {
  return <svg {...I}><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M7 9h6" /><path d="M7 13h8" /><path d="M7 17h4" /></svg>;
}

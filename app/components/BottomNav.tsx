"use client";

import Link from "next/link";
import { Suspense } from "react";
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
function BottomNavInner() {
  const db = useDB();
  const ready = useReady();
  const path = usePathname();

  // Guest screens keep zero chrome.
  if (path.startsWith("/live-board") || path.startsWith("/scorecard")) return null;
  if (!ready) return null;

  const live = select.liveToday(db);
  const next = live ? undefined : select.nextUp(db);
  const dayEvent = live ?? next;
  const dayLabel = live
    ? "Today"
    : next
      ? new Date(next.playsOn + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })
      : "Today";


  // FIVE slots, ALWAYS, in the same order. Tabs that don't apply right now dim
  // out instead of disappearing — a bar that reshuffles between screens reads
  // as the app moving the furniture while you're in the room.
  const items: { href: string; label: string; icon: React.ReactNode; on: boolean; live?: boolean; off?: boolean }[] = [
    { href: "/", label: "Home", icon: <HomeIcon />, on: path === "/" },
    {
      href: "/groups",
      label: "Groups",
      icon: <GroupsIcon />,
      on: path.startsWith("/groups") || path.startsWith("/society"),
    },
    {
      href: dayEvent ? `/event?e=${dayEvent.id}` : "/",
      label: dayLabel,
      icon: <FlagIcon />,
      on: path.startsWith("/event"),
      live: Boolean(live),
      off: !dayEvent,
    },
    { href: "/profile", label: "Profile", icon: <PersonIcon />, on: path.startsWith("/profile") },
  ];

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
              aria-disabled={it.off}
              className="relative flex min-w-[4.2rem] flex-col items-center gap-1 px-2 pb-2 pt-2.5"
              style={{
                color: it.on ? "var(--color-acid)" : "var(--color-dim)",
                opacity: it.off ? 0.32 : 1,
                pointerEvents: it.off ? "none" : undefined,
              }}
            >
              {it.live && !it.off && !it.on && (
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

export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavInner />
    </Suspense>
  );
}

function HomeIcon() {
  return <svg {...I}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
}
function GroupsIcon() {
  return <svg {...I}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" /><circle cx="17.5" cy="9.5" r="2.6" /><path d="M16 14.6c3 .3 5.5 2 5.5 4.9" /></svg>;
}
function FlagIcon() {
  return <svg {...I}><path d="M5 21V4" /><path d="M5 4c4-2 7 2 14 0v9c-7 2-10-2-14 0" /></svg>;
}
function PersonIcon() {
  return <svg {...I}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>;
}

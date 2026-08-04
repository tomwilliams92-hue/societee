"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crest } from "@/components/Crest";
import { ScorecardModal } from "@/components/Scorecard";
import { useDB, select } from "@/lib/store";
import { formatPlayingHandicap, liveTotals, rank } from "@/lib/scoring";
import { courseById, teeById } from "@/lib/courses";

/**
 * The QR-code destination — the screen 24 golfers stare at for four hours.
 *
 * Mid-round it shows a running total AND how many holes each player has played,
 * because a bare number is misleading when half the field is still out there.
 */
export function PublicBoard({ token }: { token: string }) {
  const db = useDB();
  const ev = select.eventByToken(db, token);
  const router = useRouter();
  const [now, setNow] = useState("");
  const [canBack, setCanBack] = useState(false);
  const [cardFor, setCardFor] = useState<string | null>(null);

  useEffect(() => setCanBack(window.history.length > 1), []);

  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  if (!ev) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-center">
        <div>
          <Crest size={48} />
          <h1 className="display mt-4 text-2xl">That board isn’t live</h1>
          <p className="label mt-2">The link may have expired, or the day hasn’t started.</p>
        </div>
      </main>
    );
  }

  const society = db.societies.find((s) => s.id === ev.societyId)!;
  const course = courseById(ev.courseId);
  const tee = teeById(ev.teeId);
  const entries = select.entries(db, ev.id);
  const sideComps = select.sideComps(db, ev.id);
  const card = select.card(db, ev.teeId);
  const byHole = Boolean(card);

  const rows = rank(
    entries.map((en) => {
      const player = db.players.find((p) => p.id === en.playerId)!;
      const round = select.roundsForEvent(db, ev.id).find((r) => r.playerId === en.playerId);
      const holes = select.holesFor(db, ev.id, en.playerId);
      const live = byHole && holes.length
        ? liveTotals(holes, card!, en.playingHandicap ?? 0)
        : null;
      return {
        en, player,
        points: live ? live.points : round?.stableford ?? null,
        thru: live ? live.thru : round?.stableford != null ? 18 : 0,
        gross: live ? live.strokes : round?.gross ?? null,
      };
    }),
    (r) => (r.thru === 0 ? null : r.points)
  );

  const started = rows.filter((r) => r.thru > 0).length;

  return (
    <main className="flex-1 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-xl">
        {/* ------------------------------------------------- ticker head -- */}
        <header className="rise">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {canBack && (
                <button
                  onClick={() => router.back()}
                  aria-label="Back"
                  className="grid h-9 w-9 place-items-center rounded-full border"
                  style={{ borderColor: "var(--color-acid)", color: "var(--color-acid)", background: "rgba(47,219,0,0.08)" }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18 9 12l6-6" /></svg>
                </button>
              )}
              <Crest size={26} />
              <span className="label">{society.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {ev.status === "live" && (
                <span className="chip chip-live"><span className="pulse" /> Live</span>
              )}
              <span className="mono text-[0.75rem] text-[var(--color-dim)]">{now}</span>
            </div>
          </div>

          <h1 className="display mt-4 text-[clamp(1.7rem,6vw,2.5rem)]">{ev.name}</h1>
          <p className="label mt-2">
            {course?.name} · {tee?.name} · Par {tee?.par} · {started} of {entries.length} away
          </p>
        </header>

        {/* ------------------------------------------------------- board -- */}
        <div className="board mt-6 rise" style={{ animationDelay: "90ms" }}>
          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2.5">
            <span className="label">Stableford</span>
            <span className="label">{byHole ? "Thru · Pts" : "Points"}</span>
          </div>

          {rows.map((r, i) => (
            <div
              key={r.en.id}
              onClick={() => setCardFor(r.player.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") setCardFor(r.player.id); }}
              className={
                "board-row rise cursor-pointer" +
                (r.position === 1 && r.thru > 0 ? " lead" : "") +
                (r.thru === 0 ? " out" : "")
              }
              style={{ animationDelay: `${120 + Math.min(i, 16) * 30}ms` }}
            >
              <span className="pos">{r.thru === 0 ? "–" : `${r.position}${r.tied ? "=" : ""}`}</span>
              <span className="min-w-0">
                <span className="nm block truncate">{r.player.name}</span>
                <span className="label mt-0.5 block">
                  {r.thru === 0
                    ? `still out · HCP ${formatPlayingHandicap(r.en.playingHandicap)}`
                    : `${byHole ? `thru ${r.thru}` : `${r.gross} gross`} · HCP ${formatPlayingHandicap(r.en.playingHandicap)}`}
                </span>
              </span>
              <span className="pts">{r.thru === 0 ? "–" : r.points}</span>
            </div>
          ))}
        </div>

        {/* --------------------------------------------------- side pots -- */}
        {sideComps.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {sideComps.map((sc, i) => {
              const winner = db.players.find((p) => p.id === sc.winnerId);
              return (
                <div
                  key={sc.id}
                  className="card feed rise px-3 py-3"
                  style={{ animationDelay: `${300 + i * 50}ms` }}
                >
                  <p className="label">
                    {sc.kind === "ntp" ? "Nearest the pin" : "Longest drive"}
                    {sc.hole ? ` · hole ${sc.hole}` : ""}
                  </p>
                  <p className="name mt-1 text-[1.05rem]">{winner?.name ?? "Not won"}</p>
                  {sc.detail && <p className="mono mt-0.5 text-[0.8rem] text-[var(--color-dim)]">{sc.detail}</p>}
                </div>
              );
            })}
          </div>
        )}

        {cardFor && (
          <ScorecardModal eventId={ev.id} playerId={cardFor} onClose={() => setCardFor(null)} />
        )}

        <footer className="mt-8 text-center">
          <Link href="/" className="label">Powered by Societee</Link>
        </footer>
      </div>
    </main>
  );
}

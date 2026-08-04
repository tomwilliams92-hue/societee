"use client";

import Link from "next/link";
import { useState } from "react";
import { Crest } from "@/components/Crest";
import { useDB, select, actions } from "@/lib/store";
import { courseById, teeById } from "@/lib/courses";
import { formatPlayingHandicap, holePoints, liveTotals, strokesOnHole } from "@/lib/scoring";

/**
 * The on-course screen. One fourball, one hole at a time, one phone.
 *
 * Designed for a thumb in wind and sunlight: no typing, no menus, nothing to
 * read. Big steppers, one hole per screen, and the points update as you tap so
 * nobody has to trust the maths later.
 */
export function GroupScorer({ token }: { token: string }) {
  const db = useDB();
  const group = select.groupByToken(db, token);
  const ev = group ? select.event(db, group.eventId) : undefined;
  const [hole, setHole] = useState<number | null>(null);

  if (!group || !ev) return <Dead>That scoring link isn’t live.</Dead>;

  const tee = teeById(ev.teeId);
  const course = courseById(ev.courseId);
  const players = select.groupPlayers(db, ev.id, group.groupNo);
  const current = hole ?? group.startHole;

  const card = select.card(db, ev.teeId);
  if (!card) {
    return (
      <Dead>
        <span className="text-[var(--color-text)]">
          {course?.name} hasn’t got a scorecard in Societee yet.
        </span>
        <br />
        Hole-by-hole scoring needs the real par and stroke index for all 18 holes — without them
        the points would be wrong. Your organiser can still take totals at the end.
      </Dead>
    );
  }

  const info = card.find((h) => h.hole === current)!;

  const go = (n: number) => setHole(((n - 1 + 18) % 18) + 1);
  const done = players.every(
    (p) => select.holesFor(db, ev.id, p.player.id).some((h) => h.hole === current)
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-6">
      {/* ---------------------------------------------------------- head -- */}
      <header className="flex items-center justify-between gap-3 py-4">
        <Link href={`/live-board?b=${ev.shareToken}`} className="flex items-center gap-2">
          <Crest size={22} />
          <span className="label">Group {group.groupNo}</span>
        </Link>
        <span className="label">{ev.name}</span>
      </header>

      {/* ------------------------------------------------- hole selector -- */}
      <div className="card flex items-center justify-between px-3 py-3">
        <button className="step" onClick={() => go(current - 1)} aria-label="Previous hole">
          ‹
        </button>
        <div className="text-center">
          <div className="label">Hole</div>
          <div className="num text-[2.1rem] leading-none">{current}</div>
          <div className="label mt-1">
            Par {info.par} · SI {info.strokeIndex}
          </div>
        </div>
        <button className="step" onClick={() => go(current + 1)} aria-label="Next hole">
          ›
        </button>
      </div>

      {/* Card overview: one cell per hole, lit when the whole group is in.
          Tap any cell to jump — no paging through nine holes to fix the 3rd. */}
      <div className="holes mt-2">
        {card.map((h) => {
          const complete = players.length > 0 && players.every((p) =>
            select.holesFor(db, ev.id, p.player.id).some((x) => x.hole === h.hole)
          );
          return (
            <button
              key={h.hole}
              className={`hole-cell ${complete ? "played" : "blank"}`}
              style={h.hole === current ? { outline: "1.5px solid var(--color-acid)" } : undefined}
              onClick={() => setHole(h.hole)}
              aria-label={`Go to hole ${h.hole}`}
            >
              {h.hole}
            </button>
          );
        })}
      </div>

      {/* ----------------------------------------------------- the four -- */}
      <div className="mt-3 flex flex-col gap-2">
        {players.map(({ entry, player }) => {
          const ph = entry.playingHandicap ?? 0;
          const holes = select.holesFor(db, ev.id, player.id);
          const thisHole = holes.find((h) => h.hole === current);
          const strokes = thisHole?.strokes ?? null;
          const shots = strokesOnHole(ph, info.strokeIndex);
          const pts = holePoints(strokes, info.par, info.strokeIndex, ph);
          const totals = liveTotals(holes, card, ph);

          const set = (v: number | null) =>
            actions.setHoleScore(ev.id, player.id, current, v);

          return (
            <div key={entry.id} className="card px-3 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="name truncate text-[1.05rem]">{player.name}</span>
                <span className="label shrink-0">
                  off {formatPlayingHandicap(ph)}
                  {shots > 0 && <span className="text-[var(--color-acid)]"> · {"•".repeat(Math.min(shots, 3))}</span>}
                  {shots < 0 && <span className="text-[var(--color-live)]"> · gives 1</span>}
                </span>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <button
                  className="step"
                  onClick={() => set(strokes == null ? info.par : Math.max(1, strokes - 1))}
                  aria-label={`One fewer for ${player.name}`}
                >
                  −
                </button>

                <div className="grid flex-1 place-items-center">
                  <span
                    className="num text-[1.9rem] leading-none"
                    style={{ color: strokes == null ? "var(--color-line)" : "var(--color-text)" }}
                  >
                    {strokes ?? "–"}
                  </span>
                  <span className="label mt-1">
                    {strokes == null ? "not in" : `${pts ?? 0} point${pts === 1 ? "" : "s"}`}
                  </span>
                </div>

                <button
                  className="step"
                  onClick={() => set(strokes == null ? info.par : strokes + 1)}
                  aria-label={`One more for ${player.name}`}
                >
                  +
                </button>
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-[var(--line-soft)] pt-2">
                <span className="label">
                  Thru {totals.thru} · {totals.strokes} strokes
                </span>
                <span className="num text-[1.05rem]" style={{ color: "var(--color-acid)" }}>
                  {totals.points} pts
                </span>
              </div>

              {strokes != null && (
                <button className="label mt-1.5 underline underline-offset-4" onClick={() => set(null)}>
                  Clear
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* --------------------------------------------------------- next -- */}
      <div className="mt-4 flex gap-2">
        <Link href={`/live-board?b=${ev.shareToken}`} className="btn btn-ghost flex-1">
          Leaderboard
        </Link>
        <button className={`btn flex-1 ${done ? "btn-primary" : "btn-ghost"}`} onClick={() => go(current + 1)}>
          Next hole ›
        </button>
      </div>

      <p className="label mt-4 text-center">
        Scores save as you tap. Anyone with this link can score for group {group.groupNo}.
      </p>
    </main>
  );
}

function Dead({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-8 text-center">
      <div>
        <Crest size={44} />
        <p className="mt-4 max-w-sm text-[var(--color-dim)]">{children}</p>
      </div>
    </main>
  );
}

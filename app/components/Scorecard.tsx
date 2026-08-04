"use client";

import { useDB, select } from "@/lib/store";
import { formatPlayingHandicap, holePoints, strokesOnHole } from "@/lib/scoring";

/**
 * One player's full card, in the notation every golfer already reads:
 * circle birdie, double-circle eagle, square bogey, double-square worse.
 *
 * This is also where the tee's arithmetic becomes visible per hole — the shot
 * dots show exactly where the handicap is given, and the points column shows
 * what each hole was worth. The answer to "how have I got 31?" is this screen.
 */
export function ScorecardModal({
  eventId,
  playerId,
  onClose,
}: {
  eventId: string;
  playerId: string;
  onClose: () => void;
}) {
  const db = useDB();
  const ev = select.event(db, eventId);
  const player = db.players.find((p) => p.id === playerId);
  const entry = db.entries.find((e) => e.eventId === eventId && e.playerId === playerId);
  const card = select.card(db, ev?.teeId);
  const holes = ev && player ? select.holesFor(db, eventId, playerId) : [];
  const round = db.rounds.find((r) => r.eventId === eventId && r.playerId === playerId);

  if (!ev || !player) return null;
  const ph = entry?.playingHandicap ?? 0;

  const row = (h: { hole: number; par: number; strokeIndex: number }) => {
    const s = holes.find((x) => x.hole === h.hole)?.strokes ?? null;
    const shots = strokesOnHole(ph, h.strokeIndex);
    const pts = holePoints(s, h.par, h.strokeIndex, ph);
    const diff = s == null ? null : s - h.par;
    const mk =
      diff == null ? "" :
      diff <= -2 ? "mk-eagle" :
      diff === -1 ? "mk-birdie" :
      diff === 0 ? "" :
      diff === 1 ? "mk-bogey" : "mk-double";
    return { ...h, s, shots, pts, mk };
  };

  const nine = (from: number) => (card ?? []).filter((h) => h.hole >= from && h.hole < from + 9).map(row);
  const front = nine(1);
  const back = nine(10);
  const sum = (rows: ReturnType<typeof row>[], k: "s" | "pts") =>
    rows.reduce((a, r) => a + ((r[k] as number | null) ?? 0), 0);
  const played = (rows: ReturnType<typeof row>[]) => rows.filter((r) => r.s != null).length;

  const Nine = ({ rows, title }: { rows: ReturnType<typeof row>[]; title: string }) => (
    <div>
      <div className="grid grid-cols-[2rem_2.2rem_1fr_2.4rem_2.4rem] items-center gap-x-1 border-b border-[var(--color-line)] pb-1">
        <span className="label !text-[0.58rem]">{title}</span>
        <span className="label !text-[0.58rem] text-center">Par·SI</span>
        <span className="label !text-[0.58rem]">Shots</span>
        <span className="label !text-[0.58rem] text-center">Gross</span>
        <span className="label !text-[0.58rem] text-center">Pts</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.hole}
          className="grid grid-cols-[2rem_2.2rem_1fr_2.4rem_2.4rem] items-center gap-x-1 border-b border-[var(--line-soft)] py-[0.32rem]"
        >
          <span className="num text-[0.85rem] text-[var(--color-dim)]">{r.hole}</span>
          <span className="mono text-center text-[0.68rem] text-[var(--color-dim)]">
            {r.par}·{r.strokeIndex}
          </span>
          <span className="text-[0.7rem] tracking-[0.15em]" style={{ color: "var(--color-acid)" }}>
            {r.shots > 0 ? "●".repeat(Math.min(r.shots, 4)) : r.shots < 0 ? <span style={{ color: "var(--color-live)" }}>gives 1</span> : ""}
          </span>
          <span className={`mk ${r.mk}`} style={r.s == null ? { color: "var(--color-line)" } : undefined}>
            {r.s ?? "–"}
          </span>
          <span
            className="num text-center text-[0.95rem]"
            style={{ color: r.pts == null ? "var(--color-line)" : r.pts === 0 ? "var(--color-dim)" : "var(--color-text)" }}
          >
            {r.pts ?? "–"}
          </span>
        </div>
      ))}
      <div className="grid grid-cols-[2rem_2.2rem_1fr_2.4rem_2.4rem] items-center gap-x-1 py-1.5">
        <span className="label !text-[0.58rem]">{title === "Out" ? "OUT" : "IN"}</span>
        <span />
        <span />
        <span className="num text-center text-[0.95rem]">{played(rows) ? sum(rows, "s") : "–"}</span>
        <span className="num text-center text-[0.95rem]" style={{ color: "var(--color-acid)" }}>
          {played(rows) ? sum(rows, "pts") : "–"}
        </span>
      </div>
    </div>
  );

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-label={`${player.name}'s scorecard`}>
      <div
        className="card max-h-[88vh] w-full max-w-sm overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] pb-3">
          <div className="min-w-0">
            <h3 className="name truncate text-[1.1rem]">{player.name}</h3>
            <p className="label mt-1">
              HCP {formatPlayingHandicap(ph)} · {ev.name}
            </p>
          </div>
          <button className="btn btn-ghost !min-h-[2.2rem] !px-2.5 !text-[0.7rem]" onClick={onClose}>
            Close
          </button>
        </div>

        {!card ? (
          <p className="py-6 text-center text-[0.85rem] text-[var(--color-dim)]">
            No scorecard on file for this course yet.
          </p>
        ) : holes.length === 0 ? (
          <div className="py-6 text-center">
            {round?.gross != null ? (
              <>
                <p className="num text-[2rem]" style={{ color: "var(--color-acid)" }}>
                  {round.stableford} pts
                </p>
                <p className="label mt-1">{round.gross} gross</p>
                <p className="mx-auto mt-3 max-w-[30ch] text-[0.8rem] leading-relaxed text-[var(--color-dim)]">
                  Entered as a total. Hole-by-hole appears here when the group scores live on the
                  course.
                </p>
              </>
            ) : (
              <p className="text-[0.85rem] text-[var(--color-dim)]">Still out — no card yet.</p>
            )}
          </div>
        ) : (
          <>
            <div className="mt-3 grid gap-4">
              <Nine rows={front} title="Out" />
              <Nine rows={back} title="In" />
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t border-[var(--color-line)] pt-2.5">
              <span className="label">Total</span>
              <span className="num text-[1.05rem]">
                {sum([...front, ...back], "s")} gross ·{" "}
                <span style={{ color: "var(--color-acid)" }}>{sum([...front, ...back], "pts")} pts</span>
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="label !text-[0.55rem]"><span className="mk mk-birdie !inline-grid !h-4 !w-4 !text-[0.5rem]"> </span> birdie</span>
              <span className="label !text-[0.55rem]"><span className="mk mk-eagle !inline-grid !h-4 !w-4 !text-[0.5rem]"> </span> eagle</span>
              <span className="label !text-[0.55rem]"><span className="mk mk-bogey !inline-grid !h-4 !w-4 !text-[0.5rem]"> </span> bogey</span>
              <span className="label !text-[0.55rem]"><span className="mk mk-double !inline-grid !h-4 !w-4 !text-[0.5rem]"> </span> double+</span>
              <span className="label !text-[0.55rem]" style={{ color: "var(--color-acid)" }}>● shot received</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

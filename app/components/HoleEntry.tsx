"use client";

import { useDB, select, actions } from "@/lib/store";
import { formatPlayingHandicap, holePoints, strokesOnHole } from "@/lib/scoring";

/**
 * The organiser's way in: one player's card, entered HOLE BY HOLE — the same
 * Out/In grid as the read-only scorecard, with a stepper on every hole. Points
 * appear per hole as the strokes go in, so the working is visible while you
 * type the card in, not just after. Totals fall out of the holes; they are
 * never typed.
 *
 * Needs the tee's real card (par + stroke index per hole) — without it there is
 * no honest per-hole answer, and the event page falls back to gross totals.
 */
export function HoleEntryModal({
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

  if (!ev || !player || !card) return null;
  const ph = entry?.playingHandicap ?? 0;

  const strokesAt = (hole: number) => holes.find((x) => x.hole === hole)?.strokes ?? null;
  // 1–15 strokes a hole. Below 1 is impossible; above 15 is a picked-up ball.
  const set = (hole: number, v: number | null) =>
    actions.setHoleScore(ev.id, player.id, hole, v == null ? null : Math.max(1, Math.min(15, v)));

  const row = (h: { hole: number; par: number; strokeIndex: number }) => {
    const s = strokesAt(h.hole);
    const shots = strokesOnHole(ph, h.strokeIndex);
    return { ...h, s, shots, net: s == null ? null : s - shots, pts: holePoints(s, h.par, h.strokeIndex, ph) };
  };
  const nine = (from: number) => card.filter((h) => h.hole >= from && h.hole < from + 9).map(row);
  const front = nine(1);
  const back = nine(10);
  const sum = (rows: ReturnType<typeof row>[], k: "s" | "net" | "pts") =>
    rows.reduce((a, r) => a + ((r[k] as number | null) ?? 0), 0);
  const played = (rows: ReturnType<typeof row>[]) => rows.filter((r) => r.s != null).length;

  const COLS = "grid-cols-[1.4rem_2.6rem_1fr_7.2rem_2rem_2rem]";
  const Nine = ({ rows, title }: { rows: ReturnType<typeof row>[]; title: string }) => (
    <div>
      <div className={`grid ${COLS} items-center gap-x-1 border-b border-[var(--color-line)] pb-1`}>
        <span className="label !text-[0.58rem]">{title}</span>
        <span className="label !text-[0.58rem] text-center">Par·SI</span>
        <span className="label !text-[0.58rem]">Shots</span>
        <span className="label !text-[0.58rem] text-center">Gross</span>
        <span className="label !text-[0.58rem] text-center">Net</span>
        <span className="label !text-[0.58rem] text-center">Pts</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.hole}
          className={`grid ${COLS} items-center gap-x-1 border-b border-[var(--line-soft)] py-1`}
        >
          <span className="num text-[0.85rem] text-[var(--color-dim)]">{r.hole}</span>
          <span className="mono text-center text-[0.68rem] text-[var(--color-dim)]">
            {r.par}·{r.strokeIndex}
          </span>
          <span className="text-[0.7rem] tracking-[0.15em]" style={{ color: "var(--color-acid)" }}>
            {r.shots > 0 ? "●".repeat(Math.min(r.shots, 4)) : r.shots < 0 ? <span style={{ color: "var(--color-live)" }}>gives 1</span> : ""}
          </span>
          <span className="flex items-center justify-center gap-1">
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-[var(--color-line)] text-[1rem]"
              onClick={() => set(r.hole, r.s == null ? r.par : Math.max(1, r.s - 1))}
              aria-label={`One fewer on hole ${r.hole}`}
            >
              −
            </button>
            <button
              className="num w-[1.9rem] text-center text-[1.1rem]"
              style={{ color: r.s == null ? "var(--color-line)" : "var(--color-text)" }}
              onClick={() => set(r.hole, null)}
              title="Tap to clear"
              aria-label={`Clear hole ${r.hole}`}
            >
              {r.s ?? "–"}
            </button>
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-[var(--color-line)] text-[1rem]"
              onClick={() => set(r.hole, r.s == null ? r.par : r.s + 1)}
              aria-label={`One more on hole ${r.hole}`}
            >
              +
            </button>
          </span>
          <span
            className="num text-center text-[0.95rem]"
            style={{ color: r.net == null ? "var(--color-line)" : "var(--color-text)" }}
          >
            {r.net ?? "–"}
          </span>
          <span
            className="num text-center text-[0.95rem]"
            style={{ color: r.pts == null ? "var(--color-line)" : r.pts === 0 ? "var(--color-dim)" : "var(--color-acid)" }}
          >
            {r.pts ?? "–"}
          </span>
        </div>
      ))}
      <div className={`grid ${COLS} items-center gap-x-1 py-1.5`}>
        <span className="label !text-[0.58rem]">{title === "Out" ? "OUT" : "IN"}</span>
        <span />
        <span />
        <span className="num text-center text-[0.95rem]">{played(rows) ? sum(rows, "s") : "–"}</span>
        <span className="num text-center text-[0.95rem]">{played(rows) ? sum(rows, "net") : "–"}</span>
        <span className="num text-center text-[0.95rem]" style={{ color: "var(--color-acid)" }}>
          {played(rows) ? sum(rows, "pts") : "–"}
        </span>
      </div>
    </div>
  );

  const totalIn = played(front) + played(back);

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-label={`Enter ${player.name}'s card hole by hole`}>
      <div
        // max-h-full, not a vh unit: the overlay's padding already holds the
        // safe areas, and 90vh of the raw viewport overflowed the card's top
        // edge up under the status-bar clock on tall cards.
        className="card max-h-full w-full max-w-sm overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] pb-3">
          <div className="min-w-0">
            <h3 className="name truncate text-[1.1rem]">{player.name}</h3>
            <p className="label mt-1">
              HCP {formatPlayingHandicap(ph)} · thru {totalIn}
            </p>
          </div>
          <button className="btn btn-primary !min-h-[2.2rem] !px-3 !text-[0.7rem]" onClick={onClose}>
            Done
          </button>
        </div>

        {/* The key — what the card's shorthand means, up top where it's seen
            before the first score goes in. */}
        <p className="label mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 !text-[0.58rem]">
          <span><span className="mono text-[var(--color-text)]">4·13</span> = par 4, stroke index 13</span>
          <span style={{ color: "var(--color-acid)" }}>● = shot received on that hole</span>
        </p>

        <div className="mt-3 grid gap-4">
          <Nine rows={front} title="Out" />
          <Nine rows={back} title="In" />
        </div>

        <div className="mt-1 flex items-baseline justify-between border-t border-[var(--color-line)] pt-2.5">
          <span className="label">Total</span>
          <span className="num text-[1.05rem]">
            {sum([...front, ...back], "s")} gross · {sum([...front, ...back], "net")} net ·{" "}
            <span style={{ color: "var(--color-acid)" }}>{sum([...front, ...back], "pts")} pts</span>
          </span>
        </div>

        {/* Scores save hole by hole, so "complete" is a full stop, not a save —
            it lights up when all 18 are in and closes the card. */}
        <button
          className="btn btn-primary mt-4 w-full"
          disabled={totalIn < 18}
          onClick={onClose}
        >
          {totalIn < 18 ? `Complete round — ${totalIn} of 18 holes in` : "Complete round ✓"}
        </button>

        <p className="label mt-3 !normal-case !tracking-normal">
          First tap sets par, then − and + from there. Tap the number to clear a hole. Saves as
          you go — the board updates hole by hole.
        </p>
      </div>
    </div>
  );
}

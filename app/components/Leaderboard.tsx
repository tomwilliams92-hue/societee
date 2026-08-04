"use client";

import { ordinal } from "@/lib/scoring";

export type BoardRow = {
  key: string;
  name: string;
  position: number;
  tied: boolean;
  value: number | null;
  /** "thru 14 · off 12" — always say how far through they are */
  note?: string;
};

/** The leaderboard. Used for a single day's board and for the season table. */
export function Leaderboard({
  title,
  subtitle,
  rows,
  unit = "PTS",
  empty = "No scores in yet.",
}: {
  title: string;
  subtitle?: string;
  rows: BoardRow[];
  unit?: string;
  empty?: string;
}) {
  return (
    <div className="board">
      <div className="flex items-end justify-between gap-4 border-b border-[var(--color-line)] px-4 py-3">
        <div className="min-w-0">
          <h3 className="display text-[1.15rem] leading-none">{title}</h3>
          {subtitle && <p className="label mt-1.5 truncate">{subtitle}</p>}
        </div>
        <span className="label shrink-0">{unit}</span>
      </div>

      {rows.length === 0 ? (
        <p className="label px-4 py-8 text-center">{empty}</p>
      ) : (
        rows.map((r, i) => (
          <div
            key={r.key}
            className={
              "board-row rise" +
              (r.position === 1 && r.value != null ? " lead" : "") +
              (r.value == null ? " out" : "")
            }
            style={{ animationDelay: `${Math.min(i, 14) * 35}ms` }}
          >
            {r.value != null && r.position <= 3 ? (
              <span className={`medal medal-${["gold", "silver", "bronze"][r.position - 1]}`}>
                {r.position}
              </span>
            ) : (
              <span className="pos">{r.value == null ? "–" : `${r.position}${r.tied ? "=" : ""}`}</span>
            )}
            <span className="min-w-0">
              <span className="nm block truncate">{r.name}</span>
              {r.note && <span className="label mt-0.5 block">{r.note}</span>}
            </span>
            <span className="pts">{r.value ?? "–"}</span>
          </div>
        ))
      )}
    </div>
  );
}

export { ordinal };

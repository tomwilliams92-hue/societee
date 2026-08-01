"use client";

import { ordinal } from "@/lib/scoring";

export type BoardRow = {
  key: string;
  name: string;
  position: number;
  tied: boolean;
  value: number | null;
  /** e.g. "16 holes in" or "off 12" */
  note?: string;
};

export function HonoursBoard({
  title,
  subtitle,
  rows,
  unit = "pts",
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
      <div className="board-in">
        <div className="mb-4 flex items-end justify-between gap-4 border-b border-[var(--brass-rule)] pb-3">
          <div>
            <h3
              className="engraved text-[1.15rem] leading-none"
              style={{ color: "var(--color-brass-lift)" }}
            >
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1.5 text-[0.78rem] tracking-wide" style={{ color: "rgba(234,227,207,.62)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <span
            className="label"
            style={{ color: "rgba(192,154,62,.75)", fontSize: "0.62rem" }}
          >
            {unit}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: "rgba(234,227,207,.55)" }}>
            {empty}
          </p>
        ) : (
          rows.map((r, i) => (
            <div
              key={r.key}
              className={`board-row rise${r.position === 1 && r.value != null ? " lead" : ""}`}
              style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
            >
              <span className="pos">{r.value == null ? "—" : `${ordinal(r.position)}${r.tied ? "=" : ""}`}</span>
              <span className="min-w-0">
                <span className="nm block truncate">{r.name}</span>
                {r.note && (
                  <span
                    className="mt-0.5 block text-[0.7rem] tracking-wide"
                    style={{ color: "rgba(234,227,207,.5)" }}
                  >
                    {r.note}
                  </span>
                )}
              </span>
              <span className="pts">{r.value ?? "–"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Stableford / WHS maths.
 *
 * Ported from the Conwy Choppers engine (engine/lib.mjs), which was verified
 * against a real Wales Golf round:  36 + 29 + 72 − 101 = 36 ✓
 *
 * Handicap convention throughout: PLUS GOLFERS ARE NEGATIVE (+1.6 => -1.6).
 * ------------------------------------------------------------------------- */

import type { Tee } from "./types";

/** Parse a WHS index string ("21.3", "+1.3", "-", "") to a number, plus = negative. */
export function parseHandicap(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  const t = s.trim();
  if (t === "" || t === "-") return null;
  const plus = t.startsWith("+");
  const n = parseFloat(t.replace("+", ""));
  return Number.isFinite(n) ? (plus ? -n : n) : null;
}

/** Display an index the way golfers write it: -1.6 => "+1.6", 21.3 => "21.3". */
export function formatHandicap(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return "—";
  return h < 0 ? `+${Math.abs(h).toFixed(1)}` : h.toFixed(1);
}

/** Same, for a whole-number playing handicap: -2 => "+2". */
export function formatPlayingHandicap(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return "—";
  return h < 0 ? `+${Math.abs(h)}` : String(h);
}

/**
 * WHS Course Handicap = round( Index × Slope/113 + (CR − Par) )
 * Returns whole strokes; negative means a plus golfer gives shots back.
 */
export function courseHandicap(index: number, tee: Pick<Tee, "cr" | "slope" | "par">): number {
  return Math.round((index * tee.slope) / 113 + (tee.cr - tee.par));
}

/**
 * Playing Handicap = Course Handicap × allowance%.
 * WHS allowance for individual Stableford is 95%.
 */
export function playingHandicap(courseHcp: number, allowancePct = 95): number {
  return Math.round((courseHcp * allowancePct) / 100);
}

export type StablefordResult = {
  points: number | null;
  courseHcp: number | null;
  par: number | null;
  ok: boolean;
  reason: string;
};

/**
 * Convert a completed round to Stableford points from the adjusted gross.
 *
 *   Stableford = 36 + CourseHandicap + Par − AdjustedGross
 *
 * Prefer a courseHcp the platform already told us; only derive it from the
 * index when we have to.
 */
export function toStableford(opts: {
  adjustedGross: number | null;
  courseHcp?: number | null;
  index?: number | null;
  tee?: Pick<Tee, "cr" | "slope" | "par"> | null;
}): StablefordResult {
  const { adjustedGross, index = null, tee = null } = opts;
  let courseHcp = opts.courseHcp ?? null;
  const par = tee?.par ?? null;

  if (adjustedGross == null)
    return { points: null, courseHcp, par, ok: false, reason: "no adjusted gross (NR / incomplete)" };
  if (par == null)
    return { points: null, courseHcp, par, ok: false, reason: "course/tee not known" };

  if (courseHcp == null) {
    if (index == null || !tee)
      return { points: null, courseHcp, par, ok: false, reason: "missing course handicap and can't derive it" };
    courseHcp = courseHandicap(index, tee);
  }

  const points = 36 + courseHcp + par - adjustedGross;
  // Guard: flags 9-hole rounds and bad data instead of trusting the number.
  const ok = points >= -2 && points <= 54;
  return {
    points,
    courseHcp,
    par,
    ok,
    reason: ok ? "" : `points out of range (${points}) — is it really an 18-hole round?`,
  };
}

/** Strokes received on a hole, given a playing handicap and the hole's stroke index. */
export function strokesOnHole(playingHcp: number, strokeIndex: number): number {
  if (playingHcp < 0) {
    // Plus golfer gives shots back, hardest hole last (SI 18 first).
    return 19 - strokeIndex <= Math.abs(playingHcp) ? -1 : 0;
  }
  let shots = Math.floor(playingHcp / 18);
  if (strokeIndex <= playingHcp % 18) shots += 1;
  return shots;
}

/** Stableford points for one hole. 0 strokes entered = not played yet. */
export function holePoints(
  strokes: number | null,
  par: number,
  strokeIndex: number,
  playingHcp: number
): number | null {
  if (strokes == null || strokes <= 0) return null;
  const net = strokes - strokesOnHole(playingHcp, strokeIndex);
  return Math.max(0, par - net + 2);
}

/**
 * Order of Merit total: the best N rounds count, everything else is ignored.
 * bestN = null means every round counts.
 */
export function bestNTotal(points: (number | null)[], bestN: number | null): number {
  const valid = points.filter((p): p is number => p != null).sort((a, b) => b - a);
  return (bestN == null ? valid : valid.slice(0, bestN)).reduce((a, b) => a + b, 0);
}

/** Rank rows by a score, high-to-low, sharing positions on ties (1, 2=, 2=, 4). */
export function rank<T>(rows: T[], score: (row: T) => number | null): (T & { position: number; tied: boolean })[] {
  const sorted = [...rows].sort((a, b) => (score(b) ?? -Infinity) - (score(a) ?? -Infinity));
  const out = sorted.map((row, i) => ({ ...row, position: i + 1, tied: false }));
  for (let i = 0; i < out.length; i++) {
    const s = score(out[i]);
    if (s == null) continue;
    let j = i;
    while (j + 1 < out.length && score(out[j + 1]) === s) j++;
    if (j > i) for (let k = i; k <= j; k++) { out[k].position = i + 1; out[k].tied = true; }
    i = j;
  }
  return out;
}

/** "1st", "2nd", "3rd", "11th"… */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

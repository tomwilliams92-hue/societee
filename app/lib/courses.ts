/* ---------------------------------------------------------------------------
 * Course seed data — a handful of North Wales / Wirral clubs to build against.
 *
 * CR / Slope / Par are real published course ratings, and `country` decides
 * which Playing Handicap allowances an organiser may choose (England is fixed
 * at 95% until 2028; Wales, Scotland and Ireland allow 85–100% from Apr 2026).
 *
 * ── ON SCORECARDS ─────────────────────────────────────────────────────────
 * A tee gets a `card` ONLY when someone has entered the real published par and
 * stroke index for all 18 holes. There is deliberately no fallback and no
 * "standard layout" guess: the stroke index decides which holes a player gets a
 * shot on, so an invented one produces Stableford points that look right and
 * are wrong. Without a card, hole-by-hole scoring is refused and the organiser
 * enters a gross total instead — which needs no card and is always correct.
 * ------------------------------------------------------------------------- */

import type { Course, HoleInfo, Tee, Union } from "./types";
import UK_RAW from "./uk-courses.json";
import PT_RAW from "./pt-courses.json";

/** Build a card from [par, strokeIndex] pairs, validating as we go. */
export function makeCard(pairs: [number, number][], expectedPar: number): HoleInfo[] {
  if (pairs.length !== 18) throw new Error(`card needs 18 holes, got ${pairs.length}`);
  const sis = pairs.map(([, si]) => si).sort((a, b) => a - b);
  const ok = sis.every((si, i) => si === i + 1);
  if (!ok) throw new Error("stroke indexes must be 1–18 with no repeats");
  const par = pairs.reduce((a, [p]) => a + p, 0);
  if (par !== expectedPar) throw new Error(`pars sum to ${par}, expected ${expectedPar}`);
  return pairs.map(([par, strokeIndex], i) => ({ hole: i + 1, par, strokeIndex }));
}

/* ---------------------------------------------------------------------------
 * Real cards, taken from each club's own website on 3 Aug 2026 and validated
 * both by the source and again by makeCard() at load: stroke indexes 1–18 with
 * no repeats, pars summing to the course par.
 *
 * Conwy, St Melyd, Abergele, Bromborough and Wallasey all publish ONE men's
 * stroke index shared across their tee sets — only the yardages differ — so the
 * same card is correct for every men's tee at a course. The ladies' cards have
 * their own par and their own SI and are NOT represented here yet.
 * ------------------------------------------------------------------------- */

// conwygolfclub.com/the-course/course-overview
const CONWY = makeCard([
  [4, 13], [3, 15], [4, 9], [4, 5], [4, 1], [3, 17], [4, 7], [4, 3], [5, 11],
  [5, 10], [4, 4], [5, 6], [3, 12], [5, 16], [3, 18], [4, 8], [4, 2], [4, 14],
], 72);

// stmelydgolf.co.uk/course — 9 greens played twice, hence evens out / odds back
const ST_MELYD = makeCard([
  [5, 12], [4, 4], [4, 14], [3, 16], [4, 2], [3, 8], [5, 6], [3, 18], [4, 10],
  [4, 3], [4, 5], [4, 13], [3, 17], [4, 1], [3, 7], [5, 11], [3, 15], [4, 9],
], 69);

// abergelegolfclub.co.uk — official 2022 scorecard PDF
const ABERGELE = makeCard([
  [4, 14], [3, 16], [5, 6], [4, 18], [3, 12], [4, 2], [4, 10], [5, 4], [4, 8],
  [4, 9], [5, 15], [4, 1], [3, 13], [4, 5], [4, 17], [4, 3], [3, 11], [5, 7],
], 72);

// bromboroughgolfclub.org.uk/course/scorecard — men's column
const BROMBOROUGH = makeCard([
  [4, 13], [4, 5], [5, 7], [3, 17], [4, 1], [3, 15], [5, 9], [4, 11], [4, 3],
  [3, 16], [5, 4], [4, 12], [4, 14], [4, 8], [4, 2], [3, 18], [5, 10], [4, 6],
], 72);

// wallasey.intelligentgolf.co.uk/scorecard
const WALLASEY = makeCard([
  [4, 11], [4, 5], [4, 7], [5, 1], [3, 15], [4, 13], [5, 3], [4, 9], [3, 17],
  [4, 12], [4, 8], [3, 18], [5, 2], [5, 16], [4, 6], [3, 14], [4, 4], [4, 10],
], 72);

export const COURSES: Course[] = [
  {
    id: "conwy",
    name: "Conwy",
    clubName: "Conwy (Caernarvonshire) Golf Club",
    county: "Conwy",
    country: "Wales",
    tees: [
      { id: "conwy-blue",  courseId: "conwy", name: "Blue",  cr: 74.5, slope: 138, par: 72, card: CONWY },
      { id: "conwy-white", courseId: "conwy", name: "White", cr: 71.9, slope: 121, par: 72, card: CONWY },
    ],
  },
  {
    id: "bromborough",
    name: "Bromborough",
    clubName: "Bromborough Golf Club",
    county: "Wirral",
    country: "England",
    tees: [{ id: "bromborough-white", courseId: "bromborough", name: "White", cr: 72.9, slope: 142, par: 72, card: BROMBOROUGH }],
  },
  {
    id: "wallasey",
    name: "Wallasey",
    clubName: "Wallasey Golf Club",
    county: "Wirral",
    country: "England",
    tees: [{ id: "wallasey-white", courseId: "wallasey", name: "White", cr: 73.0, slope: 133, par: 72, card: WALLASEY }],
  },
  {
    id: "stmelyd",
    name: "St Melyd",
    clubName: "St Melyd Golf Club",
    county: "Denbighshire",
    country: "Wales",
    tees: [{ id: "stmelyd-white", courseId: "stmelyd", name: "White", cr: 68.4, slope: 120, par: 69, card: ST_MELYD }],
  },
  {
    id: "abergele",
    name: "Abergele",
    clubName: "Abergele Golf Club",
    county: "Conwy",
    country: "Wales",
    tees: [{ id: "abergele-white", courseId: "abergele", name: "White", cr: 71.8, slope: 124, par: 72, card: ABERGELE }],
  },
];

/* ---------------------------------------------------------------------------
 * THE UK DIRECTORY — every golf course in the UK, from OpenStreetMap (ODbL),
 * fetched 5 Aug 2026: 2,909 courses across England, Scotland, Wales and
 * Northern Ireland (NI golf is governed by Golf Ireland, hence union "Ireland").
 *
 * The directory has NAMES AND LOCATIONS ONLY — deliberately. There is no free
 * licensed source of tee ratings, and a guessed CR/slope produces confidently
 * wrong handicaps (the wrong-card complaint in Squabbit's reviews). So picking
 * a directory course asks the organiser for the three numbers printed on every
 * scorecard — par, CR, slope — once per tee, saved for good via actions.addTee.
 * ------------------------------------------------------------------------- */

export type DirectoryCourse = {
  id: string;
  name: string;
  country: Union;
  lat: number;
  lon: number;
  /** from OSM's golf:holes where tagged; null = unknown */
  holes: number | null;
};

/** "Conwy (Caernarvonshire) Golf Club" and "Conwy Golf Club" are one course. */
const normName = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)/g, "").replace(/golf (club|course|links)/g, "")
   .replace(/[^a-z0-9]+/g, " ").trim();

const VERIFIED_KEYS = new Set(COURSES.flatMap((c) => [normName(c.name), normName(c.clubName ?? "")]));

const fromRaw = (raw: [string, string, string, number, number, number | null][]) =>
  raw
    .map(([id, name, country, lat, lon, holes]) => ({ id, name, country: country as Union, lat, lon, holes }))
    .filter((c) => !VERIFIED_KEYS.has(normName(c.name))); // verified entries win

export const UK_DIRECTORY: DirectoryCourse[] = fromRaw(
  UK_RAW as [string, string, string, number, number, number | null][]
);
/** Portugal — the trips. Same OSM provenance as the UK set (ODbL). */
export const PT_DIRECTORY: DirectoryCourse[] = fromRaw(
  PT_RAW as [string, string, string, number, number, number | null][]
);
export const DIRECTORY: DirectoryCourse[] = [...UK_DIRECTORY, ...PT_DIRECTORY];

/**
 * Tees organisers have entered for directory courses. Lives in the store
 * (db.customTees) and is mirrored here on every read/commit so the pure
 * lookups below keep working everywhere without threading the DB through.
 */
let CUSTOM: Record<string, Tee> = {};
export function registerCustomTees(tees: Record<string, Tee>) { CUSTOM = tees; }
export const customTeesFor = (courseId: string): Tee[] =>
  Object.values(CUSTOM).filter((t) => t.courseId === courseId);

const directoryCourse = (id?: string): Course | undefined => {
  const d = DIRECTORY.find((c) => c.id === id);
  return d && { id: d.id, name: d.name, clubName: d.name, country: d.country, tees: customTeesFor(d.id) };
};

export const courseById = (id?: string): Course | undefined =>
  COURSES.find((c) => c.id === id) ?? directoryCourse(id);
export const teeById = (id?: string): Tee | undefined =>
  COURSES.flatMap((c) => c.tees).find((t) => t.id === id) ?? (id ? CUSTOM[id] : undefined);
export const courseOfTee = (teeId?: string) =>
  COURSES.find((c) => c.tees.some((t) => t.id === teeId)) ??
  (teeId ? courseById(CUSTOM[teeId]?.courseId) : undefined);

/** Search the whole country. Verified courses first, then the directory. */
export function searchCourses(q: string, limit = 30): Course[] {
  const needle = normName(q);
  if (!needle) return COURSES.slice(0, limit);
  const hit = (name: string) => normName(name).includes(needle);
  const verified = COURSES.filter((c) => hit(c.name) || hit(c.clubName ?? ""));
  const rest = DIRECTORY.filter((c) => hit(c.name))
    .slice(0, Math.max(0, limit - verified.length))
    .map((c) => courseById(c.id)!);
  return [...verified, ...rest].slice(0, limit);
}

/** Can this tee be scored hole by hole yet? */
export const hasCard = (teeId?: string) => (teeById(teeId)?.card?.length ?? 0) === 18;

export const holeInfo = (teeId: string | undefined, hole: number): HoleInfo | undefined =>
  teeById(teeId)?.card?.find((h) => h.hole === hole);

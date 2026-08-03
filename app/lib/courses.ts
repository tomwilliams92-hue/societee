/* ---------------------------------------------------------------------------
 * Course seed data — a handful of North Wales / Wirral clubs to build against.
 *
 * CR / Slope / Par are real published course ratings. Every course a society
 * plays needs a row here before its rounds can be scored, so this table grows
 * into a proper course database over time.
 *
 * ⚠️  The per-hole `par` / `strokeIndex` arrays below are PLACEHOLDERS. They
 * are a plausible standard layout, NOT the real cards. Live hole-by-hole
 * scoring will produce wrong points until each course's real scorecard is
 * entered. Everything that works off adjusted gross (the import path, and
 * summary score entry) is unaffected and correct today.
 * ------------------------------------------------------------------------- */

import type { Course } from "./types";

type HoleSeed = { par: number; strokeIndex: number };

/** PLACEHOLDER card — see warning above. Par 72, standard SI distribution. */
const STANDARD_72: HoleSeed[] = [
  { par: 4, strokeIndex: 5 },  { par: 4, strokeIndex: 11 }, { par: 3, strokeIndex: 17 },
  { par: 5, strokeIndex: 1 },  { par: 4, strokeIndex: 7 },  { par: 4, strokeIndex: 13 },
  { par: 3, strokeIndex: 15 }, { par: 4, strokeIndex: 3 },  { par: 5, strokeIndex: 9 },
  { par: 4, strokeIndex: 6 },  { par: 4, strokeIndex: 2 },  { par: 3, strokeIndex: 18 },
  { par: 5, strokeIndex: 10 }, { par: 4, strokeIndex: 4 },  { par: 4, strokeIndex: 14 },
  { par: 3, strokeIndex: 16 }, { par: 4, strokeIndex: 8 },  { par: 5, strokeIndex: 12 },
];

/** PLACEHOLDER card — par 69 variant (one par 5 and one par 4 become par 3s). */
const STANDARD_69: HoleSeed[] = STANDARD_72.map((h, i) =>
  i === 8 ? { ...h, par: 4 } : i === 17 ? { ...h, par: 4 } : i === 10 ? { ...h, par: 3 } : h
);

export const HOLE_CARDS: Record<number, HoleSeed[]> = { 72: STANDARD_72, 69: STANDARD_69 };

export function holeCard(par: number): HoleSeed[] {
  return HOLE_CARDS[par] ?? STANDARD_72;
}

export const COURSES: Course[] = [
  {
    id: "conwy",
    name: "Conwy",
    clubName: "Conwy (Caernarvonshire) Golf Club",
    county: "Conwy",
    country: "Wales",
    tees: [
      { id: "conwy-blue",  courseId: "conwy", name: "Blue",  cr: 74.5, slope: 138, par: 72 },
      { id: "conwy-white", courseId: "conwy", name: "White", cr: 71.9, slope: 121, par: 72 },
    ],
  },
  {
    id: "bromborough",
    name: "Bromborough",
    clubName: "Bromborough Golf Club",
    county: "Wirral",
    country: "England",
    tees: [{ id: "bromborough-white", courseId: "bromborough", name: "White", cr: 72.9, slope: 142, par: 72 }],
  },
  {
    id: "wallasey",
    name: "Wallasey",
    clubName: "Wallasey Golf Club",
    county: "Wirral",
    country: "England",
    tees: [{ id: "wallasey-white", courseId: "wallasey", name: "White", cr: 73.0, slope: 133, par: 72 }],
  },
  {
    id: "stmelyd",
    name: "St Melyd",
    clubName: "St Melyd Golf Club",
    county: "Denbighshire",
    country: "Wales",
    tees: [{ id: "stmelyd-white", courseId: "stmelyd", name: "White", cr: 68.4, slope: 120, par: 69 }],
  },
  {
    id: "abergele",
    name: "Abergele",
    clubName: "Abergele Golf Club",
    county: "Conwy",
    country: "Wales",
    tees: [{ id: "abergele-white", courseId: "abergele", name: "White", cr: 71.8, slope: 124, par: 72 }],
  },
];

export const courseById = (id?: string) => COURSES.find((c) => c.id === id);
export const teeById = (id?: string) =>
  COURSES.flatMap((c) => c.tees).find((t) => t.id === id);
export const courseOfTee = (teeId?: string) =>
  COURSES.find((c) => c.tees.some((t) => t.id === teeId));

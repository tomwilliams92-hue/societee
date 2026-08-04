"use client";

/* ---------------------------------------------------------------------------
 * DATA LAYER — demo implementation.
 *
 * Everything the UI needs goes through this module. It currently persists to
 * localStorage so the whole product is clickable with no accounts, no keys and
 * no network. When Supabase is wired up, this one file is replaced with calls
 * to the tables in supabase/schema.sql — the shapes are deliberately identical.
 * No page imports supabase directly. Keep it that way.
 *
 * The seed below is entirely invented — fictional societies, fictional players,
 * fictional scores. It exists to make the product demonstrable, nothing more.
 * ------------------------------------------------------------------------- */

import { useEffect, useState, useSyncExternalStore } from "react";
import type {
  EventEntry, EventGroup, GolfEvent, HoleInfo, HoleScore, Player, Round, Season,
  Series, SideComp, Society,
} from "./types";
import { teeById } from "./courses";
import { courseHandicap, holePoints, playingHandicap } from "./scoring";

const KEY = "societee.v1";

export type DB = {
  societies: Society[];
  players: Player[];
  seasons: Season[];
  events: GolfEvent[];
  groups: EventGroup[];
  entries: EventEntry[];
  rounds: Round[];
  holeScores: HoleScore[];
  sideComps: SideComp[];
  series: Series[];
  /**
   * Scorecards typed in by organisers, keyed by tee id. Merged over the static
   * list in lib/courses.ts. This is how the course database actually fills up:
   * the person standing on the first tee with the card in their hand is the
   * only one who reliably has this data, so let them enter it once and it's
   * there for every society that plays the course after them.
   */
  cards: Record<string, HoleInfo[]>;
  /**
   * Whoever holds THIS device. Lets a golfer keep their own handicap index in
   * one place; saving it flows into any player row with the same name. On the
   * shared database this becomes the claim flow (players.claimed_by) — each
   * mate sets theirs on their own phone and the organiser never types it.
   */
  me: { name: string; handicapIndex: number | null; homeClub?: string; avatar?: string } | null;
};

/** Older saved state won't have the newer collections. Don't crash on it. */
function migrate(db: Partial<DB>): DB {
  return {
    societies: db.societies ?? [], players: db.players ?? [], seasons: db.seasons ?? [],
    events: db.events ?? [], groups: db.groups ?? [], entries: db.entries ?? [],
    rounds: db.rounds ?? [], holeScores: db.holeScores ?? [], sideComps: db.sideComps ?? [],
    series: db.series ?? [], cards: db.cards ?? {},
    me: db.me ?? null,
  };
}

/* ---------------------------------------------------------------- seeding -- */

const id = (() => { let n = 0; return (p: string) => `${p}-${(++n).toString(36)}`; })();
const token = (n = 7) =>
  Array.from({ length: n }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]).join("");

/** Society 1 — a season-long Order of Merit. [name, index, [ [date, courseId, teeId, points, gross] ]] */
const WANDERERS: [string, number, [string, string, string, number, number][]][] = [
  ["Alan Merrick", -0.8, [
    ["2026-07-25", "conwy", "conwy-white", 37, 72], ["2026-07-11", "conwy", "conwy-white", 35, 74],
    ["2026-06-27", "wallasey", "wallasey-white", 34, 74], ["2026-06-13", "conwy", "conwy-white", 34, 75],
    ["2026-07-04", "conwy", "conwy-white", 32, 77], ["2026-05-30", "conwy", "conwy-white", 31, 78],
    ["2026-06-06", "conwy", "conwy-white", 29, 80],
  ]],
  ["Neil Sanderson", 7.4, [
    ["2026-07-25", "conwy", "conwy-white", 38, 79], ["2026-06-27", "wallasey", "wallasey-white", 34, 83],
    ["2026-07-11", "conwy", "conwy-white", 33, 84], ["2026-06-13", "conwy", "conwy-white", 32, 85],
    ["2026-05-30", "conwy", "conwy-white", 30, 87], ["2026-07-04", "conwy", "conwy-white", 28, 89],
  ]],
  ["Gavin Hollis", 14.6, [
    ["2026-07-11", "conwy", "conwy-white", 36, 88], ["2026-06-13", "conwy", "conwy-white", 35, 89],
    ["2026-07-25", "conwy", "conwy-white", 31, 93], ["2026-05-30", "conwy", "conwy-white", 30, 94],
    ["2026-06-27", "wallasey", "wallasey-white", 27, 98],
  ]],
  ["Martin Ashby", 19.9, [
    ["2026-06-13", "conwy", "conwy-white", 35, 94], ["2026-07-25", "conwy", "conwy-white", 33, 96],
    ["2026-07-04", "conwy", "conwy-white", 29, 100], ["2026-05-30", "conwy", "conwy-white", 24, 105],
  ]],
  ["Ken Baxter", 26.2, [
    ["2026-07-04", "conwy", "conwy-white", 34, 102], ["2026-06-06", "conwy", "conwy-white", 30, 106],
    ["2026-07-25", "conwy", "conwy-white", 26, 110],
  ]],
];

/** Society 2 — a golf day happening right now. */
const SWINDLE = [
  ["Dave Prichard", 12.4], ["Steve Hughes", 18.1], ["Mark Ellis", 8.7],
  ["John Roberts", 24.2], ["Pete Vaughan", 15.0], ["Gareth Lloyd", 6.3],
  ["Ryan Doyle", 20.8], ["Liam Foster", 11.2], ["Chris Nolan", 27.4],
  ["Aled Jones", 9.9], ["Sam Whitfield", 16.6], ["Owen Price", 4.1],
] as const;

function seed(): DB {
  const db: DB = {
    societies: [], players: [], seasons: [], events: [], groups: [],
    entries: [], rounds: [], holeScores: [], sideComps: [], series: [], cards: {}, me: null,
  };

  /* ---------- Society 1: a season-long Order of Merit across the summer ---- */
  const wanderers: Society = {
    id: "soc-wanderers", slug: "fairway-wanderers", name: "Fairway Wanderers",
    homeClub: "Conwy (Caernarvonshire)", accent: "#0B3D2C", badge: "links-blue", createdAt: "2026-05-28",
  };
  db.societies.push(wanderers);
  db.seasons.push({
    id: "sea-2026", societyId: wanderers.id, name: "Summer Order of Merit 2026",
    startsOn: "2026-05-30", endsOn: "2026-09-30", bestN: 6,
    prize: "Winner takes the jug", isCurrent: true,
  });

  for (const [name, hcp, rounds] of WANDERERS) {
    const pid = id("plr");
    db.players.push({
      id: pid, societyId: wanderers.id, name,
      shortName: name.split(" ")[0], handicapIndex: hcp, active: true,
    });
    for (const [date, courseId, teeId, points, gross] of rounds) {
      const t = teeById(teeId)!;
      db.rounds.push({
        id: id("rnd"), playerId: pid,
        eventId: null,                    // an ordinary club round, not a society day
        courseId, teeId, playedOn: date, format: "stableford",
        gross, adjustedGross: gross,
        courseHandicap: playingHandicap(courseHandicap(hcp, t), 95),
        stableford: points, net: null,
        source: "manual", verified: false,
      });
    }
  }

  /* -------------- Society 2: a live golf day, 12 players, half in ---------- */
  const swindle: Society = {
    id: "soc-swindle", slug: "saturday-swindle", name: "Saturday Swindle",
    homeClub: "Nomadic", accent: "#0B3D2C", badge: "flag-green", createdAt: "2026-06-14",
  };
  db.societies.push(swindle);

  const tee = teeById("conwy-white")!;
  const ev: GolfEvent = {
    id: "evt-swindle-aug", societyId: swindle.id, courseId: "conwy", teeId: tee.id,
    // seeded on "today" so the demo always shows a genuinely live day
    name: "August Meeting", playsOn: new Date().toISOString().slice(0, 10), teeTime: "09:20",
    format: "stableford", handicapAllowance: 95, status: "live",
    shareToken: "augmeet", notes: "£10 in the pot. Two-tee start.",
  };
  db.events.push(ev);

  // Three fourballs, two-tee start. Each gets its own scoring link.
  [1, 2, 3].forEach((n) => {
    db.groups.push({
      id: id("grp"), eventId: ev.id, groupNo: n,
      startHole: n === 3 ? 10 : 1, scorerToken: token(6),
    });
  });

  const played = [38, 36, 35, 34, 33, 31, 30, 28, null, null, null, null];
  SWINDLE.forEach(([name, hcp], i) => {
    const pid = id("plr");
    db.players.push({
      id: pid, societyId: swindle.id, name,
      shortName: name.split(" ")[0], handicapIndex: hcp, active: true,
    });
    const ph = playingHandicap(courseHandicap(hcp, tee), ev.handicapAllowance);
    db.entries.push({
      id: id("ent"), eventId: ev.id, playerId: pid,
      playingHandicap: ph,
      groupNo: Math.floor(i / 4) + 1, startHole: i < 8 ? 1 : 10,
    });
    const pts = played[i];
    if (pts != null) {
      const gross = 36 + ph + tee.par - pts;
      db.rounds.push({
        id: id("rnd"), playerId: pid, eventId: ev.id, courseId: "conwy", teeId: tee.id,
        playedOn: ev.playsOn, format: "stableford",
        gross, adjustedGross: gross,
        courseHandicap: ph, stableford: pts, net: gross - ph,
        source: "live_scoring", verified: false,
      });
    }
  });

  db.sideComps.push(
    { id: id("sc"), eventId: ev.id, kind: "ntp", hole: 3, winnerId: db.players.at(-4)!.id, detail: "1.2m" },
    { id: id("sc"), eventId: ev.id, kind: "longest_drive", hole: 12, winnerId: db.players.at(-3)!.id }
  );

  /* --------- a completed two-day trip, so the combined board has life ------ */
  const spring: Series = { id: "srs-spring", societyId: swindle.id, name: "Spring Trip" };
  db.series.push(spring);
  const swindlers = db.players.filter((p) => p.societyId === swindle.id);
  const tripDays: [string, string, string, (number | null)[]][] = [
    // date, teeId, name, points for the 12 in seed order
    ["2026-05-09", "stmelyd-white",  "Trip day 1 — St Melyd",
      [34, 31, 36, 28, 33, 35, 27, 32, 25, 34, 30, 37]],
    ["2026-05-10", "abergele-white", "Trip day 2 — Abergele",
      [31, 35, 33, 30, 29, 38, 31, 28, 27, 32, 26, 34]],
  ];
  for (const [date, teeId, name, pts] of tripDays) {
    const t = teeById(teeId)!;
    const dayEv: GolfEvent = {
      id: id("evt"), societyId: swindle.id, seriesId: spring.id,
      courseId: t.courseId, teeId: t.id, name, playsOn: date,
      format: "stableford", handicapAllowance: 95, status: "complete",
      shareToken: token(),
    };
    db.events.push(dayEv);
    swindlers.forEach((p, i) => {
      const chD = courseHandicap(p.handicapIndex!, t);
      const phD = playingHandicap(chD, 95);
      db.entries.push({
        id: id("ent"), eventId: dayEv.id, playerId: p.id,
        playingHandicap: phD, groupNo: Math.floor(i / 4) + 1, startHole: 1,
      });
      const pt = pts[i];
      if (pt != null) {
        const grossD = 36 + phD + t.par - pt;
        db.rounds.push({
          id: id("rnd"), playerId: p.id, eventId: dayEv.id, courseId: t.courseId,
          teeId: t.id, playedOn: date, format: "stableford",
          gross: grossD, adjustedGross: grossD, courseHandicap: phD,
          stableford: pt, net: grossD - phD, source: "manual", verified: false,
        });
      }
    });
  }

  return db;
}

/* ------------------------------------------------------------------ store -- */

let cache: DB | null = null;
const listeners = new Set<() => void>();

function read(): DB {
  if (cache) return cache;
  if (typeof window === "undefined") return (cache = seed());
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      cache = migrate(JSON.parse(raw) as Partial<DB>);
    } else {
      // Persist the seed immediately. Share and scoring tokens are random, so
      // re-seeding on the next page load would silently invalidate every link
      // already handed out.
      cache = seed();
      window.localStorage.setItem(KEY, JSON.stringify(cache));
    }
  } catch {
    cache = seed();
  }
  return cache!;
}

function commit(next: DB) {
  cache = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

const EMPTY: DB = migrate({});

/**
 * The store lives in localStorage, so the server has nothing to render from.
 * Server render and the FIRST client render must both use the same empty state
 * or React throws a hydration mismatch; real data swaps in on mount. Pair with
 * useReady() to show a placeholder rather than an empty-state flash.
 */
export function useDB(): DB {
  const db = useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    read,
    () => EMPTY
  );
  return useReady() ? db : EMPTY;
}

export function useReady(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function update(fn: (db: DB) => DB | void) {
  const draft: DB = JSON.parse(JSON.stringify(read()));
  commit((fn(draft) as DB) ?? draft);
}

export function resetDemo() {
  cache = null;
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  commit(seed());
}

/* ---------------------------------------------------------------- actions -- */

export const actions = {
  createSociety(
    name: string,
    homeClub?: string,
    identity?: { badge?: string; crestData?: string }
  ) {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    let slug = base || "society";
    update((db) => {
      // slugs are the URL — never let two societies collide on one
      let n = 2;
      while (db.societies.some((x) => x.slug === slug)) slug = `${base}-${n++}`;
      db.societies.push({
        id: id("soc"), slug, name, homeClub,
        accent: "#0B3D2C", badge: identity?.badge, crestData: identity?.crestData,
        createdAt: new Date().toISOString().slice(0, 10),
      });
    });
    return read().societies.find((x) => x.slug === slug)!;
  },

  setSocietyIdentity(societyId: string, identity: { badge?: string; crestData?: string }) {
    update((db) => {
      const soc = db.societies.find((x) => x.id === societyId);
      if (soc) { soc.badge = identity.badge; soc.crestData = identity.crestData; }
    });
  },

  addPlayer(societyId: string, name: string, handicapIndex: number | null) {
    update((db) => {
      db.players.push({
        id: id("plr"), societyId, name, shortName: name.split(" ")[0],
        handicapIndex, active: true,
      });
    });
  },

  createEvent(
    societyId: string,
    input: {
      name: string; playsOn: string; teeId: string; playerIds: string[];
      /** name of the trip this day belongs to — found or created per society */
      seriesName?: string;
      /**
       * Playing handicap allowance, %. 95 is the WHS default for individual
       * Stableford and is *mandatory* in England until 2028. Ireland, Scotland
       * and Wales allow 85/90/95/100 for singles from 1 Apr 2026, so this has
       * to be a choice rather than a constant.
       */
      handicapAllowance?: number;
    }
  ) {
    const tee = teeById(input.teeId)!;
    const ev: GolfEvent = {
      id: id("evt"), societyId, courseId: tee.courseId, teeId: tee.id,
      name: input.name, playsOn: input.playsOn, format: "stableford",
      handicapAllowance: input.handicapAllowance ?? 95,
      status: "live", shareToken: token(),
    };
    update((db) => {
      const trip = input.seriesName?.trim();
      if (trip) {
        const key = trip.toLowerCase();
        let sr = db.series.find(
          (x) => x.societyId === societyId && x.name.trim().toLowerCase() === key
        );
        if (!sr) { sr = { id: id("srs"), societyId, name: trip }; db.series.push(sr); }
        ev.seriesId = sr.id;
      }
      db.events.push(ev);
      input.playerIds.forEach((pid, i) => {
        const p = db.players.find((x) => x.id === pid);
        const ch = p?.handicapIndex != null ? courseHandicap(p.handicapIndex, tee) : null;
        db.entries.push({
          id: id("ent"), eventId: ev.id, playerId: pid,
          playingHandicap: ch == null ? null : playingHandicap(ch, ev.handicapAllowance),
          groupNo: Math.floor(i / 4) + 1, startHole: 1,
        });
      });
      // One fourball per four players, each with its own scoring link.
      const groupCount = Math.max(1, Math.ceil(input.playerIds.length / 4));
      for (let n = 1; n <= groupCount; n++) {
        db.groups.push({
          id: id("grp"), eventId: ev.id, groupNo: n, startHole: 1, scorerToken: token(6),
        });
      }
    });
    return ev;
  },

  /* ------------------------------------------------------- live scoring -- */

  /**
   * Record one player's strokes on one hole, from a group's scoring link.
   *
   * The round's running Stableford and gross are recomputed from every hole
   * entered so far, so a corrected hole immediately corrects the total. Points
   * come from the tee's REAL card — callers must check hasCard() first; without
   * one there is no honest answer and this does nothing.
   */
  setHoleScore(eventId: string, playerId: string, hole: number, strokes: number | null) {
    update((db) => {
      const ev = db.events.find((e) => e.id === eventId);
      const tee = teeById(ev?.teeId);
      const card = tee?.card;
      if (!ev || !tee || !card) return;

      const entry = db.entries.find((e) => e.eventId === eventId && e.playerId === playerId);
      const player = db.players.find((p) => p.id === playerId);
      if (!entry || !player) return;
      const ph = entry.playingHandicap ??
        (player.handicapIndex == null ? 0
          : playingHandicap(courseHandicap(player.handicapIndex, tee), ev.handicapAllowance));

      let round = db.rounds.find((r) => r.eventId === eventId && r.playerId === playerId);
      if (!round) {
        round = {
          id: id("rnd"), playerId, eventId, courseId: ev.courseId, teeId: ev.teeId,
          playedOn: ev.playsOn, format: "stableford", gross: null, adjustedGross: null,
          courseHandicap: ph, stableford: null, net: null,
          source: "live_scoring", verified: false,
        };
        db.rounds.push(round);
      }

      const info = card.find((h) => h.hole === hole);
      db.holeScores = db.holeScores.filter((h) => !(h.roundId === round!.id && h.hole === hole));
      if (strokes != null && strokes > 0 && info) {
        db.holeScores.push({
          roundId: round.id, hole, strokes,
          points: holePoints(strokes, info.par, info.strokeIndex, ph),
        });
      }

      const mine = db.holeScores.filter((h) => h.roundId === round!.id);
      round.gross = mine.length ? mine.reduce((a, h) => a + (h.strokes ?? 0), 0) : null;
      round.adjustedGross = round.gross;
      round.stableford = mine.length ? mine.reduce((a, h) => a + (h.points ?? 0), 0) : null;
      round.courseHandicap = ph;
      round.net = round.gross == null ? null : round.gross - ph;
    });
  },

  /**
   * Enter or overwrite a player's score for an event, from an adjusted gross.
   *
   * Points come off the PLAYING handicap frozen on the entry (course handicap ×
   * the event's allowance — 95% for individual Stableford), not the raw course
   * handicap. Using the course handicap here would quietly hand every player a
   * point or two too many, and more to the high handicappers than the low ones.
   */
  setScore(eventId: string, playerId: string, adjustedGross: number | null) {
    update((db) => {
      const ev = db.events.find((e) => e.id === eventId)!;
      const tee = teeById(ev.teeId)!;
      const player = db.players.find((p) => p.id === playerId)!;
      const entry = db.entries.find((e) => e.eventId === eventId && e.playerId === playerId);
      const ch = player.handicapIndex != null ? courseHandicap(player.handicapIndex, tee) : 0;
      const ph = entry?.playingHandicap ?? playingHandicap(ch, ev.handicapAllowance);
      const existing = db.rounds.find((r) => r.eventId === eventId && r.playerId === playerId);

      if (adjustedGross == null) {
        db.rounds = db.rounds.filter((r) => r !== existing);
        return;
      }
      const points = 36 + ph + tee.par - adjustedGross;
      const row: Round = {
        id: existing?.id ?? id("rnd"), playerId, eventId,
        courseId: ev.courseId, teeId: ev.teeId, playedOn: ev.playsOn,
        format: "stableford", gross: adjustedGross, adjustedGross,
        courseHandicap: ph, stableford: points, net: adjustedGross - ph,
        source: "live_scoring", verified: false,
      };
      if (existing) Object.assign(existing, row);
      else db.rounds.push(row);
    });
  },

  setEventStatus(eventId: string, status: GolfEvent["status"]) {
    update((db) => { const e = db.events.find((x) => x.id === eventId); if (e) e.status = status; });
  },

  updatePlayer(playerId: string, patch: Partial<Pick<Player, "name" | "handicapIndex" | "active">>) {
    update((db) => {
      const p = db.players.find((x) => x.id === playerId);
      if (p) Object.assign(p, patch, { shortName: patch.name?.split(" ")[0] ?? p.shortName });
    });
  },

  /** Someone pulls out. Takes their card with them. */
  removeFromEvent(eventId: string, playerId: string) {
    update((db) => {
      db.entries = db.entries.filter((e) => !(e.eventId === eventId && e.playerId === playerId));
      db.rounds = db.rounds.filter((r) => !(r.eventId === eventId && r.playerId === playerId));
    });
  },

  /** Someone turns up on the day. Handicap is computed and frozen now. */
  addToEvent(eventId: string, playerId: string) {
    update((db) => {
      if (db.entries.some((e) => e.eventId === eventId && e.playerId === playerId)) return;
      const ev = db.events.find((e) => e.id === eventId)!;
      const tee = teeById(ev.teeId)!;
      const p = db.players.find((x) => x.id === playerId)!;
      const ch = p.handicapIndex != null ? courseHandicap(p.handicapIndex, tee) : null;
      const groups = db.entries.filter((e) => e.eventId === eventId).length;
      db.entries.push({
        id: id("ent"), eventId, playerId,
        playingHandicap: ch == null ? null : playingHandicap(ch, ev.handicapAllowance),
        groupNo: Math.floor(groups / 4) + 1, startHole: 1,
      });
    });
  },

  deleteEvent(eventId: string) {
    update((db) => {
      const roundIds = new Set(db.rounds.filter((r) => r.eventId === eventId).map((r) => r.id));
      db.events = db.events.filter((e) => e.id !== eventId);
      db.groups = db.groups.filter((g) => g.eventId !== eventId);
      db.entries = db.entries.filter((e) => e.eventId !== eventId);
      db.rounds = db.rounds.filter((r) => r.eventId !== eventId);
      db.holeScores = db.holeScores.filter((h) => !roundIds.has(h.roundId));
      db.sideComps = db.sideComps.filter((s) => s.eventId !== eventId);
    });
  },

  /** Move a player into another fourball. */
  setGroup(eventId: string, playerId: string, groupNo: number) {
    update((db) => {
      const e = db.entries.find((x) => x.eventId === eventId && x.playerId === playerId);
      if (e) e.groupNo = groupNo;
    });
  },

  /** Start a season (Order of Merit). Any previous season stops being current. */
  createSeason(
    societyId: string,
    input: { name: string; startsOn: string; endsOn: string; bestN: number | null; prize?: string }
  ) {
    update((db) => {
      db.seasons.forEach((x) => { if (x.societyId === societyId) x.isCurrent = false; });
      db.seasons.push({ id: id("sea"), societyId, ...input, isCurrent: true });
    });
  },

  /**
   * Save a scorecard an organiser has typed in.
   *
   * Validated hard, because this is the data every hole-by-hole point depends
   * on: 18 holes, stroke indexes exactly 1–18 with no repeats, pars in range.
   * Returns an error string rather than saving something unusable.
   */
  saveCard(teeId: string, holes: HoleInfo[]): string | null {
    if (holes.length !== 18) return "Needs all 18 holes.";
    if (holes.some((h) => h.par < 3 || h.par > 6)) return "Pars should be between 3 and 6.";
    const sis = holes.map((h) => h.strokeIndex).sort((a, b) => a - b);
    if (!sis.every((si, i) => si === i + 1)) {
      const dupes = sis.filter((si, i) => sis[i + 1] === si);
      return dupes.length
        ? `Stroke index ${dupes[0]} is used twice — each of 1 to 18 must appear once.`
        : "Stroke indexes must be 1 to 18, each used once.";
    }
    const tee = teeById(teeId);
    const par = holes.reduce((a, h) => a + h.par, 0);
    if (tee && par !== tee.par) return `Pars add up to ${par}, but ${tee.name} is par ${tee.par}.`;

    update((db) => { db.cards[teeId] = holes; });
    return null;
  },

  /**
   * Save this device's own profile, and pull the index into every player row
   * with the same name (case-insensitive). Returns how many rows it updated.
   * Existing cards keep the playing handicap they were played off.
   */
  setMe(me: { name: string; handicapIndex: number | null; homeClub?: string; avatar?: string }): number {
    let touched = 0;
    update((db) => {
      db.me = me;
      if (me.name.trim()) {
        const key = me.name.trim().toLowerCase();
        for (const p of db.players) {
          if (p.name.trim().toLowerCase() === key && p.handicapIndex !== me.handicapIndex) {
            p.handicapIndex = me.handicapIndex;
            touched++;
          }
        }
      }
    });
    return touched;
  },

  setGroupStartHole(eventId: string, groupNo: number, startHole: number) {
    update((db) => {
      const g = db.groups.find((x) => x.eventId === eventId && x.groupNo === groupNo);
      if (g) g.startHole = startHole;
    });
  },
};

/* --------------------------------------------------------------- selectors -- */

export const select = {
  society: (db: DB, slug: string) => db.societies.find((s) => s.slug === slug),
  players: (db: DB, societyId: string) => db.players.filter((p) => p.societyId === societyId && p.active),
  events: (db: DB, societyId: string) =>
    db.events.filter((e) => e.societyId === societyId).sort((a, b) => b.playsOn.localeCompare(a.playsOn)),
  event: (db: DB, eventId: string) => db.events.find((e) => e.id === eventId),
  eventByToken: (db: DB, t: string) => db.events.find((e) => e.shareToken === t),
  /** Live = scoring open AND it's the day itself. An event left open last
   *  Saturday is not "live" on Tuesday — it's unfinished admin. */
  liveToday: (db: DB) => {
    const today = new Date().toISOString().slice(0, 10);
    return db.events.find((e) => e.status === "live" && e.playsOn === today);
  },
  /** The next scheduled day after today (any society), for "Next up". */
  nextUp: (db: DB) => {
    const today = new Date().toISOString().slice(0, 10);
    return db.events
      .filter((e) => e.playsOn > today && e.status !== "cancelled" && e.status !== "complete")
      .sort((a, b) => a.playsOn.localeCompare(b.playsOn))[0];
  },
  entries: (db: DB, eventId: string) => db.entries.filter((e) => e.eventId === eventId),
  roundsForEvent: (db: DB, eventId: string) => db.rounds.filter((r) => r.eventId === eventId),
  roundsForPlayer: (db: DB, playerId: string) =>
    db.rounds.filter((r) => r.playerId === playerId).sort((a, b) => b.playedOn.localeCompare(a.playedOn)),
  currentSeason: (db: DB, societyId: string) =>
    db.seasons.find((s) => s.societyId === societyId && s.isCurrent),
  sideComps: (db: DB, eventId: string) => db.sideComps.filter((s) => s.eventId === eventId),

  seriesFor: (db: DB, societyId: string) => db.series.filter((x) => x.societyId === societyId),
  seriesEvents: (db: DB, seriesId: string) =>
    db.events.filter((e) => e.seriesId === seriesId).sort((a, b) => a.playsOn.localeCompare(b.playsOn)),

  /**
   * The scorecard in force for a tee: an organiser-entered one wins over the
   * built-in list. Undefined means nobody has entered one, and hole-by-hole
   * scoring must stay switched off rather than guess a stroke index.
   */
  card: (db: DB, teeId?: string): HoleInfo[] | undefined => {
    if (!teeId) return undefined;
    const entered = db.cards[teeId];
    return entered?.length === 18 ? entered : teeById(teeId)?.card;
  },
  hasCard: (db: DB, teeId?: string) => (select.card(db, teeId)?.length ?? 0) === 18,

  groups: (db: DB, eventId: string) =>
    db.groups.filter((g) => g.eventId === eventId).sort((a, b) => a.groupNo - b.groupNo),
  groupByToken: (db: DB, t: string) => db.groups.find((g) => g.scorerToken === t),

  /** Everyone in a fourball, in the order they appear on the card. */
  groupPlayers: (db: DB, eventId: string, groupNo: number) =>
    db.entries
      .filter((e) => e.eventId === eventId && e.groupNo === groupNo)
      .map((e) => ({ entry: e, player: db.players.find((p) => p.id === e.playerId)! }))
      .filter((x) => x.player),

  /** Hole-by-hole entries for one player in one event. */
  holesFor: (db: DB, eventId: string, playerId: string) => {
    const round = db.rounds.find((r) => r.eventId === eventId && r.playerId === playerId);
    if (!round) return [];
    return db.holeScores.filter((h) => h.roundId === round.id);
  },
};

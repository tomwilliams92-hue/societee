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
  EventEntry, EventGroup, GolfEvent, HoleInfo, HoleScore, Player, Round, ScoringFormat,
  Season, Series, SideComp, Society, Tee,
} from "./types";
import { registerCustomTees, teeById } from "./courses";
import { courseHandicap, holePoints, playingHandicap } from "./scoring";
import { IS_REMOTE } from "./supabase/config";

/**
 * Demo mode keeps its key so nothing a device already has is disturbed; remote
 * mode caches the LAST GOOD SNAPSHOT from Postgres under its own key, which is
 * what the app opens with on the course when there's no signal.
 */
const KEY = IS_REMOTE ? "societee.remote.v1" : "societee.v2";
const DEMO_KEY = "societee.v2";   // migration reads the old on-device data from here
const OLD_KEYS = ["societee.v1"];

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
   * Tees organisers have added for UK directory courses, keyed by tee id.
   * A directory course ships as a name only — the organiser types the par, CR
   * and slope printed on the club's scorecard, once, and it's here for good.
   */
  customTees: Record<string, Tee>;
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
    series: db.series ?? [], cards: db.cards ?? {}, customTees: db.customTees ?? {},
    me: db.me ?? null,
  };
}

/* ---------------------------------------------------------------- seeding -- */

/** Remote ids are uuids so the optimistic row IS the stored row (uuid PKs);
 *  demo ids stay short and readable. Courses/tees keep text slugs either way. */
const id = IS_REMOTE
  ? (_p: string) => crypto.randomUUID()
  : (() => { let n = 0; return (p: string) => `${p}-${(++n).toString(36)}`; })();
const token = (n = 7) =>
  Array.from({ length: n }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]).join("");

/** One society, one live event, one season — a single worked example. */
const FIELD: [string, number][] = [
  ["Dave Prichard", 12.4], ["Steve Hughes", 18.1], ["Mark Ellis", 8.7],
  ["John Roberts", 24.2], ["Pete Vaughan", 15.0], ["Gareth Lloyd", 6.3],
  ["Ryan Doyle", 20.8], ["Liam Foster", 11.2], ["Chris Nolan", 27.4],
  ["Aled Jones", 9.9], ["Sam Whitfield", 16.6], ["Owen Price", 4.1],
];

/** Past Saturdays: [daysAgo, points for the 12, in FIELD order (null = didn't play)] */
const PAST: [number, (number | null)[]][] = [
  [28, [34, 31, 36, 28, 33, 35, 27, 32, 25, 34, 30, 37]],
  [21, [31, 35, 33, 30, 29, 38, 31, 28, 27, 32, 26, 34]],
  [14, [36, 28, 34, 33, 35, 31, null, 30, 29, 27, 33, 32]],
  [7,  [33, 32, 31, 36, 28, 34, 30, null, 31, 35, 29, 36]],
];

function seed(): DB {
  const db: DB = {
    societies: [], players: [], seasons: [], events: [], groups: [],
    entries: [], rounds: [], holeScores: [], sideComps: [], series: [], cards: {},
    customTees: {}, me: null,
  };

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return iso(d); };

  const soc: Society = {
    id: "soc-demo", slug: "saturday-swindle", name: "Saturday Swindle",
    homeClub: "Conwy (Caernarvonshire)", accent: "#0B3D2C", badge: "flag-green",
    createdAt: daysAgo(35),
  };
  db.societies.push(soc);

  const seasonStart = new Date(today); seasonStart.setDate(seasonStart.getDate() - 35);
  db.seasons.push({
    id: "sea-demo", societyId: soc.id, name: "Summer standings 2026",
    startsOn: iso(seasonStart), endsOn: "2026-09-30", bestN: 6,
    prize: "Winner takes the jug", isCurrent: true,
  });

  const tee = teeById("conwy-white")!;
  FIELD.forEach(([name, hcp]) => {
    db.players.push({
      id: id("plr"), societyId: soc.id, name,
      shortName: name.split(" ")[0], handicapIndex: hcp, active: true,
    });
  });
  const roster = db.players;

  // ---- season history: four past Saturdays as completed events ----
  PAST.forEach(([ago, pts], n) => {
    const t = tee;
    const ev: GolfEvent = {
      id: id("evt"), societyId: soc.id, courseId: "conwy", teeId: t.id,
      name: `Saturday roll-up ${n + 1}`, playsOn: daysAgo(ago),
      format: "stableford", handicapAllowance: 95, status: "complete",
      shareToken: token(),
    };
    db.events.push(ev);
    roster.forEach((p, i) => {
      const ph = playingHandicap(courseHandicap(p.handicapIndex!, t), 95);
      db.entries.push({
        id: id("ent"), eventId: ev.id, playerId: p.id,
        playingHandicap: ph, groupNo: Math.floor(i / 4) + 1, startHole: 1,
      });
      const pt = pts[i];
      if (pt != null) {
        const gross = 36 + ph + t.par - pt;
        db.rounds.push({
          id: id("rnd"), playerId: p.id, eventId: ev.id, courseId: "conwy", teeId: t.id,
          playedOn: ev.playsOn, format: "stableford",
          gross, adjustedGross: gross, courseHandicap: ph,
          stableford: pt, net: gross - ph, source: "manual", verified: false,
        });
      }
    });
  });

  // ---- TODAY: the live event, half the field in ----
  const live: GolfEvent = {
    id: "evt-today", societyId: soc.id, courseId: "conwy", teeId: tee.id,
    name: "August Meeting", playsOn: iso(today), teeTime: "09:20",
    format: "stableford", handicapAllowance: 95, status: "live",
    shareToken: "augmeet", notes: "£10 in the pot. Two-tee start.",
  };
  db.events.push(live);
  [1, 2, 3].forEach((n) => {
    db.groups.push({
      id: id("grp"), eventId: live.id, groupNo: n,
      startHole: n === 3 ? 10 : 1, scorerToken: token(6),
    });
  });
  const todayPts = [38, 36, 35, 34, 33, 31, 30, 28, null, null, null, null];
  roster.forEach((p, i) => {
    const ph = playingHandicap(courseHandicap(p.handicapIndex!, tee), 95);
    db.entries.push({
      id: id("ent"), eventId: live.id, playerId: p.id,
      playingHandicap: ph, groupNo: Math.floor(i / 4) + 1, startHole: i < 8 ? 1 : 10,
    });
    const pt = todayPts[i];
    if (pt != null) {
      const gross = 36 + ph + tee.par - pt;
      db.rounds.push({
        id: id("rnd"), playerId: p.id, eventId: live.id, courseId: "conwy", teeId: tee.id,
        playedOn: live.playsOn, format: "stableford",
        gross, adjustedGross: gross, courseHandicap: ph,
        stableford: pt, net: gross - ph, source: "live_scoring", verified: false,
      });
    }
  });
  db.sideComps.push(
    { id: id("sc"), eventId: live.id, kind: "ntp", hole: 3, winnerId: roster[8].id, detail: "1.2m" },
    { id: id("sc"), eventId: live.id, kind: "longest_drive", hole: 12, winnerId: roster[9].id }
  );

  return db;
}

/* ------------------------------------------------------------------ store -- */

let cache: DB | null = null;
const listeners = new Set<() => void>();

function read(): DB {
  if (cache) return cache;
  if (typeof window === "undefined") return (cache = IS_REMOTE ? migrate({}) : seed());
  if (IS_REMOTE) {
    // No fictional seed with a real database behind the app — start from the
    // cached snapshot (offline) or empty until the first hydrate lands.
    try {
      const raw = window.localStorage.getItem(KEY);
      cache = raw ? migrate(JSON.parse(raw) as Partial<DB>) : migrate({});
    } catch {
      cache = migrate({});
    }
    registerCustomTees(cache!.customTees);
    return cache!;
  }
  try {
    OLD_KEYS.forEach((k) => window.localStorage.removeItem(k));
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
  registerCustomTees(cache!.customTees);
  return cache!;
}

/**
 * Sync taps in here: every commit that came from a USER action is reported so
 * the remote adapter can push it. Hydrates from the server commit silently —
 * pushing back what the server just told us would be an echo chamber.
 */
const commitHooks = new Set<(db: DB) => void>();
let silentCommit = false;
export function onCommit(hook: (db: DB) => void): () => void {
  commitHooks.add(hook);
  return () => { commitHooks.delete(hook); };
}

function commit(next: DB) {
  cache = next;
  registerCustomTees(next.customTees);
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  listeners.forEach((l) => l());
  if (!silentCommit) commitHooks.forEach((h) => h(next));
}

/** Replace the synced collections with the server's truth, keeping everything
 *  device-local (entered cards, custom tees, profile) exactly as it is. */
export function hydrateRemote(remote: Partial<DB>) {
  const cur = read();
  silentCommit = true;
  try { commit(migrate({ ...cur, ...remote })); } finally { silentCommit = false; }
}

/** The current snapshot, for the sync engine's pull-merge. */
export function readDB(): DB {
  return read();
}

/** The old on-device demo/local data, for one-time migration to the account. */
export function readLocalDemoDB(): DB | null {
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    return raw ? migrate(JSON.parse(raw) as Partial<DB>) : null;
  } catch { return null; }
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
  if (IS_REMOTE) return; // fictional seed must never reach the real database
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
    // WHS indexes run from +9.9 (stored -9.9) to 54.0 — nothing else exists.
    const hcp = handicapIndex == null ? null : Math.max(-9.9, Math.min(54, handicapIndex));
    update((db) => {
      db.players.push({
        id: id("plr"), societyId, name, shortName: name.split(" ")[0],
        handicapIndex: hcp, active: true,
      });
    });
  },

  /**
   * Add a tee to a UK directory course, from the numbers on the printed card.
   * Same name twice = a correction, and overwrites. Returns the tee.
   */
  addTee(courseId: string, input: { name: string; par: number; cr: number; slope: number }): Tee {
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tee";
    const tee: Tee = {
      id: `${courseId}--${slug}`, courseId,
      name: input.name.trim() || "Tee", cr: input.cr, slope: input.slope, par: input.par,
    };
    update((db) => { db.customTees[tee.id] = tee; });
    return tee;
  },

  createEvent(
    societyId: string,
    input: {
      name: string; playsOn: string; teeId: string; playerIds: string[];
      /** name of the trip this day belongs to — found or created per society */
      seriesName?: string;
      /** how the day is scored; Stableford unless the organiser picked otherwise */
      format?: ScoringFormat;
      /**
       * Playing handicap allowance, %. 95 is the WHS default for individual
       * Stableford and is *mandatory* in England until 2028. Ireland, Scotland
       * and Wales allow 85/90/95/100 for singles from 1 Apr 2026, so this has
       * to be a choice rather than a constant.
       */
      handicapAllowance?: number;
      /** players may add themselves via the event's registration link */
      selfRegister?: boolean;
    }
  ) {
    const tee = teeById(input.teeId)!;
    const ev: GolfEvent = {
      id: id("evt"), societyId, courseId: tee.courseId, teeId: tee.id,
      name: input.name, playsOn: input.playsOn, format: input.format ?? "stableford",
      handicapAllowance: input.handicapAllowance ?? 95,
      status: "live", shareToken: token(), selfRegister: input.selfRegister ?? false,
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
      // An organiser-entered card (db.cards) wins over the built-in one — it's
      // the only card a directory course will ever have.
      const entered = ev?.teeId ? db.cards[ev.teeId] : undefined;
      const card = entered?.length === 18 ? entered : tee?.card;
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
          playedOn: ev.playsOn, format: ev.format, gross: null, adjustedGross: null,
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
    // 27 is three nines of aces; beyond 180 is ten a hole. Outside that isn't
    // a golf score, it's a typo — refuse it rather than post nonsense points.
    if (adjustedGross != null && (adjustedGross < 27 || adjustedGross > 180)) return;
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
        format: ev.format, gross: adjustedGross, adjustedGross,
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

  /** A season ends up wrong or duplicated — remove it. Rounds stay; they
   *  belong to events and players, not to the season's table. */
  deleteSeason(seasonId: string) {
    update((db) => { db.seasons = db.seasons.filter((s) => s.id !== seasonId); });
  },

  /** Remove a society and EVERYTHING inside it. The confirm UI upstream is
   *  responsible for making sure the organiser knows exactly what that is. */
  deleteSociety(societyId: string) {
    update((db) => {
      const evIds = new Set(db.events.filter((e) => e.societyId === societyId).map((e) => e.id));
      const plIds = new Set(db.players.filter((p) => p.societyId === societyId).map((p) => p.id));
      const rounds = db.rounds.filter(
        (r) => (r.eventId && evIds.has(r.eventId)) || plIds.has(r.playerId)
      );
      const roundIds = new Set(rounds.map((r) => r.id));
      db.holeScores = db.holeScores.filter((h) => !roundIds.has(h.roundId));
      db.rounds = db.rounds.filter((r) => !roundIds.has(r.id));
      db.sideComps = db.sideComps.filter((s) => !evIds.has(s.eventId));
      db.entries = db.entries.filter((e) => !evIds.has(e.eventId));
      db.groups = db.groups.filter((g) => !evIds.has(g.eventId));
      db.events = db.events.filter((e) => e.societyId !== societyId);
      db.seasons = db.seasons.filter((s) => s.societyId !== societyId);
      db.series = db.series.filter((s) => s.societyId !== societyId);
      db.players = db.players.filter((p) => p.societyId !== societyId);
      db.societies = db.societies.filter((s) => s.id !== societyId);
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
  // Accepts the slug or the id. Internal links navigate by id — ids are
  // unique by construction, so two societies can never route to one page
  // even if their slugs somehow collide (the "Test opens To and J" bug).
  society: (db: DB, key: string) =>
    db.societies.find((s) => s.id === key) ?? db.societies.find((s) => s.slug === key),
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

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

import { useSyncExternalStore } from "react";
import type {
  EventEntry, GolfEvent, Player, Round, Season, SideComp, Society,
} from "./types";
import { teeById } from "./courses";
import { courseHandicap, playingHandicap } from "./scoring";

const KEY = "societee.v1";

export type DB = {
  societies: Society[];
  players: Player[];
  seasons: Season[];
  events: GolfEvent[];
  entries: EventEntry[];
  rounds: Round[];
  sideComps: SideComp[];
};

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
  const db: DB = { societies: [], players: [], seasons: [], events: [], entries: [], rounds: [], sideComps: [] };

  /* ---------- Society 1: a season-long Order of Merit across the summer ---- */
  const wanderers: Society = {
    id: "soc-wanderers", slug: "fairway-wanderers", name: "Fairway Wanderers",
    homeClub: "Conwy (Caernarvonshire)", accent: "#0B3D2C", createdAt: "2026-05-28",
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
    homeClub: "Nomadic", accent: "#0B3D2C", createdAt: "2026-06-14",
  };
  db.societies.push(swindle);

  const tee = teeById("conwy-white")!;
  const ev: GolfEvent = {
    id: "evt-swindle-aug", societyId: swindle.id, courseId: "conwy", teeId: tee.id,
    name: "August Meeting", playsOn: "2026-08-01", teeTime: "09:20",
    format: "stableford", handicapAllowance: 95, status: "live",
    shareToken: "augmeet", notes: "£10 in the pot. Two-tee start.",
  };
  db.events.push(ev);

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
    cache = raw ? (JSON.parse(raw) as DB) : seed();
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

export function useDB(): DB {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    read,
    () => read()
  );
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
  createSociety(name: string, homeClub?: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const soc: Society = { id: id("soc"), slug, name, homeClub, accent: "#0B3D2C", createdAt: new Date().toISOString().slice(0, 10) };
    update((db) => { db.societies.push(soc); });
    return soc;
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
    });
    return ev;
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
};

/* --------------------------------------------------------------- selectors -- */

export const select = {
  society: (db: DB, slug: string) => db.societies.find((s) => s.slug === slug),
  players: (db: DB, societyId: string) => db.players.filter((p) => p.societyId === societyId && p.active),
  events: (db: DB, societyId: string) =>
    db.events.filter((e) => e.societyId === societyId).sort((a, b) => b.playsOn.localeCompare(a.playsOn)),
  event: (db: DB, eventId: string) => db.events.find((e) => e.id === eventId),
  eventByToken: (db: DB, t: string) => db.events.find((e) => e.shareToken === t),
  entries: (db: DB, eventId: string) => db.entries.filter((e) => e.eventId === eventId),
  roundsForEvent: (db: DB, eventId: string) => db.rounds.filter((r) => r.eventId === eventId),
  roundsForPlayer: (db: DB, playerId: string) =>
    db.rounds.filter((r) => r.playerId === playerId).sort((a, b) => b.playedOn.localeCompare(a.playedOn)),
  currentSeason: (db: DB, societyId: string) =>
    db.seasons.find((s) => s.societyId === societyId && s.isCurrent),
  sideComps: (db: DB, eventId: string) => db.sideComps.filter((s) => s.eventId === eventId),
};

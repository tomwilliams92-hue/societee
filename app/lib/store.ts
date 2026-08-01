"use client";

/* ---------------------------------------------------------------------------
 * DATA LAYER — demo implementation.
 *
 * Everything the UI needs goes through this module. It currently persists to
 * localStorage so the whole product is clickable with no accounts, no keys and
 * no network. When Supabase is wired up, this one file is replaced with calls
 * to the tables in supabase/schema.sql — the shapes are deliberately identical.
 * No page imports supabase directly. Keep it that way.
 * ------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";
import type {
  EventEntry, GolfEvent, Player, Round, Season, SideComp, Society,
} from "./types";
import { COURSES, teeById } from "./courses";
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

/** Real rounds carried across from Conwy Choppers: [date, courseId, points, gross, courseHcp] */
const CHOPPERS_ROUNDS: Record<string, [string, string, number, number, number][]> = {
  tom: [
    ["2026-07-22", "conwy", 35, 74, 1], ["2026-06-21", "conwy", 35, 74, 1],
    ["2026-07-29", "conwy", 34, 75, 1], ["2026-07-09", "wallasey", 34, 73, -1],
    ["2026-07-01", "bromborough", 34, 73, -1], ["2026-05-30", "conwy", 33, 76, 1],
    ["2026-07-11", "conwy", 32, 77, 1], ["2026-06-20", "conwy", 32, 77, 1],
    ["2026-07-19", "stmelyd", 31, 72, -2], ["2026-07-08", "conwy", 28, 78, -2],
  ],
  josh: [
    ["2026-07-09", "wallasey", 36, 76, 4], ["2026-07-14", "abergele", 33, 78, 3],
    ["2026-05-30", "conwy", 30, 84, 6], ["2026-07-22", "conwy", 28, 86, 6],
    ["2026-07-19", "stmelyd", 28, 79, 2], ["2026-07-04", "conwy", 27, 84, 3],
    ["2026-06-20", "conwy", 26, 88, 6],
  ],
  callum: [
    ["2026-06-05", "conwy", 36, 101, 29], ["2026-07-22", "conwy", 34, 103, 29],
    ["2026-07-19", "stmelyd", 33, 94, 22], ["2026-07-17", "conwy", 28, 109, 29],
    ["2026-06-20", "conwy", 17, 120, 29], ["2026-07-04", "conwy", 15, 116, 23],
  ],
};

const DOGS = [
  ["Dave Prichard", 12.4], ["Steve Hughes", 18.1], ["Mark Ellis", 8.7],
  ["John Roberts", 24.2], ["Pete Vaughan", 15.0], ["Gareth Lloyd", 6.3],
  ["Ryan Doyle", 20.8], ["Liam Foster", 11.2], ["Chris Nolan", 27.4],
  ["Aled Jones", 9.9], ["Sam Whitfield", 16.6], ["Owen Price", 4.1],
] as const;

function seed(): DB {
  const db: DB = { societies: [], players: [], seasons: [], events: [], entries: [], rounds: [], sideComps: [] };

  /* -------- Society 1: Conwy Choppers — a season-long Order of Merit -------- */
  const choppers: Society = {
    id: "soc-choppers", slug: "conwy-choppers", name: "Conwy Choppers",
    homeClub: "Conwy (Caernarvonshire)", accent: "#0B3D2C", createdAt: "2026-05-28",
  };
  db.societies.push(choppers);
  db.seasons.push({
    id: "sea-2026", societyId: choppers.id, name: "Summer Order of Merit 2026",
    startsOn: "2026-05-30", endsOn: "2026-09-30", bestN: 6,
    prize: "Two sleeves of balls from every loser", isCurrent: true,
  });

  const chopperPlayers: [string, string, string, number][] = [
    ["tom", "Tom Williams", "Tom", -1.6],
    ["josh", "Josh Morris", "Josh", 3.0],
    ["callum", "Callum Bennett", "Callum", 21.3],
  ];
  for (const [key, name, short, hcp] of chopperPlayers) {
    db.players.push({ id: `plr-${key}`, societyId: choppers.id, name, shortName: short, handicapIndex: hcp, active: true });
    for (const [date, courseId, points, gross, chcp] of CHOPPERS_ROUNDS[key]) {
      const tee = COURSES.find((c) => c.id === courseId)!.tees[courseId === "conwy" ? 1 : 0];
      db.rounds.push({
        id: id("rnd"), playerId: `plr-${key}`,
        eventId: null,                    // ← an ordinary club round, not a society day
        courseId, teeId: tee.id, playedOn: date, format: "stableford",
        gross, adjustedGross: gross, courseHandicap: chcp, stableford: points,
        net: gross - chcp, source: "whs_import", verified: true,
      });
    }
  }

  /* ---------- Society 2: Weekend Dogs — a live golf day, 12 players ---------- */
  const dogs: Society = {
    id: "soc-dogs", slug: "weekend-dogs", name: "Weekend Dogs",
    homeClub: "Nomadic", accent: "#0B3D2C", createdAt: "2026-06-14",
  };
  db.societies.push(dogs);

  const tee = teeById("conwy-white")!;
  const ev: GolfEvent = {
    id: "evt-dogs-aug", societyId: dogs.id, courseId: "conwy", teeId: tee.id,
    name: "August Meeting", playsOn: "2026-08-01", teeTime: "09:20",
    format: "stableford", handicapAllowance: 95, status: "live",
    shareToken: "dogsaug", notes: "£10 in the pot. Two-tee start.",
  };
  db.events.push(ev);

  // A believable spread of a day half-played: some in, some still out there.
  const played = [38, 36, 35, 34, 33, 31, 30, 28, null, null, null, null];
  DOGS.forEach(([name, hcp], i) => {
    const pid = id("plr");
    db.players.push({
      id: pid, societyId: dogs.id, name,
      shortName: name.split(" ")[0], handicapIndex: hcp, active: true,
    });
    const ch = courseHandicap(hcp, tee);
    const ph = playingHandicap(ch, ev.handicapAllowance);
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

  createEvent(societyId: string, input: { name: string; playsOn: string; teeId: string; playerIds: string[] }) {
    const tee = teeById(input.teeId)!;
    const ev: GolfEvent = {
      id: id("evt"), societyId, courseId: tee.courseId, teeId: tee.id,
      name: input.name, playsOn: input.playsOn, format: "stableford",
      handicapAllowance: 95, status: "live", shareToken: token(),
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

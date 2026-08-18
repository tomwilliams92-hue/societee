"use client";

/* ---------------------------------------------------------------------------
 * REMOTE ADAPTER — the same store, backed by Supabase.
 *
 * Shape of the deal: the UI never changes. It still calls actions.x() and reads
 * useDB() synchronously. Here every action applies the change to the in-memory
 * snapshot FIRST (so the screen reacts instantly, which matters when someone is
 * tapping a stepper between shots) and pushes it to Postgres straight after.
 *
 * Ids are generated client-side as uuids so the optimistic row and the stored
 * row are the same row — no reconciling temporary ids afterwards.
 *
 * A realtime subscription reloads the snapshot when anyone else writes, which
 * is what makes one group's scoring appear on everybody else's leaderboard.
 * ------------------------------------------------------------------------- */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EventEntry, EventGroup, GolfEvent, HoleScore, Player, Round, Season, SideComp, Society,
} from "../types";
import type { DB } from "../store";

export const uid = () => crypto.randomUUID();

/* --------------------------------------------------------------- mapping -- */
/* Postgres is snake_case, the app is camelCase. Keep every conversion here so
   a column rename is a one-file change. */

type Row = Record<string, unknown>;

const toSociety = (r: Row): Society => ({
  id: r.id as string, slug: r.slug as string, name: r.name as string,
  homeClub: (r.home_club as string) ?? undefined, accent: (r.accent as string) ?? undefined,
  createdAt: (r.created_at as string) ?? "",
});
const fromSociety = (s: Society, ownerId: string): Row => ({
  id: s.id, owner_id: ownerId, name: s.name, slug: s.slug,
  home_club: s.homeClub ?? null, accent: s.accent ?? null,
});

const toPlayer = (r: Row): Player => ({
  id: r.id as string, societyId: r.society_id as string, name: r.name as string,
  shortName: (r.short_name as string) ?? undefined,
  handicapIndex: r.handicap_index == null ? null : Number(r.handicap_index),
  active: r.active as boolean,
});
const fromPlayer = (p: Player): Row => ({
  id: p.id, society_id: p.societyId, name: p.name, short_name: p.shortName ?? null,
  handicap_index: p.handicapIndex, active: p.active,
});

const toSeason = (r: Row): Season => ({
  id: r.id as string, societyId: r.society_id as string, name: r.name as string,
  startsOn: r.starts_on as string, endsOn: r.ends_on as string,
  bestN: (r.best_n as number) ?? null, prize: (r.prize as string) ?? undefined,
  isCurrent: r.is_current as boolean,
});
const fromSeason = (s: Season): Row => ({
  id: s.id, society_id: s.societyId, name: s.name, starts_on: s.startsOn,
  ends_on: s.endsOn, best_n: s.bestN, prize: s.prize ?? null, is_current: s.isCurrent,
});

const toEvent = (r: Row): GolfEvent => ({
  id: r.id as string, societyId: r.society_id as string,
  seasonId: (r.season_id as string) ?? null,
  courseId: (r.course_id as string) ?? undefined, teeId: (r.tee_id as string) ?? undefined,
  name: r.name as string, playsOn: r.plays_on as string,
  teeTime: (r.tee_time as string) ?? undefined,
  format: r.format as GolfEvent["format"],
  handicapAllowance: r.handicap_allowance as number,
  status: r.status as GolfEvent["status"], shareToken: r.share_token as string,
  notes: (r.notes as string) ?? undefined,
  selfRegister: Boolean(r.self_register),
});
const fromEvent = (e: GolfEvent): Row => ({
  id: e.id, society_id: e.societyId, season_id: e.seasonId ?? null,
  course_id: e.courseId ?? null, tee_id: e.teeId ?? null, name: e.name,
  plays_on: e.playsOn, tee_time: e.teeTime ?? null, format: e.format,
  handicap_allowance: e.handicapAllowance, status: e.status,
  share_token: e.shareToken, notes: e.notes ?? null,
  self_register: e.selfRegister ?? false,
});

const toGroup = (r: Row): EventGroup => ({
  id: r.id as string, eventId: r.event_id as string, groupNo: r.group_no as number,
  startHole: r.start_hole as number, scorerToken: r.scorer_token as string,
});
const fromGroup = (g: EventGroup): Row => ({
  id: g.id, event_id: g.eventId, group_no: g.groupNo,
  start_hole: g.startHole, scorer_token: g.scorerToken,
});

const toEntry = (r: Row): EventEntry => ({
  id: r.id as string, eventId: r.event_id as string, playerId: r.player_id as string,
  playingHandicap: (r.playing_handicap as number) ?? null,
  groupNo: (r.group_no as number) ?? undefined, startHole: (r.start_hole as number) ?? undefined,
});
const fromEntry = (e: EventEntry): Row => ({
  id: e.id, event_id: e.eventId, player_id: e.playerId,
  playing_handicap: e.playingHandicap, group_no: e.groupNo ?? null,
  start_hole: e.startHole ?? 1,
});

const toRound = (r: Row): Round => ({
  id: r.id as string, playerId: r.player_id as string,
  eventId: (r.event_id as string) ?? null,
  courseId: (r.course_id as string) ?? undefined, teeId: (r.tee_id as string) ?? undefined,
  playedOn: r.played_on as string, format: r.format as Round["format"],
  gross: (r.gross as number) ?? null, adjustedGross: (r.adjusted_gross as number) ?? null,
  courseHandicap: (r.course_handicap as number) ?? null,
  stableford: (r.stableford as number) ?? null, net: (r.net as number) ?? null,
  source: r.source as Round["source"], verified: r.verified as boolean,
});
const fromRound = (r: Round): Row => ({
  id: r.id, player_id: r.playerId, event_id: r.eventId, course_id: r.courseId ?? null,
  tee_id: r.teeId ?? null, played_on: r.playedOn, format: r.format, gross: r.gross,
  adjusted_gross: r.adjustedGross, course_handicap: r.courseHandicap,
  stableford: r.stableford, net: r.net, source: r.source, verified: r.verified,
});

const toHoleScore = (r: Row): HoleScore => ({
  roundId: r.round_id as string, hole: r.hole as number,
  strokes: (r.strokes as number) ?? null, points: (r.points as number) ?? null,
});
const fromHoleScore = (h: HoleScore): Row => ({
  round_id: h.roundId, hole: h.hole, strokes: h.strokes, points: h.points,
});

const toSideComp = (r: Row): SideComp => ({
  id: r.id as string, eventId: r.event_id as string, kind: r.kind as string,
  hole: (r.hole as number) ?? undefined, winnerId: (r.winner_id as string) ?? null,
  detail: (r.detail as string) ?? undefined,
});

export const map = {
  toSociety, fromSociety, toPlayer, fromPlayer, toSeason, fromSeason,
  toEvent, fromEvent, toGroup, fromGroup, toEntry, fromEntry,
  toRound, fromRound, toHoleScore, fromHoleScore, toSideComp,
};

/* ------------------------------------------------------------------ load -- */

const EMPTY_DB: DB = {
  societies: [], players: [], seasons: [], events: [], groups: [],
  entries: [], rounds: [], holeScores: [], sideComps: [], series: [], cards: {},
  customTees: {}, me: null,
};

/**
 * Everything the signed-in organiser can see. RLS does the filtering — we ask
 * for whole tables and Postgres returns only their societies' rows.
 */
export async function loadAll(sb: SupabaseClient): Promise<DB> {
  const [societies, players, seasons, events, groups, entries, rounds, holeScores, sideComps] =
    await Promise.all([
      sb.from("societies").select("*"),
      sb.from("players").select("*"),
      sb.from("seasons").select("*"),
      sb.from("events").select("*"),
      sb.from("event_groups").select("*"),
      sb.from("event_entries").select("*"),
      sb.from("rounds").select("*"),
      sb.from("hole_scores").select("*"),
      sb.from("side_comps").select("*"),
    ]);

  const err = [societies, players, seasons, events, groups, entries, rounds, holeScores, sideComps]
    .find((r) => r.error)?.error;
  if (err) throw new Error(err.message);

  return {
    ...EMPTY_DB,
    societies: (societies.data ?? []).map(toSociety),
    players: (players.data ?? []).map(toPlayer),
    seasons: (seasons.data ?? []).map(toSeason),
    events: (events.data ?? []).map(toEvent),
    groups: (groups.data ?? []).map(toGroup),
    entries: (entries.data ?? []).map(toEntry),
    rounds: (rounds.data ?? []).map(toRound),
    holeScores: (holeScores.data ?? []).map(toHoleScore),
    sideComps: (sideComps.data ?? []).map(toSideComp),
  };
}

/**
 * Read one event's board without being signed in — the QR-code path.
 * Goes through the security-definer function in schema.sql, so anonymous
 * visitors never get raw table access, only this payload.
 */
export async function loadPublicBoard(sb: SupabaseClient, token: string) {
  const { data, error } = await sb.rpc("public_leaderboard", { token });
  if (error) throw new Error(error.message);
  return data as unknown;
}

/* -------------------------------------------------------------- realtime -- */

/** Reload whenever anyone writes to the tables a live board depends on. */
export function subscribeToChanges(sb: SupabaseClient, onChange: () => void) {
  const channel = sb
    .channel("societee-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "rounds" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "hole_scores" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "event_entries" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, onChange)
    .subscribe();
  return () => { void sb.removeChannel(channel); };
}

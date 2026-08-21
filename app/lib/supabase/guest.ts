"use client";

/* ---------------------------------------------------------------------------
 * GUEST DATA — the QR-code paths, remote edition.
 *
 * A spectator or a scoring fourball has no account and no synced store; their
 * token is the credential. These hooks fetch the security-definer payload for
 * that token, convert it into ordinary store rows, and hydrate them in — so
 * the board and scorer components render from the store exactly as they do in
 * demo mode, per-hole detail and all. Fresh data arrives by polling: anonymous
 * clients get no realtime (no table grants), and a 10s poll on a leaderboard
 * is indistinguishable from live.
 * ------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { supabase } from "./client";
import { IS_REMOTE } from "./config";
import { hydrateRemote, readDB, update, type DB } from "../store";
import type { HoleInfo } from "../types";

type Row = Record<string, never>;

/** Payload → store rows. Only the collections the guest screens read. */
function fragmentFromBoard(d: {
  event: Row; society: Row; tee: Row | null; holes: Row[];
  players: Row[]; entries: Row[]; rounds: Row[]; hole_scores: Row[]; side_comps: Row[];
  group?: Row;
}, shareToken = ""): Partial<DB> & { card?: { teeId: string; holes: HoleInfo[] } } {
  const e = d.event as Record<string, unknown>;
  const s = d.society as Record<string, unknown>;
  const frag: Partial<DB> & { card?: { teeId: string; holes: HoleInfo[] } } = {
    societies: [{
      id: String(s.id), slug: String(s.slug ?? "shared"), name: String(s.name),
      accent: (s.accent as string) ?? undefined, createdAt: "",
    }],
    events: [{
      id: String(e.id), societyId: String(e.society_id),
      seasonId: (e.season_id as string) ?? null,
      courseId: (e.course_id as string) ?? undefined, teeId: (e.tee_id as string) ?? undefined,
      name: String(e.name), playsOn: String(e.plays_on),
      format: e.format as never, handicapAllowance: Number(e.handicap_allowance ?? 95),
      // The RPC strips share_token from the payload (it IS the credential),
      // but the board page finds its event BY that token — so the caller
      // passes the token it fetched with, and we stamp it back on.
      status: e.status as never, shareToken, selfRegister: Boolean(e.self_register),
    }],
    players: d.players.map((p: Record<string, unknown>) => ({
      id: String(p.id), societyId: String(s.id), name: String(p.name),
      shortName: (p.short_name as string) ?? undefined,
      handicapIndex: p.handicap_index == null ? null : Number(p.handicap_index),
      active: true,
    })),
    entries: d.entries.map((x: Record<string, unknown>) => ({
      id: String(x.id), eventId: String(x.event_id), playerId: String(x.player_id),
      playingHandicap: (x.playing_handicap as number) ?? null,
      groupNo: (x.group_no as number) ?? undefined,
      startHole: (x.start_hole as number) ?? undefined,
    })),
    rounds: d.rounds.map((r: Record<string, unknown>) => ({
      id: String(r.id), playerId: String(r.player_id), eventId: String(r.event_id),
      courseId: (r.course_id as string) ?? undefined, teeId: (r.tee_id as string) ?? undefined,
      playedOn: String(r.played_on), format: r.format as never,
      gross: (r.gross as number) ?? null, adjustedGross: (r.adjusted_gross as number) ?? null,
      courseHandicap: (r.course_handicap as number) ?? null,
      stableford: (r.stableford as number) ?? null, net: (r.net as number) ?? null,
      source: (r.source as never) ?? "live_scoring", verified: Boolean(r.verified),
    })),
    holeScores: d.hole_scores.map((h: Record<string, unknown>) => ({
      roundId: String(h.round_id), hole: Number(h.hole),
      strokes: (h.strokes as number) ?? null, points: (h.points as number) ?? null,
    })),
    sideComps: d.side_comps.map((sc: Record<string, unknown>) => ({
      id: String(sc.id), eventId: String(sc.event_id), kind: String(sc.kind),
      hole: (sc.hole as number) ?? undefined, winnerId: (sc.winner_id as string) ?? null,
      detail: (sc.detail as string) ?? undefined,
    })),
  };
  if (e.tee_id && d.holes?.length) {
    frag.card = {
      teeId: String(e.tee_id),
      holes: d.holes.map((h: Record<string, unknown>) => ({
        hole: Number(h.hole), par: Number(h.par), strokeIndex: Number(h.stroke_index),
      })),
    };
  }
  return frag;
}

function applyFragment(frag: ReturnType<typeof fragmentFromBoard>, extras?: Partial<DB>) {
  const { card, ...rows } = frag;
  // MERGE the fragment into what's already here, never replace whole tables:
  // a signed-in organiser opening someone else's board must not have their
  // own societies swapped out from under them. Fragment rows win on key.
  const cur = readDB();
  const merged: Partial<DB> = {};
  const keyOf = (t: string, r: Record<string, unknown>) =>
    t === "holeScores" ? `${r.roundId}:${r.hole}` : String(r.id);
  for (const [t, fragRows] of Object.entries({ ...rows, ...extras })) {
    if (!Array.isArray(fragRows)) continue;
    const have = new Set(fragRows.map((r) => keyOf(t, r as Record<string, unknown>)));
    const existing = ((cur as unknown as Record<string, unknown[]>)[t] ?? [])
      .filter((r) => !have.has(keyOf(t, r as Record<string, unknown>)));
    (merged as Record<string, unknown>)[t] = [...existing, ...fragRows];
  }
  hydrateRemote(merged);
  if (card) {
    // through update() so registerCustomTees/cards land in the same place the
    // organiser's entered cards do — select.card() then just finds it
    update((db) => { db.cards[card.teeId] = card.holes; });
  }
}

/** Spectator board. Fetches on mount, then polls while the tab is visible. */
export function useGuestBoard(token: string, active: boolean) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "missing" | "offline">(
    active ? "loading" : "idle"
  );
  useEffect(() => {
    if (!active || !IS_REMOTE) return;
    const sb = supabase()!;
    let stop = false;
    const fetchOnce = async () => {
      const { data, error } = await sb.rpc("public_board_full", { token });
      if (stop) return;
      if (error) { setState("offline"); return; }
      if (!data) { setState("missing"); return; }
      applyFragment(fragmentFromBoard(data as never, token));
      setState("ok");
    };
    void fetchOnce();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void fetchOnce();
    }, 10_000);
    return () => { stop = true; clearInterval(t); };
  }, [token, active]);
  return state;
}

/** Scoring fourball. Same shape plus the group row; writes go through the
 *  score_hole RPC — the server computes points from the stored card. */
export function useGuestGroup(token: string, active: boolean) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "missing" | "offline">(
    active ? "loading" : "idle"
  );
  useEffect(() => {
    if (!active || !IS_REMOTE) return;
    const sb = supabase()!;
    let stop = false;
    const fetchOnce = async () => {
      const { data, error } = await sb.rpc("scorer_group", { token });
      if (stop) return;
      if (error) { setState("offline"); return; }
      if (!data) { setState("missing"); return; }
      const d = data as Record<string, never>;
      const g = d.group as Record<string, unknown>;
      const e = d.event as Record<string, unknown>;
      const players = (d.players as Record<string, unknown>[]) ?? [];
      const frag = fragmentFromBoard({
        event: e as never,
        society: { id: e.society_id, name: "", slug: "shared" } as never,
        tee: (d.tee as never) ?? null,
        holes: ((d.holes as Row[]) ?? []) as never[],
        players: players.map((p) => ({
          id: p.player_id, name: p.name, short_name: p.short_name, handicap_index: null,
        })) as never[],
        entries: players.map((p, i) => ({
          id: `entry-${i}`, event_id: e.id, player_id: p.player_id,
          playing_handicap: p.playing_handicap, group_no: g.group_no, start_hole: g.start_hole,
        })) as never[],
        rounds: players.map((p, i) => ({
          id: `round-${p.player_id}`, player_id: p.player_id, event_id: e.id,
          course_id: e.course_id, tee_id: e.tee_id, played_on: e.plays_on,
          format: e.format, source: "live_scoring",
        })) as never[],
        hole_scores: players.flatMap((p) =>
          ((p.holes as Record<string, unknown>[]) ?? []).map((h) => ({
            round_id: `round-${p.player_id}`, hole: h.hole, strokes: h.strokes, points: h.points,
          }))
        ) as never[],
        side_comps: [] as never[],
      });
      applyFragment(frag, {
        groups: [{
          id: String(g.id), eventId: String(e.id), groupNo: Number(g.group_no),
          startHole: Number(g.start_hole), scorerToken: token,
        }],
      });
      setState("ok");
    };
    void fetchOnce();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void fetchOnce();
    }, 12_000);
    return () => { stop = true; clearInterval(t); };
  }, [token, active]);
  return state;
}

/** Write one hole through the token RPC. Returns an error message or null. */
export async function guestScoreHole(
  token: string, playerId: string, hole: number, strokes: number | null
): Promise<string | null> {
  const sb = supabase();
  if (!sb) return "not configured";
  const { error } = await sb.rpc("score_hole", {
    token, p_player_id: playerId, p_hole: hole, p_strokes: strokes,
  });
  return error ? error.message : null;
}

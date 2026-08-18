"use client";

/* ---------------------------------------------------------------------------
 * SYNC ENGINE — the moving part between the store and Postgres.
 *
 * The contract with the UI is unchanged: actions mutate the local snapshot and
 * the screen reacts instantly. This module watches those commits, works out
 * which rows changed, and pushes exactly those (parents before children, so
 * foreign keys never see an orphan). Pulls happen on sign-in, on reconnect,
 * and whenever realtime says someone else wrote.
 *
 * Failure is a state, not an exception: no signal on the 14th tee leaves the
 * app on its cached snapshot with the dirty diff queued; it drains when bars
 * come back. Nothing is lost, nothing blocks a stepper tap.
 * ------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";
import { supabase } from "./client";
import { IS_REMOTE } from "./config";
import { loadAll, map, uid } from "./remote";
import {
  onCommit, hydrateRemote, readDB, readLocalDemoDB, update, type DB,
} from "../store";
import { COURSES, UK_DIRECTORY, courseById, teeById } from "../courses";
import type { Tee } from "../types";

/* ---------------------------------------------------------------- status -- */

export type SyncStatus = "off" | "signedout" | "syncing" | "live" | "offline" | "error";

let status: SyncStatus = IS_REMOTE ? "signedout" : "off";
let statusDetail = "";
let userEmail: string | null = null;
let userId: string | null = null;
/** False until Supabase has restored (or denied) the saved session — the gate
 *  shows nothing rather than flashing a sign-in form at a signed-in user. */
let authKnown = !IS_REMOTE;
const statusListeners = new Set<() => void>();

function setStatus(s: SyncStatus, detail = "") {
  status = s;
  statusDetail = detail;
  statusListeners.forEach((l) => l());
}

let statusSnapshot: { status: SyncStatus; detail: string; email: string | null; known: boolean } = {
  status, detail: statusDetail, email: userEmail, known: authKnown,
};
function snapStatus() {
  if (
    statusSnapshot.status !== status ||
    statusSnapshot.detail !== statusDetail ||
    statusSnapshot.email !== userEmail ||
    statusSnapshot.known !== authKnown
  ) {
    statusSnapshot = { status, detail: statusDetail, email: userEmail, known: authKnown };
  }
  return statusSnapshot;
}

export function useSync() {
  return useSyncExternalStore(
    (l) => { statusListeners.add(l); return () => { statusListeners.delete(l); }; },
    snapStatus,
    snapStatus
  );
}

/* ------------------------------------------------------- change tracking -- */

/** The synced collections, in parent-before-child order. */
const TABLES = [
  "societies", "players", "seasons", "events", "groups",
  "entries", "rounds", "holeScores", "sideComps",
] as const;
type Synced = (typeof TABLES)[number];

const SQL_NAME: Record<Synced, string> = {
  societies: "societies", players: "players", seasons: "seasons", events: "events",
  groups: "event_groups", entries: "event_entries", rounds: "rounds",
  holeScores: "hole_scores", sideComps: "side_comps",
};

const rowKey = (t: Synced, r: Record<string, unknown>) =>
  t === "holeScores" ? `${r.roundId}:${r.hole}` : String(r.id);

type Baseline = Record<Synced, Map<string, string>>;

function baselineOf(db: DB): Baseline {
  const b = {} as Baseline;
  for (const t of TABLES) {
    b[t] = new Map((db[t] as Record<string, unknown>[]).map((r) => [rowKey(t, r), JSON.stringify(r)]));
  }
  return b;
}

/** What the server is known to hold. Diffs are computed against this. */
let pushed: Baseline | null = null;

/*
 * The baseline's KEYS survive restarts. Without this, a row that never reached
 * the server (push failed, app closed mid-flush) was indistinguishable at the
 * next launch from a row deleted on another device — and the launch pull wiped
 * it. That was "why is it not saving my societies": create → push fails
 * (e.g. slug collision) → relaunch → gone. With the keys persisted, pull keeps
 * anything local the server was never known to hold, and re-pushes it.
 */
const PUSHED_KEY = "societee.pushed-keys.v1";

function savePushedKeys(b: Baseline) {
  try {
    window.localStorage.setItem(
      PUSHED_KEY,
      JSON.stringify(Object.fromEntries(TABLES.map((t) => [t, [...b[t].keys()]])))
    );
  } catch { /* private mode — merge just errs on the keep side */ }
}

function loadPushedKeys(): Partial<Record<Synced, string[]>> | null {
  try {
    const raw = window.localStorage.getItem(PUSHED_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<Synced, string[]>>) : null;
  } catch { return null; }
}
let dirty: DB | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;

/* ----------------------------------------------------------------- start -- */

let started = false;
let unsubCommit: (() => void) | null = null;
let unsubRealtime: (() => void) | null = null;

export function startSync() {
  if (started || !IS_REMOTE || typeof window === "undefined") return;
  started = true;
  const sb = supabase()!;

  sb.auth.onAuthStateChange((_evt: string, session: { user?: { id: string; email?: string } } | null) => {
    authKnown = true;
    const user = session?.user ?? null;
    if (user && userId !== user.id) {
      userId = user.id;
      userEmail = user.email ?? null;
      void onSignedIn();
    } else if (!user && userId) {
      userId = null;
      userEmail = null;
      onSignedOut();
    } else {
      statusListeners.forEach((l) => l());
    }
  });

  window.addEventListener("online", () => { if (userId) void flush(true); });
}

async function onSignedIn() {
  const sb = supabase()!;
  setStatus("syncing", "pulling your societies");
  try {
    await sb.from("profiles").upsert({ id: userId, email: userEmail });
    await pull();
    unsubCommit ??= onCommit(scheduleFlush);
    unsubRealtime ??= subscribeRealtime();
    setStatus("live");
  } catch (e) {
    setStatus("error", e instanceof Error ? e.message : "sync failed");
  }
}

function onSignedOut() {
  unsubCommit?.(); unsubCommit = null;
  unsubRealtime?.(); unsubRealtime = null;
  pushed = null; dirty = null;
  try {
    window.localStorage.removeItem("societee.remote.v1");
    window.localStorage.removeItem(PUSHED_KEY);
  } catch { /* fine */ }
  hydrateRemote({
    societies: [], players: [], seasons: [], events: [], groups: [],
    entries: [], rounds: [], holeScores: [], sideComps: [],
  });
  setStatus("signedout");
}

async function pull() {
  const sb = supabase()!;
  const remote = await loadAll(sb);
  const local = readDB();
  const known = loadPushedKeys();

  // Merge, don't replace: a local row the server doesn't have is either
  // deleted-elsewhere (its key is in the persisted baseline — drop it) or
  // never-pushed (keep it, and flush it right after this pull).
  const merged: Partial<DB> = {};
  const onServer = {} as Record<Synced, Set<string>>;
  let kept = 0;
  for (const t of TABLES) {
    const remoteRows = remote[t] as unknown as Record<string, unknown>[];
    onServer[t] = new Set(remoteRows.map((r) => rowKey(t, r)));
    const wasPushed = known ? new Set(known[t] ?? []) : null;
    const keep = (local[t] as unknown as Record<string, unknown>[]).filter((r) => {
      const k = rowKey(t, r);
      return !onServer[t].has(k) && !(wasPushed?.has(k) ?? false);
    });
    kept += keep.length;
    (merged as Record<string, unknown>)[t] = [...remoteRows, ...keep];
  }

  // Badge and crest only live on this device (no server column yet) — carry
  // them across the pull instead of resetting every society to the default.
  merged.societies = merged.societies!.map((r) => {
    const loc = local.societies.find((l) => l.id === r.id);
    return loc && (loc.badge || loc.crestData)
      ? { ...r, badge: r.badge ?? loc.badge, crestData: r.crestData ?? loc.crestData }
      : r;
  });

  hydrateRemote(merged);

  // The diff baseline is what the SERVER holds — hashed from the merged rows
  // (so device-only fields like the badge don't read as endless phantom diffs),
  // restricted to keys the server actually returned.
  const serverSide = {} as DB;
  for (const t of TABLES) {
    (serverSide as unknown as Record<string, unknown>)[t] =
      (merged[t] as unknown as Record<string, unknown>[]).filter((r) => onServer[t].has(rowKey(t, r)));
  }
  pushed = baselineOf(serverSide);
  savePushedKeys(pushed);
  if (kept > 0) scheduleFlush(readDB());
}

function subscribeRealtime() {
  const sb = supabase()!;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const channel = sb
    .channel("societee-sync")
    .on("postgres_changes", { event: "*", schema: "public" }, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // A pull mid-push would clobber optimistic rows — the push's own
        // follow-up pull covers whatever this event was about.
        if (!dirty && !pushing) void pull().catch(() => setStatus("offline", "will retry"));
      }, 1200);
    })
    .subscribe();
  return () => { void sb.removeChannel(channel); };
}

/* ------------------------------------------------------------------ push -- */

function scheduleFlush(db: DB) {
  dirty = db;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { void flush(); }, 700);
}

/**
 * Courses and tees the changed rows point at must exist server-side first.
 * Community accumulation: the app inserts the course row, the tee's numbers,
 * and any organiser-entered card — insert-only, never overwriting anyone.
 */
async function ensureCourseRefs(db: DB, events: Record<string, unknown>[], rounds: Record<string, unknown>[]) {
  const sb = supabase()!;
  const teeIds = new Set<string>();
  const courseIds = new Set<string>();
  for (const r of [...events, ...rounds]) {
    if (r.teeId) teeIds.add(String(r.teeId));
    if (r.courseId) courseIds.add(String(r.courseId));
  }
  if (!courseIds.size && !teeIds.size) return;

  const courses = [...courseIds].map((cid) => {
    const c = courseById(cid) ?? COURSES.find((x) => x.id === cid) ??
      UK_DIRECTORY.find((x) => x.id === cid);
    return c
      ? { id: cid, name: c.name, county: ("county" in c ? c.county : null) ?? null, country: ("country" in c ? c.country : null) ?? "Wales" }
      : { id: cid, name: cid };
  });
  if (courses.length) {
    const { error } = await sb.from("courses").upsert(courses, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
  }

  const tees: Record<string, unknown>[] = [];
  const holes: Record<string, unknown>[] = [];
  for (const tid of teeIds) {
    const t: Tee | undefined = teeById(tid) ?? db.customTees[tid];
    if (!t) continue;
    tees.push({ id: t.id, course_id: t.courseId, name: t.name, cr: t.cr, slope: t.slope, par: t.par });
    const card = db.cards[t.id] ?? t.card;
    if (card) {
      for (const h of card) holes.push({ tee_id: t.id, hole: h.hole, par: h.par, stroke_index: h.strokeIndex });
    }
  }
  if (tees.length) {
    const { error } = await sb.from("tees").upsert(tees, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
  }
  if (holes.length) {
    const { error } = await sb.from("holes").upsert(holes, { onConflict: "tee_id,hole", ignoreDuplicates: true });
    if (error) throw error;
  }
}

const FROM_ROW: Record<Synced, (r: never) => Record<string, unknown>> = {
  societies: (r) => map.fromSociety(r, userId!),
  players: (r) => map.fromPlayer(r),
  seasons: (r) => map.fromSeason(r),
  events: (r) => map.fromEvent(r),
  groups: (r) => map.fromGroup(r),
  entries: (r) => map.fromEntry(r),
  rounds: (r) => map.fromRound(r),
  holeScores: (r) => map.fromHoleScore(r),
  sideComps: (r) => {
    const s = r as { id: string; eventId: string; kind: string; hole?: number; winnerId: string | null; detail?: string };
    return { id: s.id, event_id: s.eventId, kind: s.kind, hole: s.hole ?? null, winner_id: s.winnerId, detail: s.detail ?? null };
  },
};

async function flush(force = false) {
  if (pushing || !userId) return;
  const db = dirty;
  if (!db && !force) return;
  if (!db) return;
  if (!pushed) return;

  pushing = true;
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  const sb = supabase()!;

  try {
    const next = baselineOf(db);

    await ensureCourseRefs(
      db,
      db.events.filter((e) => next.events.get(e.id) !== pushed!.events.get(e.id)) as unknown as Record<string, unknown>[],
      db.rounds.filter((r) => next.rounds.get(r.id) !== pushed!.rounds.get(r.id)) as unknown as Record<string, unknown>[],
    );

    // upserts, parents first
    for (const t of TABLES) {
      const rows = (db[t] as Record<string, unknown>[])
        .filter((r) => next[t].get(rowKey(t, r)) !== pushed![t].get(rowKey(t, r)))
        .map((r) => FROM_ROW[t](r as never));
      if (!rows.length) continue;
      const conflict = t === "holeScores" ? "round_id,hole" : "id";
      const { error } = await sb.from(SQL_NAME[t]).upsert(rows, { onConflict: conflict });
      if (error) {
        // The slug column is globally unique server-side, so "Test" can crash
        // into a leftover row from an earlier device or account. Slugs are
        // cosmetic (links navigate by id) — rename locally and the automatic
        // retry lands the row instead of failing forever and losing it.
        if (t === "societies" && /duplicate key|unique constraint|23505/i.test(error.message)) {
          const ids = new Set(rows.map((r) => String(r.id)));
          update((d) => {
            for (const s of d.societies) if (ids.has(s.id)) s.slug = `${s.slug}-${uid().slice(0, 4)}`;
          });
        }
        throw new Error(`${SQL_NAME[t]}: ${error.message}`);
      }
    }

    // deletes, children first
    for (const t of [...TABLES].reverse()) {
      const gone = [...pushed![t].keys()].filter((k) => !next[t].has(k));
      if (!gone.length) continue;
      if (t === "holeScores") {
        for (const k of gone) {
          const [roundId, hole] = k.split(":");
          const { error } = await sb.from("hole_scores").delete().eq("round_id", roundId).eq("hole", Number(hole));
          if (error) throw new Error(`hole_scores: ${error.message}`);
        }
      } else {
        const { error } = await sb.from(SQL_NAME[t]).delete().in("id", gone);
        if (error) throw new Error(`${SQL_NAME[t]}: ${error.message}`);
      }
    }

    pushed = next;
    savePushedKeys(pushed);
    if (dirty === db) dirty = null;
    setStatus("live");
    // anything that raced in while we pushed goes on the next tick
    if (dirty) scheduleFlush(dirty);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    setStatus(offline ? "offline" : "error", offline ? "changes queued, will retry" : msg);
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { void flush(); }, 15000);
  } finally {
    pushing = false;
  }
}

/* ------------------------------------------------------------------ auth -- */

export async function signIn(email: string, password: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return "Remote mode is not configured.";
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (!error) return null;
  // Supabase deliberately won't say which of the two was wrong.
  if (/invalid login credentials/i.test(error.message)) {
    return "Email or password not recognised. New to Societee? Create an account below.";
  }
  return error.message;
}

export async function signUp(email: string, password: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return "Remote mode is not configured.";
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return "That email already has an account — sign in instead.";
    }
    return error.message;
  }
  if (!data.session) return "Account created — check your email to confirm it, then sign in.";
  return null;
}

export async function signOut() {
  await supabase()?.auth.signOut();
}

/* ------------------------------------------------------------- migration -- */

/**
 * One-time lift of this device's pre-account data into the account. Every id
 * except course/tee slugs becomes a uuid (the tables use uuid keys); relations
 * are rewritten through the same map, then a normal (non-silent) update lands
 * it all — the push engine treats it like any other change.
 */
export function migrateDeviceData(): { societies: number; players: number; rounds: number } | null {
  const old = readLocalDemoDB();
  if (!old || old.societies.length === 0) return null;

  const m = new Map<string, string>();
  const re = (k: string | null | undefined) => (k == null ? k : (m.get(k) ?? k));
  for (const t of TABLES) {
    for (const r of old[t] as { id?: string }[]) {
      if (r.id && !m.has(r.id)) m.set(r.id, uid());
    }
  }
  for (const s of old.series) if (!m.has(s.id)) m.set(s.id, uid());

  update((db) => {
    for (const s of old.societies) db.societies.push({ ...s, id: re(s.id)! });
    for (const p of old.players) db.players.push({ ...p, id: re(p.id)!, societyId: re(p.societyId)! });
    for (const s of old.seasons) db.seasons.push({ ...s, id: re(s.id)!, societyId: re(s.societyId)! });
    for (const e of old.events)
      db.events.push({ ...e, id: re(e.id)!, societyId: re(e.societyId)!, seasonId: re(e.seasonId) ?? null, seriesId: e.seriesId ? re(e.seriesId) : e.seriesId });
    for (const g of old.groups) db.groups.push({ ...g, id: re(g.id)!, eventId: re(g.eventId)! });
    for (const en of old.entries)
      db.entries.push({ ...en, id: re(en.id)!, eventId: re(en.eventId)!, playerId: re(en.playerId)! });
    for (const r of old.rounds)
      db.rounds.push({ ...r, id: re(r.id)!, playerId: re(r.playerId)!, eventId: re(r.eventId) ?? null });
    for (const h of old.holeScores) db.holeScores.push({ ...h, roundId: re(h.roundId)! });
    for (const sc of old.sideComps)
      db.sideComps.push({ ...sc, id: re(sc.id)!, eventId: re(sc.eventId)!, winnerId: re(sc.winnerId) ?? null });
    for (const se of old.series)
      db.series.push({ ...se, id: re(se.id)!, societyId: re(se.societyId)! });
    db.cards = { ...old.cards, ...db.cards };
    db.customTees = { ...old.customTees, ...db.customTees };
    db.me = db.me ?? old.me;
  });

  return { societies: old.societies.length, players: old.players.length, rounds: old.rounds.length };
}

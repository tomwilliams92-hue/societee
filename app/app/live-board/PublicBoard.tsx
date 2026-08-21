"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crest } from "@/components/Crest";
import { ScorecardModal } from "@/components/Scorecard";
import { useDB, useReady, select } from "@/lib/store";
import { formatPlayingHandicap, liveTotals, rank } from "@/lib/scoring";
import { courseById, teeById } from "@/lib/courses";
import { IS_REMOTE } from "@/lib/supabase/config";
import { useGuestBoard } from "@/lib/supabase/guest";

/**
 * The QR-code destination — the screen 24 golfers stare at for four hours.
 *
 * Mid-round it shows a running total AND how many holes each player has played,
 * because a bare number is misleading when half the field is still out there.
 */
export function PublicBoard({ token }: { token: string }) {
  const db = useDB();
  const ready = useReady();
  const ev = select.eventByToken(db, token);
  // Someone else's QR code on this phone: fetch the board through the token
  // RPC and hydrate it in — the rest of the component neither knows nor cares.
  const guest = useGuestBoard(token, IS_REMOTE && ready && !ev);
  const router = useRouter();
  const [now, setNow] = useState("");
  const [canBack, setCanBack] = useState(false);
  const [cardFor, setCardFor] = useState<string | null>(null);

  useEffect(() => setCanBack(window.history.length > 1), []);

  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  if (!ev) {
    const fetching = IS_REMOTE && (guest === "loading" || guest === "idle" || !ready);
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-center">
        <div>
          <Crest size={48} />
          <h1 className="display mt-4 text-2xl">
            {fetching ? "Fetching the board…" : guest === "offline" ? "No signal" : "That board isn’t live"}
          </h1>
          <p className="label mt-2">
            {fetching
              ? "One moment."
              : guest === "offline"
                ? "Couldn’t reach the scoreboard — it’ll keep trying."
                : "If the day was only just set up, it may still be uploading from the organiser’s phone — ask them to open Societee, then pull to refresh here."}
          </p>
        </div>
      </main>
    );
  }

  const society = db.societies.find((s) => s.id === ev.societyId)!;
  const course = courseById(ev.courseId);
  const tee = teeById(ev.teeId);
  const entries = select.entries(db, ev.id);
  const sideComps = select.sideComps(db, ev.id);
  const card = select.card(db, ev.teeId);
  const byHole = Boolean(card);

  // What the board ranks on follows the event's format: Stableford points
  // (high wins), or medal net / gross strokes (low wins — negated for rank()).
  const fmt = ev.format;
  const rows = rank(
    entries.map((en) => {
      const player = db.players.find((p) => p.id === en.playerId)!;
      const round = select.roundsForEvent(db, ev.id).find((r) => r.playerId === en.playerId);
      const holes = select.holesFor(db, ev.id, en.playerId);
      const live = byHole && holes.length
        ? liveTotals(holes, card!, en.playingHandicap ?? 0)
        : null;
      const gross = live ? live.strokes : round?.gross ?? null;
      const thru = live ? live.thru : round?.stableford != null ? 18 : 0;
      // Strokes 12 holes in aren't comparable with a finished 18 — medal and
      // gross boards only rank completed cards; Stableford ranks the running total.
      const complete = thru === 18;
      return {
        en, player, gross, thru,
        points:
          fmt === "medal" ? (complete ? round?.net ?? (gross == null || en.playingHandicap == null ? null : gross - en.playingHandicap) : null) :
          fmt === "gross" ? (complete ? gross : null) :
          live ? live.points : round?.stableford ?? null,
      };
    }),
    (r) => (r.thru === 0 || r.points == null ? null : fmt === "stableford" ? r.points : -r.points)
  );

  const started = rows.filter((r) => r.thru > 0).length;

  return (
    <main className="safe-top flex-1 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-xl">
        {/* ------------------------------------------------- ticker head -- */}
        <header className="rise">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {canBack && (
                <button
                  onClick={() => router.back()}
                  aria-label="Back"
                  className="grid h-9 w-9 place-items-center rounded-full border"
                  style={{ borderColor: "var(--color-acid)", color: "var(--color-acid)", background: "rgba(47,219,0,0.08)" }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18 9 12l6-6" /></svg>
                </button>
              )}
              <Crest size={26} />
              <span className="label">{society.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {ev.status === "live" && (
                <span className="chip chip-live"><span className="pulse" /> Live</span>
              )}
              <span className="mono text-[0.75rem] text-[var(--color-dim)]">{now}</span>
            </div>
          </div>

          <h1 className="display mt-4 text-[clamp(1.7rem,6vw,2.5rem)]">{ev.name}</h1>
          <p className="label mt-2">
            {course?.name} · {tee?.name} · Par {tee?.par} · {started} of {entries.length} away
          </p>
        </header>

        {/* ------------------------------------------------------- board -- */}
        <div className="board mt-6 rise" style={{ animationDelay: "90ms" }}>
          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2.5">
            <span className="label">{fmt === "medal" ? "Medal" : fmt === "gross" ? "Gross strokeplay" : "Stableford"}</span>
            <span className="label">
              {fmt === "medal" ? "Net" : fmt === "gross" ? "Gross" : byHole ? "Thru · Pts" : "Points"}
            </span>
          </div>

          {rows.map((r, i) => (
            <div
              key={r.en.id}
              onClick={() => setCardFor(r.player.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") setCardFor(r.player.id); }}
              className={
                "board-row rise cursor-pointer" +
                (r.position === 1 && r.thru > 0 ? " lead" : "") +
                (r.thru === 0 ? " out" : "")
              }
              style={{ animationDelay: `${120 + Math.min(i, 16) * 30}ms` }}
            >
              {r.thru > 0 && r.points != null && r.position <= 3 ? (
                <span className={`medal medal-${["gold", "silver", "bronze"][r.position - 1]}`}>
                  {r.position}
                </span>
              ) : (
                <span className="pos">{r.thru === 0 || r.points == null ? "–" : `${r.position}${r.tied ? "=" : ""}`}</span>
              )}
              <span className="min-w-0">
                <span className="nm block truncate">{r.player.name}</span>
                <span className="label mt-0.5 block">
                  {r.thru === 0
                    ? `still out · HCP ${formatPlayingHandicap(r.en.playingHandicap)}`
                    : `${byHole && r.thru < 18 ? `thru ${r.thru}` : `${r.gross} gross`} · HCP ${formatPlayingHandicap(r.en.playingHandicap)}`}
                </span>
              </span>
              <span className="pts">{r.points ?? "–"}</span>
            </div>
          ))}
        </div>

        <Honours eventId={ev.id} />

        {/* --------------------------------------------------- side pots -- */}
        {sideComps.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {sideComps.map((sc, i) => {
              const winner = db.players.find((p) => p.id === sc.winnerId);
              return (
                <div
                  key={sc.id}
                  className="card feed rise px-3 py-3"
                  style={{ animationDelay: `${300 + i * 50}ms` }}
                >
                  <p className="label">
                    {sc.kind === "ntp" ? "Nearest the pin" : "Longest drive"}
                    {sc.hole ? ` · hole ${sc.hole}` : ""}
                  </p>
                  <p className="name mt-1 text-[1.05rem]">{winner?.name ?? "Not won"}</p>
                  {sc.detail && <p className="mono mt-0.5 text-[0.8rem] text-[var(--color-dim)]">{sc.detail}</p>}
                </div>
              );
            })}
          </div>
        )}

        {cardFor && (
          <ScorecardModal eventId={ev.id} playerId={cardFor} onClose={() => setCardFor(null)} />
        )}

        <footer className="mt-8 text-center">
          <Link href="/" className="label">Powered by Societee</Link>
        </footer>
      </div>
    </main>
  );
}

/** Best gross / best nett / best Stableford among cards in. */
function Honours({ eventId }: { eventId: string }) {
  const db = useDB();
  const rounds = select.roundsForEvent(db, eventId);
  const done = rounds.filter((r) => r.stableford != null);
  if (done.length < 2) return null;
  const nameOf = (pid: string) =>
    db.players.find((p) => p.id === pid)?.shortName ??
    db.players.find((p) => p.id === pid)?.name ?? "—";
  const best = (val: (r: (typeof done)[number]) => number | null, dir: 1 | -1) => {
    let top: number | null = null;
    for (const r of done) {
      const v = val(r);
      if (v == null) continue;
      if (top == null || v * dir < top * dir) top = v;
    }
    if (top == null) return null;
    const winners = done.filter((r) => val(r) === top).map((r) => nameOf(r.playerId));
    return { v: top, who: winners.slice(0, 2).join(" & ") + (winners.length > 2 ? " +" : "") };
  };
  const cells = [
    { k: "Best gross", d: best((r) => r.gross, 1), suffix: "" },
    { k: "Best nett", d: best((r) => r.net, 1), suffix: "" },
    { k: "Best points", d: best((r) => r.stableford, -1), suffix: " pts" },
  ].filter((c) => c.d);
  if (!cells.length) return null;
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {cells.map((c) => (
        <div key={c.k} className="card p-3 text-center">
          <p className="label !text-[0.55rem]">{c.k}</p>
          <p className="num mt-1 text-[1.15rem]" style={{ color: "var(--color-gold)" }}>
            {c.d!.v}{c.suffix}
          </p>
          <p className="label mt-0.5 truncate !text-[0.58rem]">{c.d!.who}</p>
        </div>
      ))}
    </div>
  );
}

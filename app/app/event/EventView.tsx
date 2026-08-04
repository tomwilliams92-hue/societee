"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Header, Footer, SectionTitle } from "@/components/Chrome";
import { Leaderboard, type BoardRow } from "@/components/Leaderboard";
import { ScorecardModal } from "@/components/Scorecard";
import { useDB, select, actions } from "@/lib/store";
import { courseHandicap, formatHandicap, formatPlayingHandicap, rank } from "@/lib/scoring";
import { courseById, teeById } from "@/lib/courses";

export function EventView({ eventId }: { eventId: string }) {
  const db = useDB();
  const router = useRouter();
  const ev = select.event(db, eventId);
  const [origin, setOrigin] = useState("");
  const [showHcp, setShowHcp] = useState<string | null>(null);
  const [cardFor, setCardFor] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  if (!ev) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl flex-1 px-4 py-24 text-center">
          <h1 className="name text-2xl">No such golf day</h1>
          <Link href="/" className="mt-3 inline-block underline underline-offset-4">
            Back to your societies
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  const society = db.societies.find((s) => s.id === ev.societyId)!;
  const course = courseById(ev.courseId);
  const tee = teeById(ev.teeId);
  const entries = select.entries(db, ev.id);
  const rounds = select.roundsForEvent(db, ev.id);
  const sideComps = select.sideComps(db, ev.id);
  const shareUrl = `${origin}/live-board?b=${ev.shareToken}`;

  const rows: BoardRow[] = rank(
    entries.map((en) => {
      const player = db.players.find((p) => p.id === en.playerId)!;
      const round = rounds.find((r) => r.playerId === en.playerId);
      return { en, player, points: round?.stableford ?? null, gross: round?.gross ?? null };
    }),
    (r) => r.points
  ).map((r) => ({
    key: r.en.id,
    name: r.player.name,
    position: r.position,
    tied: r.tied,
    value: r.points,
    note:
      r.points == null
        ? `still out · HCP ${formatPlayingHandicap(r.en.playingHandicap)}`
        : `${r.gross} gross · HCP ${formatPlayingHandicap(r.en.playingHandicap)}`,
  }));

  const cardsIn = rounds.length;
  const groups = select.groups(db, ev.id);
  const byHole = select.hasCard(db, ev.teeId);
  const notPlaying = select
    .players(db, ev.societyId)
    .filter((p) => !entries.some((en) => en.playerId === p.id));

  return (
    <>
      <Header back={{ href: `/society?s=${society.slug}`, label: society.name }} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        <section className="py-6">
          <h1 className="display text-[clamp(1.6rem,5vw,2.2rem)]">{ev.name}</h1>
          {/* one row of chips instead of a wrapping sentence */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {ev.status === "live" && ev.playsOn === new Date().toISOString().slice(0, 10) && (
              <span className="chip chip-live"><span className="pulse" /> Live</span>
            )}
            <span className="chip">{fmtDate(ev.playsOn)}</span>
            {course && <span className="chip">{course.name}{tee ? ` · ${tee.name}` : ""}</span>}
            {tee && <span className="chip">Par {tee.par}</span>}
            <span className="chip chip-acid">{ev.handicapAllowance}%</span>
          </div>
          {ev.notes && <p className="label mt-2.5 !normal-case !tracking-normal">{ev.notes}</p>}
        </section>

        {(() => {
          const done = rounds.filter((r) => r.stableford != null);
          if (done.length < 2) return null;
          const nameOf = (pid: string) => {
            const pl = db.players.find((p) => p.id === pid);
            return pl?.shortName ?? pl?.name ?? "—";
          };
          const best = (val: (r: (typeof done)[number]) => number | null, dir: 1 | -1) => {
            let top: number | null = null;
            for (const r of done) { const v = val(r); if (v == null) continue;
              if (top == null || v * dir < top * dir) top = v; }
            if (top == null) return null;
            const who = done.filter((r) => val(r) === top).map((r) => nameOf(r.playerId));
            return { v: top, who: who.slice(0, 2).join(" & ") + (who.length > 2 ? " +" : "") };
          };
          const cells = [
            { k: "Best gross", d: best((r) => r.gross, 1), x: "" },
            { k: "Best nett", d: best((r) => r.net, 1), x: "" },
            { k: "Best points", d: best((r) => r.stableford, -1), x: " pts" },
          ].filter((c) => c.d);
          if (!cells.length) return null;
          return (
            <div className="mb-6 grid grid-cols-3 gap-2">
              {cells.map((c) => (
                <div key={c.k} className="card p-3 text-center">
                  <p className="label !text-[0.55rem]">{c.k}</p>
                  <p className="num mt-1 text-[1.15rem]" style={{ color: "var(--color-gold)" }}>{c.d!.v}{c.x}</p>
                  <p className="label mt-0.5 truncate !text-[0.58rem]">{c.d!.who}</p>
                </div>
              ))}
            </div>
          );
        })()}

        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          {/* ------------------------------------------------- scoring -- */}
          <div>
            <SectionTitle aside={<span className="label">{cardsIn} of {entries.length} in</span>}>
              Enter the cards
            </SectionTitle>

            <div className="card divide-y divide-[var(--color-line)]">
              {entries.map((en) => {
                const player = db.players.find((p) => p.id === en.playerId)!;
                const round = rounds.find((r) => r.playerId === en.playerId);
                const open = showHcp === en.id;
                return (
                  <div key={en.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <button
                        className="block max-w-full truncate text-left text-[0.95rem] font-medium underline-offset-4 hover:underline"
                        onClick={() => setCardFor(player.id)}
                        title={`See ${player.shortName ?? player.name}'s card hole by hole`}
                      >
                        {player.name}
                      </button>
                      <button
                        className="label text-left"
                        onClick={() => setShowHcp(open ? null : en.id)}
                        aria-expanded={open}
                        title="How this playing handicap was worked out"
                      >
                        HCP {formatPlayingHandicap(en.playingHandicap)}{" "}
                        <span style={{ color: "var(--color-acid)" }}>ⓘ</span> · group {en.groupNo} ·
                        from {en.startHole}
                      </button>
                    </div>

                    <label className="text-center">
                      <span className="label mb-1 block">Gross</span>
                      <input
                        className="score-input"
                        type="number"
                        inputMode="numeric"
                        min={50}
                        max={160}
                        placeholder="–"
                        defaultValue={round?.gross ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          actions.setScore(ev.id, player.id, v === "" ? null : Number(v));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                      />
                    </label>

                    <div className="w-[3.75rem] text-center">
                      <span className="label mb-1 block">Points</span>
                      <span
                        className="num block text-[1.5rem] leading-[3.25rem]"
                        style={{ color: round ? "var(--color-acid)" : "var(--color-line)" }}
                      >
                        {round?.stableford ?? "–"}
                      </span>
                    </div>

                    <button
                      className="shrink-0 px-1.5 text-[1.1rem] leading-none text-[var(--color-line)] hover:text-[var(--color-live)]"
                      title={`Take ${player.shortName ?? player.name} out of this day`}
                      aria-label={`Remove ${player.name}`}
                      onClick={() => actions.removeFromEvent(ev.id, player.id)}
                    >
                      ×
                    </button>
                  </div>

                  {/* The dispute-killer: show the working, not just the answer.
                      (Squabbit does this behind an info icon and it's their
                      single best idea — nobody argues with arithmetic.) */}
                  {open && tee && player.handicapIndex != null && (
                    <p className="mono mt-2 border-t border-[var(--line-soft)] pt-2 text-[0.72rem] leading-relaxed text-[var(--color-dim)]">
                      Index {formatHandicap(player.handicapIndex)} × slope {tee.slope}/113 + (CR{" "}
                      {tee.cr} − par {tee.par}) = course handicap{" "}
                      {formatPlayingHandicap(courseHandicap(player.handicapIndex, tee))} · ×{" "}
                      {ev.handicapAllowance}% ={" "}
                      <span style={{ color: "var(--color-acid)" }}>
                        playing handicap {formatPlayingHandicap(en.playingHandicap)}
                      </span>
                    </p>
                  )}
                  </div>
                );
              })}
            </div>

            {notPlaying.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="label">Turned up late:</span>
                {notPlaying.map((p) => (
                  <button
                    key={p.id}
                    className="chip hover:border-[var(--color-acid)] hover:text-[var(--color-acid)]"
                    onClick={() => actions.addToEvent(ev.id, p.id)}
                  >
                    + {p.name}
                  </button>
                ))}
              </div>
            )}

            <p className="label mt-3">
              Type the gross, tab out — Societee works the Stableford out from the playing handicap.
            </p>

            {/* --------------------------------------------- group links -- */}
            <SectionTitle
              aside={
                <span className={`label ${byHole ? "" : "text-[var(--color-live)]"}`}>
                  {byHole ? "Hole by hole ready" : "Totals only"}
                </span>
              }
            >
              Scoring links
            </SectionTitle>

            {byHole ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {groups.map((g) => {
                    const inGroup = select.groupPlayers(db, ev.id, g.groupNo);
                    const url = `${origin}/scorecard?g=${g.scorerToken}`;
                    return (
                      <div key={g.id} className="card feed p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="name text-[1rem]">Group {g.groupNo}</span>
                          <span className="label">from {g.startHole}</span>
                        </div>
                        <p className="label mt-1 truncate">
                          {inGroup.map((x) => x.player.shortName ?? x.player.name).join(" · ") || "Nobody yet"}
                        </p>
                        <div className="mt-2.5 flex gap-2">
                          <Link href={`/scorecard?g=${g.scorerToken}`} className="btn btn-ghost flex-1 !min-h-[2.5rem] !text-[0.75rem]">
                            Open
                          </Link>
                          <button
                            className="btn btn-ghost !min-h-[2.5rem] !text-[0.75rem]"
                            onClick={() => navigator.clipboard?.writeText(url)}
                          >
                            Copy link
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="label mt-2">
                  Send each group its own link. One phone per fourball scores hole by hole and the
                  board updates as they play — still no sign-up for anybody.
                </p>
              </>
            ) : (
              <div className="card p-4">
                <p className="text-[0.9rem] leading-relaxed text-[var(--color-dim)]">
                  <span className="text-[var(--color-text)]">
                    {course?.name} hasn’t got a scorecard in Societee yet.
                  </span>{" "}
                  Hole-by-hole scoring needs the real par and stroke index for all 18 holes — the
                  stroke index decides who gets a shot where, so guessing it would produce points
                  that look right and are wrong. Enter the totals above instead; that needs no card
                  and is always correct.
                </p>
              </div>
            )}

            {sideComps.length > 0 && (
              <>
                <SectionTitle>On the day</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sideComps.map((sc) => {
                    const winner = db.players.find((p) => p.id === sc.winnerId);
                    return (
                      <div key={sc.id} className="card p-4">
                        <p className="label">
                          {sc.kind === "ntp" ? "Nearest the pin" : "Longest drive"}
                          {sc.hole ? ` · hole ${sc.hole}` : ""}
                        </p>
                        <p className="name mt-1.5 text-[1.15rem]">{winner?.name ?? "Not won"}</p>
                        {sc.detail && <p className="num mt-0.5 text-[0.85rem]">{sc.detail}</p>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* --------------------------------------------------- share -- */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <SectionTitle>The first tee</SectionTitle>
            <div className="card p-5 text-center">
              <div className="mx-auto inline-block rounded-[3px] bg-white p-3 shadow-inner">
                {origin && (
                  <QRCodeSVG value={shareUrl} size={148} level="M" bgColor="#ffffff" fgColor="#06080a" />
                )}
              </div>
              <p className="mt-4 text-[0.875rem] leading-relaxed text-[var(--color-dim)]">
                Print it, or hold up your phone. Everyone scans once and watches the board all day —
                no download, no sign-up.
              </p>
              <div className="mt-4 flex gap-2">
                <Link href={`/live-board?b=${ev.shareToken}`} className="btn btn-primary flex-1">
                  Open board
                </Link>
                <button
                  className="btn btn-ghost"
                  onClick={() => navigator.clipboard?.writeText(shareUrl)}
                >
                  Copy link
                </button>
              </div>
              <p className="num mt-3 break-all text-[0.72rem] text-[var(--color-dim)]">
                {shareUrl || "…"}
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              {ev.status === "live" ? (
                <button
                  className="btn btn-ghost flex-1"
                  onClick={() => actions.setEventStatus(ev.id, "complete")}
                >
                  Close the day
                </button>
              ) : (
                <button
                  className="btn btn-ghost flex-1"
                  onClick={() => actions.setEventStatus(ev.id, "live")}
                >
                  Reopen scoring
                </button>
              )}
            </div>

            <p className="mt-6 text-center">
              <button
                className="label underline underline-offset-4 hover:text-[var(--color-live)]"
                onClick={() => {
                  if (confirm(`Delete “${ev.name}” and every card in it? This can't be undone.`)) {
                    actions.deleteEvent(ev.id);
                    router.push(`/society?s=${society.slug}`);
                  }
                }}
              >
                Delete this day
              </button>
            </p>
          </aside>
        </div>

        <section className="mt-12">
          <Leaderboard
            title={ev.name}
            subtitle={`${course?.name ?? ""} · ${fmtDate(ev.playsOn)} · Stableford`}
            rows={rows}
            unit="points"
            empty="No cards in yet."
          />
        </section>
      </main>

      {cardFor && (
        <ScorecardModal eventId={ev.id} playerId={cardFor} onClose={() => setCardFor(null)} />
      )}

      <Footer />
    </>
  );
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

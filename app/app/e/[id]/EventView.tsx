"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Header, Footer, SectionTitle } from "@/components/Chrome";
import { HonoursBoard, type BoardRow } from "@/components/HonoursBoard";
import { useDB, select, actions } from "@/lib/store";
import { formatPlayingHandicap, rank } from "@/lib/scoring";
import { courseById, teeById } from "@/lib/courses";

export function EventView({ eventId }: { eventId: string }) {
  const db = useDB();
  const ev = select.event(db, eventId);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  if (!ev) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl flex-1 px-4 py-24 text-center">
          <h1 className="engraved text-2xl">No such golf day</h1>
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
  const shareUrl = `${origin}/live/${ev.shareToken}`;

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
        ? `still out · off ${formatPlayingHandicap(r.en.playingHandicap)}`
        : `${r.gross} gross · off ${formatPlayingHandicap(r.en.playingHandicap)}`,
  }));

  const cardsIn = rounds.length;

  return (
    <>
      <Header back={{ href: `/s/${society.slug}`, label: society.name }} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        <section className="py-9">
          <div className="flex flex-wrap items-center gap-3">
            <p className="label">{fmtDate(ev.playsOn)}</p>
            {ev.status === "live" && (
              <span className="chip chip-live"><span className="pulse" /> Live</span>
            )}
          </div>
          <h1 className="display mt-2 text-[clamp(2.1rem,6.5vw,3.2rem)]">{ev.name}</h1>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            {course?.clubName ?? "Course TBC"}
            {tee && <> · {tee.name} tees · par {tee.par} · CR {tee.cr} / slope {tee.slope}</>}
            {" · "}Stableford off {ev.handicapAllowance}%
          </p>
          {ev.notes && <p className="mt-1.5 italic text-[var(--color-ink-soft)]">{ev.notes}</p>}
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          {/* ------------------------------------------------- scoring -- */}
          <div>
            <SectionTitle aside={<span className="label">{cardsIn} of {entries.length} in</span>}>
              Enter the cards
            </SectionTitle>

            <div className="card divide-y divide-[var(--rule)]">
              {entries.map((en) => {
                const player = db.players.find((p) => p.id === en.playerId)!;
                const round = rounds.find((r) => r.playerId === en.playerId);
                return (
                  <div key={en.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{player.name}</span>
                      <span className="label">
                        off {formatPlayingHandicap(en.playingHandicap)} · group {en.groupNo} · from{" "}
                        {en.startHole}
                      </span>
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
                        style={{ color: round ? "var(--color-green)" : "var(--rule-strong)" }}
                      >
                        {round?.stableford ?? "–"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="label mt-3">
              Type the gross, tab out — Societee works the Stableford out from the playing handicap.
            </p>

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
                        <p className="engraved mt-1.5 text-[1.15rem]">{winner?.name ?? "Not won"}</p>
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
                  <QRCodeSVG value={shareUrl} size={148} level="M" bgColor="#ffffff" fgColor="#0b3d2c" />
                )}
              </div>
              <p className="mt-4 text-[0.875rem] leading-relaxed text-[var(--color-ink-soft)]">
                Print it, or hold up your phone. Everyone scans once and watches the board all day —
                no download, no sign-up.
              </p>
              <div className="mt-4 flex gap-2">
                <Link href={`/live/${ev.shareToken}`} className="btn btn-primary flex-1">
                  Open board
                </Link>
                <button
                  className="btn btn-ghost"
                  onClick={() => navigator.clipboard?.writeText(shareUrl)}
                >
                  Copy link
                </button>
              </div>
              <p className="num mt-3 break-all text-[0.72rem] text-[var(--color-ink-soft)]">
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
          </aside>
        </div>

        <section className="mt-12">
          <HonoursBoard
            title={ev.name}
            subtitle={`${course?.name ?? ""} · ${fmtDate(ev.playsOn)} · Stableford`}
            rows={rows}
            unit="points"
            empty="No cards in yet."
          />
        </section>
      </main>

      <Footer />
    </>
  );
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

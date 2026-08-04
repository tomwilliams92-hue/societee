"use client";

import Link from "next/link";
import { useState } from "react";
import { Header, Footer, SectionTitle } from "@/components/Chrome";
import { Leaderboard, type BoardRow } from "@/components/Leaderboard";
import { useDB, select, actions } from "@/lib/store";
import { bestNTotal, formatHandicap, parseHandicap, rank } from "@/lib/scoring";
import { courseById } from "@/lib/courses";
import { SocietyBadge } from "@/components/Badge";

export function SocietyView({ slug }: { slug: string }) {
  const db = useDB();
  const society = select.society(db, slug);
  const [tab, setTab] = useState<"menu" | "merit" | "events" | "players">("menu");

  if (!society) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl flex-1 px-4 py-24 text-center">
          <h1 className="name text-2xl">No such society</h1>
          <p className="mt-3 text-[var(--color-dim)]">
            Nothing here under “{slug}”.{" "}
            <Link href="/" className="underline underline-offset-4">Back to your societies</Link>.
          </p>
        </main>
        <Footer />
      </>
    );
  }

  const players = select.players(db, society.id);
  const events = select.events(db, society.id);
  const season = select.currentSeason(db, society.id);

  /* -------------------------------------------- Order of Merit standings -- */
  const meritRows: BoardRow[] = season
    ? rank(
        players.map((p) => {
          const rounds = select
            .roundsForPlayer(db, p.id)
            .filter((r) => r.playedOn >= season.startsOn && r.playedOn <= season.endsOn);
          const counted = Math.min(rounds.length, season.bestN ?? rounds.length);
          return {
            player: p,
            total: bestNTotal(rounds.map((r) => r.stableford), season.bestN),
            played: rounds.length,
            counted,
          };
        }),
        (r) => (r.played === 0 ? null : r.total)
      ).map((r) => ({
        key: r.player.id,
        name: r.player.name,
        position: r.position,
        tied: r.tied,
        value: r.played === 0 ? null : r.total,
        note:
          r.played === 0
            ? "no cards in"
            : `${r.counted} of ${r.played} card${r.played === 1 ? "" : "s"} counting · HCP ${formatHandicap(r.player.handicapIndex)}`,
      }))
    : [];

  return (
    <>
      <Header back={{ href: "/", label: "Societies" }} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        <section className="flex items-center gap-4 py-7">
          <SocietyBadge society={society} size={64} rounded={16} />
          <div className="min-w-0">
            <h1 className="display text-[clamp(1.5rem,5.5vw,2.2rem)]">{society.name}</h1>
            <p className="label mt-1">
              {society.homeClub ?? "Society"}{season ? ` · ${season.name}` : ""}
            </p>
          </div>
        </section>

        {/* ------------------------------------------------ section menu -- */}
        {tab === "menu" && (
          <div className="grid gap-3 rise">
            {([
              {
                k: "merit" as const,
                title: "Order of Merit",
                desc: season
                  ? `${season.name} · best ${season.bestN ?? "all"} cards count`
                  : "No season running — start one from Get started",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8" /><path d="M12 17v4" /><path d="M6 3h12v6a6 6 0 0 1-12 0Z" /><path d="M6 5H3v2a3 3 0 0 0 3 3" /><path d="M18 5h3v2a3 3 0 0 1-3 3" /></svg>
                ),
                tint: "rgba(245,197,66,0.1)", line: "rgba(245,197,66,0.3)",
              },
              {
                k: "events" as const,
                title: "Golf days / events",
                desc: `${events.length} day${events.length === 1 ? "" : "s"}${select.seriesFor(db, society.id).length ? ` · ${select.seriesFor(db, society.id).length} trip` : ""} · create, score, share the board`,
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-acid)" strokeWidth="1.9" strokeLinecap="round"><path d="M5 21V4" /><path d="M5 4c4-2 7 2 14 0v9c-7 2-10-2-14 0" /></svg>
                ),
                tint: "rgba(47,219,0,0.08)", line: "rgba(47,219,0,0.3)",
              },
              {
                k: "players" as const,
                title: "Players",
                desc: `${players.length} player${players.length === 1 ? "" : "s"} · names and handicaps, no accounts needed`,
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-blue, #4db8ff)" strokeWidth="1.9" strokeLinecap="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" /><circle cx="17.5" cy="9.5" r="2.6" /><path d="M16 14.6c3 .3 5.5 2 5.5 4.9" /></svg>
                ),
                tint: "rgba(77,184,255,0.08)", line: "rgba(77,184,255,0.3)",
              },
            ]).map((m) => (
              <button key={m.k} className="card flex items-center gap-3.5 p-4 text-left transition-transform hover:-translate-y-0.5"
                      onClick={() => setTab(m.k)}>
                <span className="grid shrink-0 place-items-center rounded-[12px]"
                      style={{ width: "3.1rem", height: "3.1rem", background: m.tint, border: `1px solid ${m.line}` }}>
                  {m.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="name block text-[1.02rem]">{m.title}</span>
                  <span className="label mt-0.5 block !normal-case !tracking-normal">{m.desc}</span>
                </span>
                <svg className="shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            ))}
          </div>
        )}

        {tab !== "menu" && (
          <button className="label mb-4 inline-flex items-center gap-1.5 !text-[0.7rem]" onClick={() => setTab("menu")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18 9 12l6-6" /></svg>
            All sections
          </button>
        )}

        {tab === "merit" &&
          (season ? (
            <Leaderboard
              title={season.name}
              subtitle={`Best ${season.bestN ?? "all"} Stableford cards · ${fmtRange(season.startsOn, season.endsOn)}`}
              rows={meritRows}
              unit="points"
              empty="No cards in yet this season."
            />
          ) : (
            <p className="card p-6 text-center text-[var(--color-dim)]">
              No season running. An Order of Merit totals each player’s best cards across the summer.
            </p>
          ))}

        {tab === "events" && <EventsTab societyId={society.id} />}
        {tab === "players" && <PlayersTab societyId={society.id} />}
      </main>

      <Footer />
    </>
  );

  function EventsTab({ societyId }: { societyId: string }) {
    return (
      <>
        <SectionTitle
          aside={
            <Link href={`/new-day?s=${society!.slug}`} className="btn btn-primary !min-h-[2.25rem] !text-[0.8125rem]">
              New golf day
            </Link>
          }
        >
          <span className="inline-flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-acid)" strokeWidth="2" strokeLinecap="round"><path d="M5 21V4" /><path d="M5 4c4-2 7 2 14 0v9c-7 2-10-2-14 0" /></svg>Golf days / events</span>
        </SectionTitle>

        {select.seriesFor(db, societyId).map((sr) => {
          const days = select.seriesEvents(db, sr.id);
          if (!days.length) return null;
          const totals = players
            .map((p) => {
              const per = days.map((d) =>
                db.rounds.find((r) => r.eventId === d.id && r.playerId === p.id)?.stableford ?? null
              );
              const total = per.reduce((a: number, x) => a + (x ?? 0), 0);
              return { p, per, total, played: per.some((x) => x != null) };
            })
            .filter((x) => x.played);
          const rows = rank(totals, (x) => x.total).map((x) => ({
            key: x.p.id,
            name: x.p.name,
            position: x.position,
            tied: x.tied,
            value: x.total,
            note: x.per.map((v, i) => `R${i + 1} ${v ?? "–"}`).join(" · "),
          }));
          return (
            <div key={sr.id} className="mb-6">
              <Leaderboard
                title={sr.name}
                subtitle={`${days.length} rounds · combined Stableford`}
                rows={rows}
                unit="total"
                empty="No cards in yet."
              />
              <p className="label mt-2">
                {days.map((d) => d.name).join(" · ")}
              </p>
            </div>
          );
        })}

        <div className="grid gap-3">
          {events.length === 0 && (
            <p className="card p-6 text-center text-[var(--color-dim)]">
              No golf days yet — tap New golf day and we’ll set one up properly.
            </p>
          )}
          {events.map((ev) => {
            const course = courseById(ev.courseId);
            const entered = select.entries(db, ev.id).length;
            const scored = select.roundsForEvent(db, ev.id).length;
            return (
              <Link
                key={ev.id}
                href={`/event?e=${ev.id}`}
                className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 transition-transform hover:-translate-y-0.5"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="name text-[1.15rem] leading-tight">{ev.name}</h3>
                  <p className="label mt-1">
                    {fmtDate(ev.playsOn)} · {course?.name ?? "Course TBC"}
                  </p>
                </div>
                <span className="num text-[0.9rem] text-[var(--color-dim)]">
                  {scored}/{entered} cards in
                </span>
                {ev.status === "live" && (
                  <span className="chip chip-live"><span className="pulse" /> Live</span>
                )}
                {ev.status === "complete" && <span className="chip">Complete</span>}
              </Link>
            );
          })}
        </div>
      </>
    );
  }

  function PlayersTab({ societyId }: { societyId: string }) {
    const [name, setName] = useState("");
    const [hcp, setHcp] = useState("");

    return (
      <>
        <SectionTitle aside={<span className="label">{players.length} players</span>}>
          Players
        </SectionTitle>

        <form
          className="card mb-5 flex flex-wrap items-end gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            actions.addPlayer(societyId, name.trim(), parseHandicap(hcp));
            setName("");
            setHcp("");
          }}
        >
          <label className="min-w-[14rem] flex-1">
            <span className="label mb-1.5 block">Name</span>
            <input
              className="field"
              placeholder="Dave Prichard"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="w-[9rem]">
            <span className="label mb-1.5 block">Handicap index</span>
            <input
              className="field num"
              placeholder="12.4 or +1.6"
              value={hcp}
              onChange={(e) => setHcp(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" type="submit">Add player</button>
          <p className="label w-full">
            Players never need an account. Add them once and they’re yours.
          </p>
        </form>

        <div className="card divide-y divide-[var(--color-line)]">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-4 py-3">
              <span className="flex-1 truncate">{p.name}</span>
              <label className="text-right">
                <span className="label mr-2">Index</span>
                <input
                  className="num w-[5.5rem] rounded-[3px] border border-transparent bg-transparent px-2 py-1 text-right hover:border-[var(--color-line)] focus:border-[var(--color-acid)] focus:bg-white focus:outline-none"
                  defaultValue={formatHandicap(p.handicapIndex)}
                  aria-label={`Handicap index for ${p.name}`}
                  onBlur={(e) => {
                    const v = parseHandicap(e.target.value);
                    actions.updatePlayer(p.id, { handicapIndex: v });
                    e.target.value = formatHandicap(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
              </label>
              <span className="label w-[5.5rem] text-right">
                {select.roundsForPlayer(db, p.id).length} cards
              </span>
            </div>
          ))}
        </div>
        <p className="label mt-2">
          Indexes are typed in and kept up to date by you — click one to change it. Plus golfers
          write as “+1.6”. Existing cards keep the handicap they were played off.
        </p>
      </>
    );
  }
}

/* --------------------------------------------------------------- dates -- */

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtRange(a: string, b: string) {
  const f = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${f(a)} – ${f(b)}`;
}

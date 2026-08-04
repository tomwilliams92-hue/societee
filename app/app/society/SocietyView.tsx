"use client";

import Link from "next/link";
import { useState } from "react";
import { Header, Footer, SectionTitle } from "@/components/Chrome";
import { Leaderboard, type BoardRow } from "@/components/Leaderboard";
import { useDB, select, actions } from "@/lib/store";
import { bestNTotal, formatHandicap, parseHandicap, rank } from "@/lib/scoring";
import { courseById } from "@/lib/courses";

export function SocietyView({ slug }: { slug: string }) {
  const db = useDB();
  const society = select.society(db, slug);
  const [tab, setTab] = useState<"merit" | "events" | "players">("merit");

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
        <section className="py-9">
          <p className="label">{society.homeClub ?? "Society"}</p>
          <h1 className="display mt-2 text-[clamp(1.7rem,5vw,2.4rem)]">{society.name}</h1>
          {season && (
            <p className="mt-3 text-[var(--color-dim)]">
              {season.name} · best {season.bestN ?? "all"} cards count ·{" "}
              {fmtRange(season.startsOn, season.endsOn)}
              {season.prize && <> · <span className="italic">{season.prize}</span></>}
            </p>
          )}
        </section>

        <nav className="mb-6 flex gap-1 border-b border-[var(--color-line)]">
          {(["merit", "events", "players"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="label relative -mb-px px-3.5 py-2.5"
              style={{
                color: tab === t ? "var(--color-acid)" : undefined,
                borderBottom: `2px solid ${tab === t ? "var(--color-acid)" : "transparent"}`,
              }}
            >
              {t === "merit" ? "Order of Merit" : t}
            </button>
          ))}
        </nav>

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
          Golf days
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

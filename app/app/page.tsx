"use client";

import Link from "next/link";
import { useState } from "react";
import { Header, Footer, SectionTitle } from "@/components/Chrome";
import { Crest } from "@/components/Crest";
import { useDB, select, actions, resetDemo } from "@/lib/store";
import { bestNTotal } from "@/lib/scoring";

export default function Home() {
  const db = useDB();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  return (
    <>
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        {/* -------------------------------------------------------- hero -- */}
        <section className="py-12 sm:py-16">
          <p className="label rise">Est. on the first tee</p>
          <h1
            className="display mt-3 max-w-[15ch] text-[clamp(1.9rem,5.5vw,2.9rem)] rise"
            style={{ animationDelay: "60ms" }}
          >
            Run your golf society without the spreadsheets.
          </h1>
          <p
            className="mt-4 max-w-[52ch] text-[0.95rem] leading-relaxed text-[var(--color-dim)] rise"
            style={{ animationDelay: "120ms" }}
          >
            Create a society, add your players, run the day. The leaderboard goes up on a QR
            code at the first tee — no app to download and no sign-up for anyone but you.
          </p>
        </section>

        {/* ------------------------------------------------- live right now -- */}
        {(() => {
          const live = db.events.find((e) => e.status === "live");
          if (!live) return null;
          const soc = db.societies.find((s) => s.id === live.societyId);
          const inCount = select.roundsForEvent(db, live.id).length;
          const field = select.entries(db, live.id).length;
          return (
            <Link
              href={`/event?e=${live.id}`}
              className="card feed mb-8 block p-4 transition-transform hover:-translate-y-0.5 rise"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="chip chip-live"><span className="pulse" /> Live now</span>
                <span className="label">{inCount} of {field} in</span>
              </div>
              <div className="mt-2.5 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="display truncate text-[1.3rem]">{live.name}</h3>
                  <p className="label mt-1">{soc?.name}</p>
                </div>
                <span className="btn btn-primary !min-h-[2.4rem] !text-[0.75rem]">Open</span>
              </div>
            </Link>
          );
        })()}

        {/* --------------------------------------------------- societies -- */}
        <SectionTitle
          aside={
            <button
              className="btn btn-ghost !min-h-[2.25rem] !text-[0.8125rem]"
              onClick={() => setCreating((v) => !v)}
            >
              {creating ? "Cancel" : "New society"}
            </button>
          }
        >
          Your societies
        </SectionTitle>

        {creating && (
          <form
            className="card mb-5 flex flex-wrap items-end gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              actions.createSociety(name.trim());
              setName("");
              setCreating(false);
            }}
          >
            <label className="min-w-[16rem] flex-1">
              <span className="label mb-1.5 block">Society name</span>
              <input
                className="field"
                autoFocus
                placeholder="e.g. Weekend Dogs"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="btn btn-primary" type="submit">
              Create society
            </button>
          </form>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {db.societies.map((s, i) => {
            const players = select.players(db, s.id);
            const season = select.currentSeason(db, s.id);
            const events = select.events(db, s.id);
            const live = events.find((e) => e.status === "live");

            let leader: { name: string; total: number } | null = null;
            if (season) {
              const totals = players
                .map((p) => ({
                  name: p.shortName ?? p.name,
                  total: bestNTotal(
                    select
                      .roundsForPlayer(db, p.id)
                      .filter((r) => r.playedOn >= season.startsOn && r.playedOn <= season.endsOn)
                      .map((r) => r.stableford),
                    season.bestN
                  ),
                }))
                .sort((a, b) => b.total - a.total);
              if (totals[0] && totals[0].total > 0) leader = totals[0];
            }

            return (
              <Link
                key={s.id}
                href={`/society?s=${s.slug}`}
                className="card feed block p-5 transition-transform hover:-translate-y-0.5 rise"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="name truncate text-[1.1rem] leading-tight">{s.name}</h3>
                    <p className="label mt-1">{s.homeClub ?? "No home club"}</p>
                  </div>
                  <Crest size={30} className="shrink-0 opacity-90" />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--color-line)] pt-3.5">
                  <Stat label="Players" value={String(players.length)} />
                  <Stat label="Events" value={String(events.length)} />
                  {leader && <Stat label="Leading" value={leader.name} sub={`${leader.total} pts`} />}
                  {live && (
                    <span className="chip chip-live ml-auto">
                      <span className="pulse" /> Live today
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* ------------------------------------------------ how it works -- */}
        <section className="mt-16">
          <SectionTitle>How a golf day runs</SectionTitle>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Create the day", "Pick the course and tee. Course handicaps are worked out for you."],
              ["Add the players", "They never sign up and never download anything. They're names on your card."],
              ["Share the QR code", "Stick it on the first tee. Everyone watches the same board all day."],
              ["Enter the scores", "Type a gross, get Stableford. The board updates as you go."],
            ].map(([t, d], i) => (
              <li key={t} className="card p-4">
                <span className="num text-[1.25rem] leading-none" style={{ color: "var(--color-acid)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h4 className="name mt-2 text-[0.95rem]">{t}</h4>
                <p className="mt-1.5 text-[0.875rem] leading-relaxed text-[var(--color-dim)]">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-12 text-center">
          <button className="label underline underline-offset-4" onClick={resetDemo}>
            Reset demo data
          </button>
        </p>
      </main>

      <Footer />
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <span className="block">
      <span className="label block leading-none">{label}</span>
      <span className="num mt-1 block text-[0.95rem]">
        {value}
        {sub && <span className="ml-1.5 text-[0.78rem] text-[var(--color-dim)]">{sub}</span>}
      </span>
    </span>
  );
}

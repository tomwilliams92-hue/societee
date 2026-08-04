"use client";

import Link from "next/link";
import { useState } from "react";
import { Header, Footer } from "@/components/Chrome";
import { Crest } from "@/components/Crest";
import { useDB, useReady, select, actions, resetDemo } from "@/lib/store";
import { bestNTotal } from "@/lib/scoring";

/**
 * Home is a dashboard, not a landing page: what's live, then your societies,
 * then quiet actions. Each zone gets its own visual weight so a glance tells
 * them apart — the live day glows, societies are tiles, admin is small print.
 */
export default function Home() {
  const db = useDB();
  const ready = useReady();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const me = db.me;

  const live = select.liveToday(db);
  const liveSoc = live ? db.societies.find((s) => s.id === live.societyId) : undefined;

  return (
    <>
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-10">
        {/* ------------------------------------------------- greeting ------ */}
        <section className="flex items-center justify-between gap-4 pb-6 pt-7">
          <div>
            <p className="label">
              {ready
                ? new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
                : " "}
            </p>
            <h1 className="display mt-1 text-[clamp(1.7rem,6vw,2.3rem)]">
              {me?.name ? `Alright, ${me.name.split(" ")[0]}` : "Your golf"}
            </h1>
          </div>
          <Link href="/profile" aria-label="Your profile" className="shrink-0">
            {me?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={me.avatar}
                alt=""
                className="h-13 w-13 rounded-full border-2 object-cover"
                style={{ width: "3.25rem", height: "3.25rem", borderColor: "var(--color-acid)" }}
              />
            ) : (
              <span
                className="grid rounded-full border bg-[var(--color-panel)]"
                style={{ width: "3.25rem", height: "3.25rem", placeItems: "center", borderColor: "var(--color-line)" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-dim)" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>
              </span>
            )}
          </Link>
        </section>

        {/* ------------------------------------------------- live now ------ */}
        {live && (
          <Link
            href={`/event?e=${live.id}`}
            className="card mb-7 block p-4 transition-transform hover:-translate-y-0.5 rise"
            style={{
              borderColor: "rgba(47,219,0,0.55)",
              boxShadow: "0 0 0 1px rgba(47,219,0,0.25), 0 14px 40px -18px rgba(47,219,0,0.35)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="chip chip-live"><span className="pulse" /> Live now</span>
              <span className="label">{select.roundsForEvent(db, live.id).length} of {select.entries(db, live.id).length} in</span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h3 className="display truncate text-[1.35rem]">{live.name}</h3>
                <p className="label mt-1">{liveSoc?.name}</p>
              </div>
              <span className="btn btn-primary !min-h-[2.5rem] !text-[0.8rem]">Open</span>
            </div>
          </Link>
        )}

        {/* ------------------------------------------------- societies ----- */}
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="label !text-[0.75rem]">Your societies</h2>
          <button className="label !text-[0.7rem] underline underline-offset-4" onClick={() => setCreating((v) => !v)}>
            {creating ? "Cancel" : "+ New society"}
          </button>
        </div>

        {creating && (
          <form
            className="card mb-4 flex flex-wrap items-end gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              actions.createSociety(name.trim());
              setName("");
              setCreating(false);
            }}
          >
            <label className="min-w-[14rem] flex-1">
              <span className="label mb-1.5 block">Society name</span>
              <input className="field" autoFocus placeholder="e.g. Weekend Dogs" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button className="btn btn-primary" type="submit">Create</button>
          </form>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {db.societies.map((s, i) => {
            const players = select.players(db, s.id);
            const season = select.currentSeason(db, s.id);
            const events = select.events(db, s.id);
            const isLive = select.liveToday(db)?.societyId === s.id;

            let leader: string | null = null;
            if (season) {
              const tot = players
                .map((p) => ({
                  n: p.shortName ?? p.name,
                  t: bestNTotal(
                    select.roundsForPlayer(db, p.id)
                      .filter((r) => r.playedOn >= season.startsOn && r.playedOn <= season.endsOn)
                      .map((r) => r.stableford),
                    season.bestN
                  ),
                }))
                .sort((a, b) => b.t - a.t)[0];
              if (tot && tot.t > 0) leader = `${tot.n} leads on ${tot.t}`;
            }

            return (
              <Link
                key={s.id}
                href={`/society?s=${s.slug}`}
                className="card flex items-center gap-3.5 p-3.5 transition-transform hover:-translate-y-0.5 rise"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span
                  className="grid shrink-0 place-items-center rounded-[12px]"
                  style={{ width: "3.4rem", height: "3.4rem", background: "rgba(47,219,0,0.1)", border: "1px solid rgba(47,219,0,0.3)" }}
                >
                  <Crest size={30} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="name block truncate text-[1.02rem]">{s.name}</span>
                  <span className="label mt-0.5 block">
                    {players.length} players · {events.length} days{leader ? ` · ${leader}` : ""}
                  </span>
                </span>
                {isLive ? (
                  <span className="chip chip-live shrink-0"><span className="pulse" /> Live</span>
                ) : (
                  <svg className="shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                )}
              </Link>
            );
          })}
        </div>

        {db.societies.length === 0 && ready && (
          <div className="card p-6 text-center">
            <p className="text-[0.95rem]">Start your first society and we’ll set it up properly.</p>
            <button className="btn btn-primary mt-4" onClick={() => setCreating(true)}>New society</button>
          </div>
        )}

        <p className="mt-10 text-center">
          <button className="label underline underline-offset-4" onClick={resetDemo}>
            Reset demo data
          </button>
        </p>
      </main>

      <Footer />
    </>
  );
}

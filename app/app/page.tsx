"use client";

import Link from "next/link";
import { useState } from "react";
import { Header, Footer } from "@/components/Chrome";
import { SocietyBadge } from "@/components/Badge";
import { useRouter } from "next/navigation";
import { useDB, useReady, select, resetDemo } from "@/lib/store";
import { bestNTotal } from "@/lib/scoring";

/**
 * Home is a dashboard, not a landing page: what's live, then your societies,
 * then quiet actions. Each zone gets its own visual weight so a glance tells
 * them apart — the live day glows, societies are tiles, admin is small print.
 */
export default function Home() {
  const db = useDB();
  const router = useRouter();
  const ready = useReady();
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const me = db.me;

  const joinWithCode = () => {
    const c = code.trim();
    if (!c) return;
    const ev = db.events.find((e) => e.shareToken === c);
    if (ev) { router.push(`/live-board?b=${c}`); return; }
    const g = db.groups.find((x) => x.scorerToken === c);
    if (g) { router.push(`/scorecard?g=${c}`); return; }
    setCodeErr("Code not recognised on this phone. Cross-phone codes arrive with shared accounts — for now, open the link you were sent.");
  };

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

        {!live && (() => {
          const next = select.nextUp(db);
          if (!next) return null;
          const soc = db.societies.find((x) => x.id === next.societyId);
          return (
            <Link href={`/event?e=${next.id}`} className="card feed mb-7 block p-4 rise">
              <div className="flex items-center justify-between gap-3">
                <span className="chip chip-acid">Next up</span>
                <span className="label">
                  {new Date(next.playsOn + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                </span>
              </div>
              <div className="mt-2.5 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="display truncate text-[1.2rem]">{next.name}</h3>
                  <p className="label mt-1">{soc?.name}</p>
                </div>
                <span className="btn btn-ghost !min-h-[2.4rem] !text-[0.78rem]">Open</span>
              </div>
            </Link>
          );
        })()}

        {/* ------------------------------------------------- get started --- */}
        <div className="mb-7 grid grid-cols-2 gap-2">
          <Link href="/new-day" className="btn btn-primary !min-h-[3.2rem]">+ Create</Link>
          <button className="btn btn-ghost !min-h-[3.2rem]" onClick={() => { setJoining((v) => !v); setCodeErr(null); }}>
            Join with a code
          </button>
        </div>
        {joining && (
          <form className="card mb-7 grid gap-3 p-4 rise"
                onSubmit={(e) => { e.preventDefault(); joinWithCode(); }}>
            <label>
              <span className="label mb-1.5 block">Invite code</span>
              <input className="field mono" autoFocus placeholder="e.g. augmeet"
                     value={code} onChange={(e) => { setCode(e.target.value); setCodeErr(null); }} />
            </label>
            <div className="flex items-center gap-3">
              <button className="btn btn-primary" type="submit">Join</button>
              <span className="label !normal-case !tracking-normal">
                Or scan the day’s QR code with your camera.
              </span>
            </div>
            {codeErr && <p className="label !normal-case !tracking-normal" style={{ color: "var(--color-live)" }}>{codeErr}</p>}
          </form>
        )}

        {/* ------------------------------------------------- societies ----- */}
        <h2 className="label mb-3 !text-[0.75rem]">Your societies</h2>


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
                <SocietyBadge society={s} size={54} rounded={12} />
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
            <Link href="/new-day" className="btn btn-primary mt-4 inline-flex">Get started</Link>
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

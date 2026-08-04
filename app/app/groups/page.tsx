"use client";

import Link from "next/link";
import { Header, Footer } from "@/components/Chrome";
import { SocietyBadge } from "@/components/Badge";
import { useDB, useReady, select } from "@/lib/store";

/** Your groups — every society you run or play in, one tile each. */
export default function GroupsPage() {
  const db = useDB();
  const ready = useReady();

  return (
    <>
      <Header back={{ href: "/", label: "Home" }} />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-16">
        <section className="flex items-center justify-between py-7">
          <div>
            <p className="label">Societies · leagues · trips</p>
            <h1 className="display mt-1 text-[clamp(1.6rem,5.5vw,2.2rem)]">Your groups</h1>
          </div>
          <Link href="/new-day" className="btn btn-primary !min-h-[2.6rem] !text-[0.8rem]">+ Create</Link>
        </section>

        <div className="grid gap-3">
          {db.societies.map((s) => {
            const players = select.players(db, s.id);
            const events = select.events(db, s.id);
            const live = select.liveToday(db)?.societyId === s.id;
            return (
              <Link key={s.id} href={`/society?s=${s.slug}`}
                    className="card flex items-center gap-3.5 p-3.5 transition-transform hover:-translate-y-0.5">
                <SocietyBadge society={s} size={54} rounded={12} />
                <span className="min-w-0 flex-1">
                  <span className="name block truncate text-[1.02rem]">{s.name}</span>
                  <span className="label mt-0.5 block">
                    {players.length} players · {events.length} events
                  </span>
                </span>
                {live ? (
                  <span className="chip chip-live shrink-0"><span className="pulse" /> Live</span>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                )}
              </Link>
            );
          })}
        </div>

        {db.societies.length === 0 && ready && (
          <div className="card p-6 text-center">
            <p className="text-[0.95rem]">No groups yet.</p>
            <Link href="/new-day" className="btn btn-primary mt-4 inline-flex">Set one up properly</Link>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

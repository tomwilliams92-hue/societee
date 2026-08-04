"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Chrome";
import { useDB, select, actions } from "@/lib/store";
import { COURSES, courseOfTee } from "@/lib/courses";
import { allowancesFor } from "@/lib/scoring";

/**
 * "Let's set your day up properly."
 *
 * The guided path for creating a golf day. The Squabbit lesson (their reviews:
 * "the settings situation is daunting… two hours") isn't that setup shouldn't
 * exist — a properly set up game is the whole point — it's that setup must not
 * be one wall of options. One decision per step, defaults already right, and
 * nothing here that can't be changed later.
 */
function NewDay() {
  const db = useDB();
  const router = useRouter();
  const slug = useSearchParams().get("s") ?? "";
  const society = select.society(db, slug);
  const players = society ? select.players(db, society.id) : [];
  const seriesNames = society ? select.seriesFor(db, society.id).map((x) => x.name) : [];

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [playsOn, setPlaysOn] = useState(new Date().toISOString().slice(0, 10));
  const [teeId, setTeeId] = useState("conwy-white");
  const [allow, setAllow] = useState(95);
  const [trip, setTrip] = useState("");
  const [inField, setInField] = useState<Record<string, boolean>>({});

  if (!society) {
    return (
      <>
        <Header back={{ href: "/", label: "Home" }} />
        <main className="mx-auto max-w-lg flex-1 px-4 py-20 text-center">
          <p className="label">No society selected.</p>
        </main>
      </>
    );
  }

  const union = courseOfTee(teeId)?.country;
  const allowed = allowancesFor(union);
  const allowance = allowed.includes(allow) ? allow : 95;
  const picked = players.filter((p) => inField[p.id] !== false);
  const groups = Math.max(1, Math.ceil(picked.length / 4));
  const TOTAL = 4;

  const next = () => setStep((v) => Math.min(TOTAL, v + 1));
  const create = () => {
    const ev = actions.createEvent(society.id, {
      name: name.trim() || `${society.name} day`,
      playsOn,
      teeId,
      handicapAllowance: allowance,
      seriesName: trip.trim() || undefined,
      playerIds: picked.map((p) => p.id),
    });
    router.push(`/event?e=${ev.id}`);
  };

  return (
    <>
      <Header back={{ href: `/society?s=${society.slug}`, label: society.name }} />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-16">
        <section className="py-7">
          <p className="label">Step {step} of {TOTAL}</p>
          <h1 className="display mt-2 text-[clamp(1.6rem,5vw,2.1rem)]">
            Let’s set your day up properly.
          </h1>
          {/* progress */}
          <div className="mt-4 flex gap-1">
            {Array.from({ length: TOTAL }, (_, i) => (
              <span
                key={i}
                className="h-1 flex-1 rounded-full"
                style={{ background: i < step ? "var(--color-acid)" : "var(--color-line)" }}
              />
            ))}
          </div>
        </section>

        {/* ---------------------------------------------- 1 · what & when -- */}
        {step === 1 && (
          <div className="card grid gap-4 p-4 rise">
            <label>
              <span className="label mb-1.5 block">What’s the day called?</span>
              <input
                className="field"
                autoFocus
                placeholder="August Meeting"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              <span className="label mb-1.5 block">When is it?</span>
              <input className="field" type="date" value={playsOn} onChange={(e) => setPlaysOn(e.target.value)} />
            </label>
            <label>
              <span className="label mb-1.5 block">Part of a trip? (optional)</span>
              <input
                className="field"
                list="trips"
                placeholder="e.g. Spring Trip — days add up on one board"
                value={trip}
                onChange={(e) => setTrip(e.target.value)}
              />
              <datalist id="trips">
                {seriesNames.map((n) => <option key={n} value={n} />)}
              </datalist>
            </label>
          </div>
        )}

        {/* ---------------------------------------------- 2 · the course --- */}
        {step === 2 && (
          <div className="card grid gap-4 p-4 rise">
            <label>
              <span className="label mb-1.5 block">Course &amp; tee</span>
              <select className="field" value={teeId} onChange={(e) => setTeeId(e.target.value)}>
                {COURSES.flatMap((c) =>
                  c.tees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {c.name} — {t.name} (par {t.par})
                    </option>
                  ))
                )}
              </select>
              <span className="label mt-1.5 block !normal-case !tracking-normal">
                Course and playing handicaps come off this tee’s rating, slope and stroke
                indexes — set it right and every shot lands on the right hole.
              </span>
            </label>
            <label>
              <span className="label mb-1.5 block">Handicap allowance</span>
              <select
                className="field"
                value={allowance}
                disabled={allowed.length === 1}
                onChange={(e) => setAllow(Number(e.target.value))}
              >
                {allowed.map((a) => (
                  <option key={a} value={a}>{a}%{a === 95 ? " — WHS default" : ""}</option>
                ))}
              </select>
              <span className="label mt-1.5 block !normal-case !tracking-normal">
                {union === "England"
                  ? "Fixed at 95% in England until 2028."
                  : `${union} allows 85–100% for singles since April 2026.`}
              </span>
            </label>
          </div>
        )}

        {/* ---------------------------------------------- 3 · the field ---- */}
        {step === 3 && (
          <div className="card p-4 rise">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="label">Who’s playing?</span>
              <span className="label" style={{ color: "var(--color-acid)" }}>
                {picked.length} of {players.length}
              </span>
            </div>
            <div className="grid gap-1.5">
              {players.map((p) => {
                const on = inField[p.id] !== false;
                return (
                  <button
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-[2px] border px-3 py-2.5 text-left"
                    style={{
                      borderColor: on ? "var(--color-acid)" : "var(--color-line)",
                      opacity: on ? 1 : 0.55,
                    }}
                    onClick={() => setInField({ ...inField, [p.id]: !on })}
                  >
                    <span className="text-[0.9rem]">{p.name}</span>
                    <span className="label">{on ? "In" : "Out"}</span>
                  </button>
                );
              })}
            </div>
            {players.length === 0 && (
              <p className="label !normal-case !tracking-normal">
                No players yet — add them on the society’s Players tab first.
              </p>
            )}
          </div>
        )}

        {/* ---------------------------------------------- 4 · confirm ------ */}
        {step === 4 && (
          <div className="card grid gap-3 p-4 rise">
            <Row k="Day" v={name.trim() || `${society.name} day`} />
            <Row k="Date" v={playsOn} />
            <Row k="Course" v={COURSES.flatMap((c) => c.tees).find((t) => t.id === teeId) ? `${courseOfTee(teeId)?.name} — ${COURSES.flatMap((c) => c.tees).find((t) => t.id === teeId)!.name}` : "—"} />
            <Row k="Allowance" v={`${allowance}%`} />
            {trip.trim() && <Row k="Trip" v={trip.trim()} />}
            <Row k="Field" v={`${picked.length} players · ${groups} group${groups === 1 ? "" : "s"}`} />
            <p className="label !normal-case !tracking-normal">
              Each group gets its own scoring link, and the board goes on a QR code. Everything
              here can be changed on the day.
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {step > 1 && (
            <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>‹ Back</button>
          )}
          {step < TOTAL ? (
            <button className="btn btn-primary flex-1" onClick={next}>Next ›</button>
          ) : (
            <button className="btn btn-primary flex-1" onClick={create} disabled={picked.length === 0}>
              Create the day
            </button>
          )}
        </div>
      </main>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line-soft)] pb-2">
      <span className="label">{k}</span>
      <span className="text-right text-[0.9rem]">{v}</span>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <NewDay />
    </Suspense>
  );
}

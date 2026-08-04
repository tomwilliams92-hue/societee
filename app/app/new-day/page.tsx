"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Chrome";
import { useDB, select, actions } from "@/lib/store";
import { COURSES, courseOfTee } from "@/lib/courses";
import { allowancesFor } from "@/lib/scoring";

/**
 * "Let's set your game up properly." — the guided setup, structured the way
 * Squabbit's wizard is (their July 2026 rebuild: type → name → rounds → course
 * → players, every step skippable, "you can change this later" everywhere),
 * minus their mistake of making you choose Tournament vs League vs Club before
 * you know what those words mean. We ask what you're actually running.
 */
type Kind = "day" | "trip" | "season";

function NewGame() {
  const db = useDB();
  const router = useRouter();
  const slug = useSearchParams().get("s") ?? "";
  const society = select.society(db, slug);
  const players = society ? select.players(db, society.id) : [];

  const [kind, setKind] = useState<Kind | null>(null);
  const [step, setStep] = useState(0);         // 0 = choose type
  const [name, setName] = useState("");
  const [playsOn, setPlaysOn] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState(2);
  const [endsOn, setEndsOn] = useState("2026-09-30");
  const [bestN, setBestN] = useState<number | "">(6);
  const [prize, setPrize] = useState("");
  const [teeId, setTeeId] = useState("conwy-white");
  const [allow, setAllow] = useState(95);
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
  const TOTAL = kind === "season" ? 3 : kind === "trip" ? 5 : 4;

  const defaultName =
    kind === "trip" ? `${society.name} trip` :
    kind === "season" ? `Order of Merit ${new Date().getFullYear()}` :
    `${society.name} day`;

  const create = () => {
    const finalName = name.trim() || defaultName;
    if (kind === "season") {
      actions.createSeason(society.id, {
        name: finalName, startsOn: playsOn, endsOn,
        bestN: bestN === "" ? null : Number(bestN),
        prize: prize.trim() || undefined,
      });
      router.push(`/society?s=${society.slug}`);
      return;
    }
    if (kind === "trip") {
      let first: string | null = null;
      for (let d = 0; d < days; d++) {
        const date = new Date(playsOn + "T12:00:00");
        date.setDate(date.getDate() + d);
        const ev = actions.createEvent(society.id, {
          name: `${finalName} — Day ${d + 1}`,
          playsOn: date.toISOString().slice(0, 10),
          teeId, handicapAllowance: allowance,
          seriesName: finalName,
          playerIds: picked.map((p) => p.id),
        });
        first ??= ev.id;
      }
      router.push(`/event?e=${first}`);
      return;
    }
    const ev = actions.createEvent(society.id, {
      name: finalName, playsOn, teeId, handicapAllowance: allowance,
      playerIds: picked.map((p) => p.id),
    });
    router.push(`/event?e=${ev.id}`);
  };

  const kinds: { k: Kind; title: string; sub: string }[] = [
    { k: "day", title: "One golf day", sub: "A single round. Live board on a QR code, cards in by tea time." },
    { k: "trip", title: "A trip", sub: "Several days, one combined board — R1, R2, R3, like a tour event." },
    { k: "season", title: "A season", sub: "An Order of Merit across months. Best cards count, winner takes the jug." },
  ];

  return (
    <>
      <Header back={{ href: `/society?s=${society.slug}`, label: society.name }} />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-16">
        <section className="py-7">
          <p className="label">{step === 0 ? "New game" : `Step ${step} of ${TOTAL}`}</p>
          <h1 className="display mt-2 text-[clamp(1.5rem,5vw,2rem)]">
            {step === 0 ? "Let’s set your game up properly." : kinds.find((x) => x.k === kind)?.title}
          </h1>
          {step > 0 && (
            <div className="mt-4 flex gap-1">
              {Array.from({ length: TOTAL }, (_, i) => (
                <span key={i} className="h-1 flex-1 rounded-full"
                      style={{ background: i < step ? "var(--color-acid)" : "var(--color-line)" }} />
              ))}
            </div>
          )}
        </section>

        {/* ------------------------------------------ 0 · what is this? --- */}
        {step === 0 && (
          <div className="grid gap-3 rise">
            {kinds.map(({ k, title, sub }) => (
              <button
                key={k}
                className="card p-4 text-left transition-transform hover:-translate-y-0.5"
                onClick={() => { setKind(k); setStep(1); }}
              >
                <span className="name block text-[1.05rem]">{title}</span>
                <span className="mt-1 block text-[0.85rem] leading-relaxed text-[var(--color-dim)]">{sub}</span>
              </button>
            ))}
            <p className="label !normal-case !tracking-normal">
              Whatever you pick, it’s a couple of minutes and everything can be changed later.
            </p>
          </div>
        )}

        {/* ------------------------------------------ 1 · name it --------- */}
        {step === 1 && (
          <div className="card grid gap-4 p-4 rise">
            <label>
              <span className="label mb-1.5 block">Name it</span>
              <input className="field" autoFocus placeholder={defaultName}
                     value={name} onChange={(e) => setName(e.target.value)} />
              <span className="label mt-1.5 block !normal-case !tracking-normal">
                This is what players see when they join.
              </span>
            </label>
            {kind !== "season" ? (
              <label>
                <span className="label mb-1.5 block">{kind === "trip" ? "First day" : "When is it?"}</span>
                <input className="field" type="date" value={playsOn} onChange={(e) => setPlaysOn(e.target.value)} />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="label mb-1.5 block">Starts</span>
                  <input className="field" type="date" value={playsOn} onChange={(e) => setPlaysOn(e.target.value)} />
                </label>
                <label>
                  <span className="label mb-1.5 block">Ends</span>
                  <input className="field" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
                </label>
              </div>
            )}
            {kind === "trip" && (
              <label>
                <span className="label mb-1.5 block">How many days?</span>
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map((n) => (
                    <button key={n} type="button"
                      className="btn flex-1 !min-h-[2.6rem]"
                      style={days === n
                        ? { background: "var(--color-acid)", color: "#06080a" }
                        : { border: "1px solid var(--color-line)", color: "var(--color-text)" }}
                      onClick={() => setDays(n)}>
                      {n}
                    </button>
                  ))}
                </div>
                <span className="label mt-1.5 block !normal-case !tracking-normal">
                  Consecutive days, one board. Days can be edited after.
                </span>
              </label>
            )}
            {kind === "season" && (
              <>
                <label>
                  <span className="label mb-1.5 block">Best how many cards count?</span>
                  <input className="field num w-[9rem]" type="number" min={1} max={30}
                         value={bestN} onChange={(e) => setBestN(e.target.value === "" ? "" : Number(e.target.value))} />
                  <span className="label mt-1.5 block !normal-case !tracking-normal">
                    Best 6 is the classic — nobody’s ruined by one shocker.
                  </span>
                </label>
                <label>
                  <span className="label mb-1.5 block">Playing for? (optional)</span>
                  <input className="field" placeholder="Winner takes the jug"
                         value={prize} onChange={(e) => setPrize(e.target.value)} />
                </label>
              </>
            )}
          </div>
        )}

        {/* ------------------------------------------ 2 · course ---------- */}
        {step === 2 && kind !== "season" && (
          <div className="card grid gap-4 p-4 rise">
            <label>
              <span className="label mb-1.5 block">Choose a course</span>
              <select className="field" value={teeId} onChange={(e) => setTeeId(e.target.value)}>
                {COURSES.flatMap((c) =>
                  c.tees.map((t) => (
                    <option key={t.id} value={t.id}>{c.name} — {t.name} (par {t.par})</option>
                  ))
                )}
              </select>
              <span className="label mt-1.5 block !normal-case !tracking-normal">
                {kind === "trip"
                  ? "Same course for every day for now — days can be changed individually after."
                  : "Handicaps and shots per hole come off this tee’s rating, slope and stroke indexes."}
              </span>
            </label>
            <label>
              <span className="label mb-1.5 block">Handicap allowance</span>
              <select className="field" value={allowance} disabled={allowed.length === 1}
                      onChange={(e) => setAllow(Number(e.target.value))}>
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

        {/* ------------------------------------------ 3 · players --------- */}
        {step === 3 && kind !== "season" && (
          <div className="card p-4 rise">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="label">Add players</span>
              <span className="label" style={{ color: "var(--color-acid)" }}>{picked.length} of {players.length}</span>
            </div>
            <div className="grid gap-1.5">
              {players.map((p) => {
                const on = inField[p.id] !== false;
                return (
                  <button key={p.id}
                    className="flex items-center justify-between gap-3 rounded-[10px] border px-3 py-2.5 text-left"
                    style={{ borderColor: on ? "var(--color-acid)" : "var(--color-line)", opacity: on ? 1 : 0.55 }}
                    onClick={() => setInField({ ...inField, [p.id]: !on })}>
                    <span className="text-[0.9rem]">{p.name}</span>
                    <span className="label">{on ? "In" : "Out"}</span>
                  </button>
                );
              })}
            </div>
            <p className="label mt-3 !normal-case !tracking-normal">
              Add players yourself for now — “let players register themselves” arrives with shared
              accounts. Latecomers can be added on the day.
            </p>
          </div>
        )}

        {/* ------------------------------------------ confirm -------------- */}
        {step === TOTAL && (
          <div className="card grid gap-3 p-4 rise">
            <Row k="Setting up" v={kinds.find((x) => x.k === kind)?.title ?? ""} />
            <Row k="Name" v={name.trim() || defaultName} />
            {kind === "season" ? (
              <>
                <Row k="Runs" v={`${playsOn} → ${endsOn}`} />
                <Row k="Counting" v={bestN === "" ? "every card" : `best ${bestN} cards`} />
                {prize.trim() && <Row k="Prize" v={prize.trim()} />}
              </>
            ) : (
              <>
                <Row k={kind === "trip" ? "Days" : "Date"} v={kind === "trip" ? `${days}, from ${playsOn}` : playsOn} />
                <Row k="Course" v={`${courseOfTee(teeId)?.name} — ${COURSES.flatMap(c => c.tees).find(t => t.id === teeId)?.name}`} />
                <Row k="Allowance" v={`${allowance}%`} />
                <Row k="Field" v={`${picked.length} players`} />
              </>
            )}
            <p className="label !normal-case !tracking-normal">
              {kind === "season"
                ? "Every day you run inside these dates counts automatically."
                : "Each group gets its own scoring link, and the board goes on a QR code."}
            </p>
          </div>
        )}

        {step > 0 && (
          <div className="mt-4 flex gap-2">
            <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>‹ Back</button>
            {step < TOTAL ? (
              <button className="btn btn-primary flex-1"
                onClick={() => setStep(kind === "season" && step === 1 ? TOTAL : step + 1)}>
                Next ›
              </button>
            ) : (
              <button className="btn btn-primary flex-1" onClick={create}
                      disabled={kind !== "season" && picked.length === 0}>
                {kind === "season" ? "Start the season" : kind === "trip" ? "Create the trip" : "Create the day"}
              </button>
            )}
          </div>
        )}
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
      <NewGame />
    </Suspense>
  );
}

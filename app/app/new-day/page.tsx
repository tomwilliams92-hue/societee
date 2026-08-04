"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Chrome";
import { Badge, BADGES } from "@/components/Badge";
import { useDB, select, actions } from "@/lib/store";
import { COURSES, courseOfTee } from "@/lib/courses";
import { allowancesFor, parseHandicap, formatHandicap } from "@/lib/scoring";

/**
 * ONE wizard for everything, Squabbit-shaped: first "what are you setting up",
 * then name → (course → players) → confirm, every step with a plain-words
 * explanation and nothing that can't be changed later. A society is just the
 * fourth thing you can set up — no separate flow to learn.
 */
type Kind = "society" | "day" | "trip" | "season";

function NewGame() {
  const db = useDB();
  const router = useRouter();
  const slugParam = useSearchParams().get("s") ?? "";

  const [kind, setKind] = useState<Kind | null>(null);
  const [step, setStep] = useState(0);
  const [socId, setSocId] = useState<string | null>(null);

  // society fields
  const [homeClub, setHomeClub] = useState("");
  const [badge, setBadge] = useState<string>("flag-green");
  const [crestData, setCrestData] = useState<string | null>(null);
  const [roster, setRoster] = useState("");

  // shared fields
  const [name, setName] = useState("");
  const [playsOn, setPlaysOn] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState(2);
  const [endsOn, setEndsOn] = useState("2026-09-30");
  const [bestN, setBestN] = useState<number | "">(6);
  const [prize, setPrize] = useState("");
  const [teeId, setTeeId] = useState("conwy-white");
  const [allow, setAllow] = useState(95);
  const [inField, setInField] = useState<Record<string, boolean>>({});

  const society =
    db.societies.find((x) => x.id === socId) ??
    (slugParam ? select.society(db, slugParam) : undefined);
  const players = society ? select.players(db, society.id) : [];

  const union = courseOfTee(teeId)?.country;
  const allowed = allowancesFor(union);
  const allowance = allowed.includes(allow) ? allow : 95;
  const picked = players.filter((p) => inField[p.id] !== false);

  // society flow: name → identity → players → confirm  (4 steps)
  // day: [society?] → name → course → players → confirm
  // trip: same as day; season: [society?] → name → confirm
  const needsSocietyStep = kind !== "society" && kind !== null && !society;
  const TOTAL =
    kind === "society" ? 4 :
    kind === "season" ? (needsSocietyStep ? 3 : 2) + 1 :
    (needsSocietyStep ? 5 : 4);

  const defaultName =
    kind === "society" ? "" :
    kind === "trip" ? `${society?.name ?? "Our"} trip` :
    kind === "season" ? `Order of Merit ${new Date().getFullYear()}` :
    `${society?.name ?? "Society"} day`;

  /** "Dave Prichard, 12.4" or "Dave Prichard 12.4" — one per line. */
  const parseRoster = () =>
    roster.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/^(.*?)[,\s]+([+\-]?\d+(?:\.\d+)?)$/);
      return m
        ? { name: m[1].trim(), hcp: parseHandicap(m[2]) }
        : { name: l.replace(/,$/, "").trim(), hcp: null };
    });

  const create = () => {
    if (kind === "society") {
      const soc = actions.createSociety(name.trim() || "My society", homeClub.trim() || undefined, {
        badge: crestData ? undefined : badge,
        crestData: crestData ?? undefined,
      });
      for (const r of parseRoster()) if (r.name) actions.addPlayer(soc.id, r.name, r.hcp);
      router.push(`/society?s=${soc.slug}`);
      return;
    }
    if (!society) return;
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
          teeId, handicapAllowance: allowance, seriesName: finalName,
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
    { k: "society", title: "A society", sub: "Your ongoing group — its players, badge and identity. Days, trips and seasons live inside it." },
    { k: "day", title: "One golf day", sub: "A single round. Live board on a QR code, cards in by tea time." },
    { k: "trip", title: "A trip", sub: "Several days, one combined board — R1, R2, R3, like a tour event." },
    { k: "season", title: "A season", sub: "An Order of Merit across months. Best cards count, winner takes the jug." },
  ];

  // which logical screen are we on?
  const screen: string = (() => {
    if (step === 0) return "type";
    if (kind === "society") return ["name", "identity", "roster", "confirm"][step - 1] ?? "confirm";
    let i = step;
    if (needsSocietyStep) { if (i === 1) return "pick-society"; i -= 1; }
    if (kind === "season") return ["name", "confirm"][i - 1] ?? "confirm";
    return ["name", "course", "players", "confirm"][i - 1] ?? "confirm";
  })();

  const onPickImage = (file: File) => {
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const c = document.createElement("canvas");
      c.width = size; c.height = size;
      const ctx = c.getContext("2d")!;
      const m = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
      setCrestData(c.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <>
      <Header back={society ? { href: `/society?s=${society.slug}`, label: society.name } : { href: "/", label: "Home" }} />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-16">
        <section className="py-7">
          <p className="label">{step === 0 ? "Get started" : `Step ${step} of ${TOTAL}`}</p>
          <h1 className="display mt-2 text-[clamp(1.5rem,5vw,2rem)]">
            {step === 0 ? "Let’s set it up properly." : kinds.find((x) => x.k === kind)?.title}
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

        {screen === "type" && (
          <div className="grid gap-3 rise">
            {kinds.map(({ k, title, sub }) => (
              <button key={k} className="card p-4 text-left transition-transform hover:-translate-y-0.5"
                      onClick={() => { setKind(k); setStep(1); }}>
                <span className="name block text-[1.05rem]">{title}</span>
                <span className="mt-1 block text-[0.85rem] leading-relaxed text-[var(--color-dim)]">{sub}</span>
              </button>
            ))}
          </div>
        )}

        {screen === "pick-society" && (
          <div className="grid gap-2 rise">
            <p className="label !normal-case !tracking-normal">Which society is this for?</p>
            {db.societies.map((s) => (
              <button key={s.id} className="card flex items-center justify-between p-4 text-left"
                      onClick={() => { setSocId(s.id); setStep(step + 1); }}>
                <span className="name text-[1rem]">{s.name}</span>
                <span className="label">{select.players(db, s.id).length} players</span>
              </button>
            ))}
            {db.societies.length === 0 && (
              <button className="card p-4 text-left" onClick={() => { setKind("society"); setStep(1); }}>
                <span className="name text-[1rem]">No societies yet — set one up first ›</span>
              </button>
            )}
          </div>
        )}

        {screen === "name" && (
          <div className="card grid gap-4 p-4 rise">
            <label>
              <span className="label mb-1.5 block">Name it</span>
              <input className="field" autoFocus
                     placeholder={kind === "society" ? "Weekend Dogs" : defaultName}
                     value={name} onChange={(e) => setName(e.target.value)} />
              <span className="label mt-1.5 block !normal-case !tracking-normal">
                This is what players see when they join.
              </span>
            </label>
            {kind === "society" && (
              <label>
                <span className="label mb-1.5 block">Home club (optional)</span>
                <input className="field" placeholder="Conwy" value={homeClub}
                       onChange={(e) => setHomeClub(e.target.value)} />
              </label>
            )}
            {(kind === "day" || kind === "trip") && (
              <label>
                <span className="label mb-1.5 block">{kind === "trip" ? "First day" : "When is it?"}</span>
                <input className="field" type="date" value={playsOn} onChange={(e) => setPlaysOn(e.target.value)} />
              </label>
            )}
            {kind === "trip" && (
              <label>
                <span className="label mb-1.5 block">How many days?</span>
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" className="btn flex-1 !min-h-[2.6rem]"
                      style={days === n ? { background: "var(--color-acid)", color: "#06080a" }
                                        : { border: "1px solid var(--color-line)", color: "var(--color-text)" }}
                      onClick={() => setDays(n)}>{n}</button>
                  ))}
                </div>
              </label>
            )}
            {kind === "season" && (
              <>
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
                <label>
                  <span className="label mb-1.5 block">Best how many cards count?</span>
                  <input className="field num w-[9rem]" type="number" min={1} max={30} value={bestN}
                         onChange={(e) => setBestN(e.target.value === "" ? "" : Number(e.target.value))} />
                  <span className="label mt-1.5 block !normal-case !tracking-normal">
                    Best 6 is the classic — nobody’s ruined by one shocker.
                  </span>
                </label>
                <label>
                  <span className="label mb-1.5 block">Playing for? (optional)</span>
                  <input className="field" placeholder="Winner takes the jug" value={prize}
                         onChange={(e) => setPrize(e.target.value)} />
                </label>
              </>
            )}
          </div>
        )}

        {screen === "identity" && (
          <div className="card grid gap-4 p-4 rise">
            <div>
              <span className="label mb-2 block">Pick a badge</span>
              <div className="grid grid-cols-4 gap-2">
                {BADGES.map((b) => (
                  <button key={b} type="button" aria-label={b}
                    className="rounded-[16px] p-0.5"
                    style={{ outline: !crestData && badge === b ? "2.5px solid var(--color-acid)" : "1px solid var(--color-line)" }}
                    onClick={() => { setBadge(b); setCrestData(null); }}>
                    <Badge id={b} size={70} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="label">Or</span>
              <label className="btn btn-ghost !min-h-[2.4rem] cursor-pointer !text-[0.8rem]">
                Upload your own
                <input type="file" accept="image/*" className="hidden"
                       onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickImage(f); }} />
              </label>
              {crestData && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={crestData} alt="" className="rounded-[12px] object-cover"
                     style={{ width: "2.9rem", height: "2.9rem", outline: "2.5px solid var(--color-acid)" }} />
              )}
            </div>
            <p className="label !normal-case !tracking-normal">
              Your badge fronts your society everywhere — home screen, boards, QR pages.
            </p>
          </div>
        )}

        {screen === "roster" && (
          <div className="card grid gap-3 p-4 rise">
            <label>
              <span className="label mb-1.5 block">Add your players — one per line</span>
              <textarea className="field min-h-[10rem] py-2.5 leading-relaxed" placeholder={"Dave Prichard, 12.4\nSteve Hughes, 18.1\nMark Ellis  (no handicap yet is fine)"}
                        value={roster} onChange={(e) => setRoster(e.target.value)} />
            </label>
            <p className="label !normal-case !tracking-normal">
              Name then handicap index. Plus golfers like “Owen Price, +1.6”. You can skip this and
              add players any time — and “let players register themselves” arrives with shared
              accounts.
            </p>
            {roster.trim() && (
              <p className="label" style={{ color: "var(--color-acid)" }}>
                {parseRoster().length} player{parseRoster().length === 1 ? "" : "s"} ready
                {parseRoster().some((r) => r.hcp != null) &&
                  ` · e.g. ${parseRoster()[0].name} HCP ${formatHandicap(parseRoster()[0].hcp)}`}
              </p>
            )}
          </div>
        )}

        {screen === "course" && (
          <div className="card grid gap-4 p-4 rise">
            <label>
              <span className="label mb-1.5 block">Choose a course</span>
              <select className="field" value={teeId} onChange={(e) => setTeeId(e.target.value)}>
                {COURSES.flatMap((c) => c.tees.map((t) => (
                  <option key={t.id} value={t.id}>{c.name} — {t.name} (par {t.par})</option>
                )))}
              </select>
              <span className="label mt-1.5 block !normal-case !tracking-normal">
                Handicaps and shots per hole come off this tee’s rating, slope and stroke indexes.
              </span>
            </label>
            <label>
              <span className="label mb-1.5 block">Handicap allowance</span>
              <select className="field" value={allowance} disabled={allowed.length === 1}
                      onChange={(e) => setAllow(Number(e.target.value))}>
                {allowed.map((a) => <option key={a} value={a}>{a}%{a === 95 ? " — WHS default" : ""}</option>)}
              </select>
              <span className="label mt-1.5 block !normal-case !tracking-normal">
                {union === "England" ? "Fixed at 95% in England until 2028."
                  : `${union} allows 85–100% for singles since April 2026.`}
              </span>
            </label>
          </div>
        )}

        {screen === "players" && (
          <div className="card p-4 rise">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="label">Who’s playing?</span>
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
            {players.length === 0 && (
              <p className="label !normal-case !tracking-normal">
                This society has no players yet — add them on its Players section first.
              </p>
            )}
          </div>
        )}

        {screen === "confirm" && (
          <div className="card grid gap-3 p-4 rise">
            <Row k="Setting up" v={kinds.find((x) => x.k === kind)?.title ?? ""} />
            <Row k="Name" v={name.trim() || defaultName || "My society"} />
            {kind === "society" && (
              <>
                {homeClub.trim() && <Row k="Home club" v={homeClub.trim()} />}
                <div className="flex items-center justify-between gap-4 border-b border-[var(--line-soft)] pb-2">
                  <span className="label">Badge</span>
                  {crestData
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={crestData} alt="" className="rounded-[10px]" style={{ width: "2.4rem", height: "2.4rem", objectFit: "cover" }} />
                    : <Badge id={badge} size={38} rounded={10} />}
                </div>
                <Row k="Players" v={`${parseRoster().length} to add`} />
              </>
            )}
            {kind === "season" && (
              <>
                <Row k="Runs" v={`${playsOn} → ${endsOn}`} />
                <Row k="Counting" v={bestN === "" ? "every card" : `best ${bestN} cards`} />
                {prize.trim() && <Row k="Prize" v={prize.trim()} />}
              </>
            )}
            {(kind === "day" || kind === "trip") && (
              <>
                <Row k={kind === "trip" ? "Days" : "Date"} v={kind === "trip" ? `${days}, from ${playsOn}` : playsOn} />
                <Row k="Course" v={`${courseOfTee(teeId)?.name} — ${COURSES.flatMap(c => c.tees).find(t => t.id === teeId)?.name}`} />
                <Row k="Allowance" v={`${allowance}%`} />
                <Row k="Field" v={`${picked.length} players`} />
              </>
            )}
          </div>
        )}

        {step > 0 && (
          <div className="mt-4 flex gap-2">
            <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>‹ Back</button>
            {step < TOTAL ? (
              <button className="btn btn-primary flex-1" onClick={() => setStep(step + 1)}
                      disabled={screen === "pick-society"}>
                Next ›
              </button>
            ) : (
              <button className="btn btn-primary flex-1" onClick={create}
                      disabled={(kind === "day" || kind === "trip") && picked.length === 0}>
                {kind === "society" ? "Create the society" :
                 kind === "season" ? "Start the season" :
                 kind === "trip" ? "Create the trip" : "Create the day"}
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

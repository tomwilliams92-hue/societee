"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Chrome";
import { Badge, BADGES } from "@/components/Badge";
import { useDB, select, actions } from "@/lib/store";
import { COURSES, courseOfTee, customTeesFor, searchCourses, teeById, UK_DIRECTORY } from "@/lib/courses";
import { allowancesFor, parseHandicap, formatHandicap } from "@/lib/scoring";
import { IS_REMOTE } from "@/lib/supabase/config";
import type { Course, ScoringFormat } from "@/lib/types";

/**
 * ONE wizard for everything, and the event flow is the Squabbit five-step
 * process step for step: name → scoring formats → rounds → course → players.
 * Numbered-circle progress, every step explained in plain words, "Skip for
 * now" wherever skipping is honest. Their trio maps onto ours exactly:
 * Tournament→Event, League→Season, Club→Society — a trip is just an event
 * with more than one round, so it stopped being a separate thing to learn.
 *
 * One deliberate divergence: Squabbit lets you skip the course step. We don't,
 * because playing handicaps come off the tee's CR/slope — an event with no tee
 * would mean inventing them.
 */
type Kind = "event" | "season" | "society";

/** The formats the engine genuinely scores — no dead rows, no "coming soon". */
const FORMATS: { f: ScoringFormat; name: string; body: string; hcp: string }[] = [
  {
    f: "stableford",
    name: "Stableford",
    body:
      "Points on every hole from your net score — par 2, birdie 3, eagle 4. " +
      "Highest points wins and a blow-up hole costs nothing. Verified against " +
      "the WHS formula end to end, with live hole-by-hole points.",
    hcp: "Playing handicap = course handicap × the day's allowance.",
  },
  {
    f: "medal",
    name: "Medal",
    body:
      "Classic net strokeplay: every stroke counts and your playing handicap " +
      "comes off at the end. Lowest net wins. One bad hole counts in full — " +
      "that's medal golf.",
    hcp: "Net = adjusted gross − playing handicap.",
  },
  {
    f: "gross",
    name: "Gross strokeplay",
    body:
      "Total strokes, no handicap. Lowest gross wins. For scratch boards and " +
      "the club championship.",
    hcp: "Handicaps not applied.",
  },
];

const TEE_NAMES = ["White", "Yellow", "Blue", "Red"];

/** The colour on the tee marker itself — instantly readable, like the card. */
const TEE_COLOURS: Record<string, string> = {
  white: "#ececec", yellow: "#ffd94d", blue: "#4f8fff", red: "#ff5a5a",
  green: "#35c05e", black: "#111418", gold: "#d9a92c", silver: "#c8c8d0",
  orange: "#ff9040", purple: "#b07fff",
};

function TeeDot({ name }: { name: string }) {
  const c = TEE_COLOURS[name.trim().toLowerCase()];
  return (
    <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: c ?? "var(--color-dim)", boxShadow: "0 0 0 1.5px rgba(255,255,255,0.28)" }} />
  );
}

function NewGame() {
  const db = useDB();
  const router = useRouter();
  const slugParam = useSearchParams().get("s") ?? "";

  const [kind, setKind] = useState<Kind | null>(null);
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [socId, setSocId] = useState<string | null>(null);

  // society fields
  const [homeClub, setHomeClub] = useState("");
  const [badge, setBadge] = useState<string>("flag-green");
  const [crestData, setCrestData] = useState<string | null>(null);
  // Structured roster rows — a box for the name, a box for the exact index.
  const [roster, setRoster] = useState<{ name: string; hcp: string }[]>([
    { name: "", hcp: "" },
    { name: "", hcp: "" },
    { name: "", hcp: "" },
  ]);

  // event fields
  const [name, setName] = useState("");
  const [playsOn, setPlaysOn] = useState(new Date().toISOString().slice(0, 10));
  const [format, setFormat] = useState<ScoringFormat>("stableford");
  const [rounds, setRounds] = useState(1);
  const [multi, setMulti] = useState(false);
  /** one date per round — defaults run consecutively but any can be changed */
  const [dates, setDates] = useState<string[]>([new Date().toISOString().slice(0, 10)]);
  const [teeIds, setTeeIds] = useState<(string | null)[]>([null]);
  const [allow, setAllow] = useState(95);
  const [inField, setInField] = useState<Record<string, boolean>>({});
  const [pickPlayers, setPickPlayers] = useState(false);
  const [whyNoReg, setWhyNoReg] = useState(false);
  const [selfReg, setSelfReg] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: "", hcp: "" });

  const addNewPlayer = () => {
    if (!society || !newPlayer.name.trim()) return;
    actions.addPlayer(society.id, newPlayer.name.trim(), parseHandicap(newPlayer.hcp));
    setNewPlayer({ name: "", hcp: "" });
  };

  // sub-screens of the event wizard (each has its own back control)
  const [formatPicker, setFormatPicker] = useState(false);
  const [openFormat, setOpenFormat] = useState<ScoringFormat | null>(null);
  const [courseFor, setCourseFor] = useState<number | null>(null); // round index
  const [courseQ, setCourseQ] = useState("");
  const [teeCourse, setTeeCourse] = useState<Course | null>(null);
  const [newTee, setNewTee] = useState({ name: "White", par: "", cr: "", slope: "" });
  const [teeErr, setTeeErr] = useState<string | null>(null);

  // season fields
  const [endsOn, setEndsOn] = useState("2026-09-30");
  const [bestN, setBestN] = useState<number | "">(6);
  const [prize, setPrize] = useState("");

  const society =
    db.societies.find((x) => x.id === socId) ??
    (slugParam ? select.society(db, slugParam) : undefined);
  const players = society ? select.players(db, society.id) : [];
  const picked = players.filter((p) => inField[p.id] !== false);

  const nRounds = multi ? rounds : 1;
  const allSet = teeIds.slice(0, nRounds).every(Boolean);
  const firstTee = teeIds.find(Boolean) ?? undefined;
  const union = courseOfTee(firstTee ?? undefined)?.country;
  const allowed = allowancesFor(union);
  const allowance = allowed.includes(allow) ? allow : 95;

  const needsSocietyStep = kind !== "society" && kind !== null && !society;
  const TOTAL =
    kind === "society" ? 4 :
    kind === "season" ? (needsSocietyStep ? 3 : 2) :
    (needsSocietyStep ? 6 : 5);

  // which logical screen are we on?
  const screen: string = (() => {
    if (step === 0) return "type";
    if (kind === "society") return ["name", "identity", "roster", "confirm"][step - 1] ?? "confirm";
    let i = step;
    if (needsSocietyStep) { if (i === 1) return "pick-society"; i -= 1; }
    if (kind === "season") return ["name", "confirm"][i - 1] ?? "confirm";
    return ["name", "formats", "rounds", "course", "players"][i - 1] ?? "players";
  })();

  const addDays = (iso: string, n: number) => {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const setRoundCount = (n: number) => {
    const c = Math.max(2, Math.min(8, n));
    setRounds(c);
    setTeeIds((t) => Array.from({ length: Math.max(c, 1) }, (_, i) => t[i] ?? null));
    // new rounds default to the day after the last one — editable, not a rule
    setDates((d) => {
      const out = d.slice(0, c);
      while (out.length < c) out.push(addDays(out[out.length - 1], 1));
      return out;
    });
  };

  const setRosterAt = (i: number, patch: Partial<{ name: string; hcp: string }>) =>
    setRoster((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  /** Rows with a name become players; a blank handicap box is honest — null. */
  const parseRoster = () =>
    roster
      .filter((r) => r.name.trim())
      .map((r) => ({ name: r.name.trim(), hcp: parseHandicap(r.hcp) }));

  const create = () => {
    // One tap, one society. The button greys out immediately; if navigation
    // somehow fails it un-greys after a beat rather than letting a second tap
    // mint a duplicate.
    if (creating) return;
    setCreating(true);
    setTimeout(() => setCreating(false), 5000);
    if (kind === "society") {
      const soc = actions.createSociety(name.trim() || "My society", homeClub.trim() || undefined, {
        badge: crestData ? undefined : badge,
        crestData: crestData ?? undefined,
      });
      for (const r of parseRoster()) if (r.name) actions.addPlayer(soc.id, r.name, r.hcp);
      router.push(`/society?s=${soc.id}`);
      return;
    }
    if (!society) return;
    const finalName = name.trim() ||
      (kind === "season" ? `Order of Merit ${new Date().getFullYear()}` : `${society.name} day`);
    if (kind === "season") {
      actions.createSeason(society.id, {
        name: finalName, startsOn: playsOn, endsOn,
        bestN: bestN === "" ? null : Number(bestN),
        prize: prize.trim() || undefined,
      });
      router.push(`/society?s=${society.id}`);
      return;
    }
    // event — one createEvent per round; several rounds share a series board
    let first: string | null = null;
    for (let d = 0; d < nRounds; d++) {
      const teeId = teeIds[d]!;
      // England is fixed at 95% — a trip that crosses the border respects each day's union
      const dayAllowed = allowancesFor(courseOfTee(teeId)?.country);
      const ev = actions.createEvent(society.id, {
        name: nRounds > 1 ? `${finalName} — R${d + 1}` : finalName,
        playsOn: dates[d] ?? addDays(dates[0], d),
        teeId,
        format,
        handicapAllowance: dayAllowed.includes(allowance) ? allowance : 95,
        seriesName: nRounds > 1 ? finalName : undefined,
        playerIds: picked.map((p) => p.id),
        selfRegister: selfReg,
      });
      first ??= ev.id;
    }
    router.push(`/event?e=${first}`);
  };

  // One colour per thing you can make: green day, gold silverware, blue club.
  const kinds: { k: Kind; title: string; sub: string; ex: string; cta: string; color: string; icon: React.ReactNode }[] = [
    {
      k: "event", title: "Event", color: "var(--color-acid)",
      icon: <path d="M5 21V4M5 4c4-2 7 2 14 0v9c-7 2-10-2-14 0" />,
      sub: "A one-off — one round, or several rounds of competition.",
      ex: "The monthly meeting, or a 3-day trip on one combined board.",
      cta: "Create an event",
    },
    {
      k: "season", title: "Season", color: "var(--color-gold)",
      icon: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4a1 1 0 0 0-1 1c0 2.2 1.8 4 4 4M17 6h3a1 1 0 0 1 1 1c0 2.2-1.8 4-4 4" />,
      sub: "An Order of Merit across the months.",
      ex: "Best 6 cards count and the winner takes the jug.",
      cta: "Create a season",
    },
    {
      k: "society", title: "Society", color: "#5cc8ff",
      icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M16 14.6c3 .3 5.5 2 5.5 4.9" /></>,
      sub: "Your group — players, badge, identity.",
      ex: "Events and seasons live inside it.",
      cta: "Create a society",
    },
  ];

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

  /* -------------------------------------------------- step titles & help -- */

  const heads: Record<string, [string, string]> = {
    "pick-society": ["Which society?", "Days and seasons belong to a society, so scores count toward its records."],
    name:
      kind === "society" ? ["Name your society", "This fronts everything — boards, QR pages, the lot."] :
      kind === "season" ? ["Name your season", "How the standings will be titled all year."] :
      ["Name your event", "This is what players see when they join."],
    formats: ["Add scoring formats", "Choose how players compete. You can fine-tune the day's settings later."],
    rounds: ["How many rounds?", "Set up a single round or a multi-round event."],
    course: ["Choose a course", "Set a course for each round, or use the same course for every round."],
    players: ["Add players", "Add players yourself now, or do it later — turn-ups on the day are one tap."],
    identity: ["Pick your badge", "It fronts your society everywhere — home screen, boards, QR pages."],
    roster: ["Add your players", "A box for the name, a box for their exact handicap. You can add more any time."],
    confirm: ["Check it over", "Nothing here is set in stone — everything can be changed later."],
  };

  const chosen = FORMATS.find((x) => x.f === format)!;

  /* ------------------------------------------------------- sub-screens -- */

  if (formatPicker) {
    return (
      <Shell society={society}>
        <PickerHead onBack={() => setFormatPicker(false)} placeholder="Search formats"
                    q={courseQ} setQ={setCourseQ} />
        <div className="grid gap-2 rise">
          {FORMATS.filter((x) => x.name.toLowerCase().includes(courseQ.trim().toLowerCase())).map((x) => {
            const open = openFormat === x.f;
            return (
              <div key={x.f} className="card p-4">
                <button className="flex w-full items-center justify-between gap-3 text-left"
                        onClick={() => setOpenFormat(open ? null : x.f)}>
                  <span className="name text-[1rem]">
                    {x.name}
                    {x.f === "stableford" && <span className="label ml-2" style={{ color: "var(--color-acid)" }}>live hole-by-hole</span>}
                  </span>
                  <span className="label">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div className="mt-3 grid gap-3">
                    <p className="text-[0.85rem] leading-relaxed text-[var(--color-dim)]">{x.body}</p>
                    <p className="label !normal-case !tracking-normal"><b>Handicaps:</b> {x.hcp}</p>
                    <button className="btn btn-primary justify-self-end !min-h-[2.4rem]"
                            onClick={() => { setFormat(x.f); setFormatPicker(false); setCourseQ(""); }}>
                      Select
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  if (courseFor != null && teeCourse) {
    // Verified tees first, then any the organiser has added — a verified course
    // is often missing its Yellow or Red set, so adding is always allowed.
    const custom = customTeesFor(teeCourse.id);
    const tees = [
      ...teeCourse.tees,
      ...custom.filter((c) => !teeCourse.tees.some((t) => t.id === c.id)),
    ];
    const saveTee = () => {
      const par = Number(newTee.par), cr = Number(newTee.cr), slope = Number(newTee.slope);
      if (!par || par < 54 || par > 80) return setTeeErr("Par looks wrong — 54 to 80.");
      if (!cr || cr < 50 || cr > 90) return setTeeErr("Course Rating looks wrong — it's the decimal number, e.g. 71.9.");
      if (!slope || slope < 55 || slope > 155) return setTeeErr("Slope is 55–155.");
      const tee = actions.addTee(teeCourse.id, { name: newTee.name, par, cr, slope });
      setTeeIds((t) => t.map((x, i) => (i === courseFor ? tee.id : x)));
      setTeeErr(null); setCourseFor(null); setTeeCourse(null); setCourseQ("");
    };
    return (
      <Shell society={society}>
        <button className="label mb-4 block" onClick={() => setTeeCourse(null)}>‹ All courses</button>
        <h2 className="display text-[1.35rem]">{teeCourse.clubName ?? teeCourse.name}</h2>
        <p className="label mt-1 !normal-case !tracking-normal">{teeCourse.country}</p>
        <div className="mt-4 grid gap-2 rise">
          {tees.map((t) => (
            <button key={t.id} className="card flex items-center justify-between p-4 text-left"
              onClick={() => {
                setTeeIds((x) => x.map((v, i) => (i === courseFor ? t.id : v)));
                setCourseFor(null); setTeeCourse(null); setCourseQ("");
              }}>
              <span className="min-w-0">
                <span className="name flex items-center gap-2 text-[0.95rem]"><TeeDot name={t.name} /> {t.name} tees</span>
                <span className="label mt-0.5 block">par {t.par} · CR {t.cr} · slope {t.slope}{t.card ? " · full card ✓" : ""}</span>
              </span>
              <span className="label" style={{ color: "var(--color-acid)" }}>Select</span>
            </button>
          ))}
          {tees.length === 0 && (
            <p className="label !normal-case !tracking-normal">
              No tees entered for this course yet — be the first. The three numbers are on the club’s printed scorecard.
            </p>
          )}
          {
            <div className="card grid gap-3 p-4">
              <span className="label">
                {tees.length ? "Missing a set? Add a tee — off the printed scorecard" : "Add a tee — off the printed scorecard"}
              </span>
              <div className="flex flex-wrap gap-2">
                {TEE_NAMES.map((n) => (
                  <button key={n} type="button" className="btn flex items-center gap-1.5 !min-h-[2.2rem] !text-[0.8rem]"
                    style={newTee.name === n ? { background: "var(--color-acid)", color: "#06080a" }
                                             : { border: "1px solid var(--color-line)", color: "var(--color-text)" }}
                    onClick={() => setNewTee({ ...newTee, name: n })}><TeeDot name={n} /> {n}</button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label><span className="label mb-1 block">Par</span>
                  <input className="field num" inputMode="numeric" placeholder="72" value={newTee.par}
                         onChange={(e) => setNewTee({ ...newTee, par: e.target.value })} /></label>
                <label><span className="label mb-1 block">CR</span>
                  <input className="field num" inputMode="decimal" placeholder="71.9" value={newTee.cr}
                         onChange={(e) => setNewTee({ ...newTee, cr: e.target.value })} /></label>
                <label><span className="label mb-1 block">Slope</span>
                  <input className="field num" inputMode="numeric" placeholder="121" value={newTee.slope}
                         onChange={(e) => setNewTee({ ...newTee, slope: e.target.value })} /></label>
              </div>
              {teeErr && <p className="label !normal-case !tracking-normal" style={{ color: "#ff7a7a" }}>{teeErr}</p>}
              <button className="btn btn-primary !min-h-[2.4rem]" onClick={saveTee}>Save tee & use it</button>
              <p className="label !normal-case !tracking-normal">
                Handicaps come straight off these numbers, so copy them exactly. Enter the full
                hole-by-hole card later to unlock live scoring.
              </p>
            </div>
          }
        </div>
      </Shell>
    );
  }

  if (courseFor != null) {
    const results = searchCourses(courseQ, 30);
    return (
      <Shell society={society}>
        <PickerHead onBack={() => { setCourseFor(null); setCourseQ(""); }}
                    placeholder="Search every UK course" q={courseQ} setQ={setCourseQ} autoFocus />
        <div className="grid gap-2 rise">
          {!courseQ.trim() && (
            <p className="label !normal-case !tracking-normal">
              Every UK course is in here — {UK_DIRECTORY.length.toLocaleString("en-GB")} across
              England, Scotland, Wales and Northern Ireland. Type your club’s name to find it.
              The {COURSES.length} below ship with verified scorecards.
            </p>
          )}
          {results.map((c) => (
            <button key={c.id} className="card flex items-center justify-between p-4 text-left"
                    onClick={() => { setTeeCourse(c); setOpenFormat(null); }}>
              <span className="min-w-0">
                <span className="name block truncate text-[0.95rem]">{c.name}</span>
                <span className="label mt-0.5 block">
                  {[c.county, c.country].filter(Boolean).join(" · ")}
                  {c.tees.some((t) => t.card) ? " · verified card ✓" : ""}
                </span>
              </span>
              <span className="label">›</span>
            </button>
          ))}
          {results.length === 0 && (
            <p className="label px-1 py-6 text-center !normal-case !tracking-normal">
              Nothing by that name — try part of the club’s name.
            </p>
          )}
        </div>
      </Shell>
    );
  }

  /* ------------------------------------------------------- main wizard -- */

  return (
    <Shell society={society}>
      <section className="py-7">
        <p className="label">{step === 0 ? "Get started" : `Step ${step} of ${TOTAL}`}</p>
        <h1 className="display mt-2 text-[clamp(1.5rem,5vw,2rem)]">
          {step === 0 ? "Let’s set it up properly." : heads[screen]?.[0]}
        </h1>
        {step > 0 && (
          <>
            <Steps step={step} total={TOTAL} />
            {heads[screen] && (
              <p className="mt-3 text-[0.9rem] leading-relaxed text-[var(--color-dim)]">{heads[screen][1]}</p>
            )}
            {/* never silently assume the society — say it, and let it be changed */}
            {kind !== "society" && society && (
              <p className="label mt-2 !normal-case !tracking-normal">
                For <span className="text-[var(--color-text)]">{society.name}</span> ·{" "}
                <button className="underline underline-offset-2" style={{ color: "#5cc8ff" }}
                        onClick={() => { setSocId(null); router.replace("/new-day"); setStep(1); }}>
                  change
                </button>
              </p>
            )}
          </>
        )}
      </section>

      {screen === "type" && (
        <div className="grid gap-3">
          {kinds.map(({ k, title, sub, ex, cta, color, icon }, i) => (
            <button
              key={k}
              className="card rise min-w-0 p-4 text-left transition-transform hover:-translate-y-0.5"
              style={{
                animationDelay: `${i * 70}ms`,
                borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
                background: `linear-gradient(135deg, color-mix(in srgb, ${color} 9%, transparent), transparent 55%)`,
              }}
              onClick={() => { setKind(k); setStep(1); }}
            >
              <span className="flex items-center gap-3.5">
                <span
                  aria-hidden
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
                  style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
                >
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="name block text-[1.1rem]" style={{ color }}>{title}</span>
                  <span className="mt-0.5 block text-[0.85rem] leading-snug">{sub}</span>
                </span>
              </span>
              <span className="mt-2.5 flex items-baseline justify-between gap-3 border-t pt-2.5"
                    style={{ borderColor: `color-mix(in srgb, ${color} 18%, transparent)` }}>
                <span className="line-clamp-2 min-w-0 flex-1 text-[0.78rem] leading-snug text-[var(--color-dim)]">{ex}</span>
                <span className="label shrink-0" style={{ color }}>{cta} ›</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {screen === "pick-society" && (
        <div className="grid gap-2 rise">
          {db.societies.map((s) => (
            <button key={s.id} className="card flex items-center justify-between p-4 text-left"
                    onClick={() => { setSocId(s.id); setStep(step + 1); }}>
              <span className="name text-[1rem]">{s.name}</span>
              <span className="label">{select.players(db, s.id).length} players</span>
            </button>
          ))}
          {/* never trap the organiser in an existing society — a fresh group
              is always one tap away, even when others already exist */}
          <button className="card p-4 text-left" style={{ borderStyle: "dashed" }}
                  onClick={() => { setKind("society"); setStep(1); }}>
            <span className="name text-[1rem]" style={{ color: "#5cc8ff" }}>
              {db.societies.length === 0 ? "No societies yet — set one up first ›" : "+ A new society"}
            </span>
          </button>
        </div>
      )}

      {screen === "name" && (
        <div className="card grid gap-4 p-4 rise">
          <label>
            <input className="field" autoFocus
                   placeholder={kind === "society" ? "Weekend Dogs" : kind === "season" ? `Order of Merit ${new Date().getFullYear()}` : "August Meeting"}
                   value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {kind === "society" && (
            <label>
              <span className="label mb-1.5 block">Home club (optional)</span>
              <input className="field" placeholder="Conwy" value={homeClub}
                     onChange={(e) => setHomeClub(e.target.value)} />
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
                <input className="field num !w-[9rem]" type="number" min={1} max={30} value={bestN}
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

      {screen === "formats" && (
        <button className="card flex w-full items-center gap-4 p-4 text-left rise"
                onClick={() => { setFormatPicker(true); setOpenFormat(format); setCourseQ(""); }}>
          <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
                style={{ background: "color-mix(in srgb, var(--color-acid) 14%, transparent)", color: "var(--color-acid)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
              <path d="M7 6H4a1 1 0 0 0-1 1c0 2.2 1.8 4 4 4M17 6h3a1 1 0 0 1 1 1c0 2.2-1.8 4-4 4" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="name block text-[1rem]">{chosen.name}</span>
            <span className="label mt-1 block !normal-case !tracking-normal">
              {format === "stableford"
                ? "The default. Tap to pick how scores are tracked — you can also do this later."
                : chosen.hcp}
            </span>
          </span>
          <span className="label">›</span>
        </button>
      )}

      {screen === "rounds" && (
        <div className="grid gap-3 rise">
          <button className="card flex items-center gap-4 p-4 text-left"
                  style={!multi ? { outline: "2px solid var(--color-acid)" } : undefined}
                  onClick={() => setMulti(false)}>
            <span className="min-w-0 flex-1">
              <span className="name block text-[1rem]">One round</span>
              <span className="label mt-0.5 block !normal-case !tracking-normal">A single day of play.</span>
            </span>
            <Check on={!multi} />
          </button>
          <div className="card p-4" style={multi ? { outline: "2px solid var(--color-acid)" } : undefined}>
            <button className="flex w-full items-center gap-4 text-left"
                    onClick={() => { setMulti(true); if (rounds < 2) setRoundCount(2); }}>
              <span className="min-w-0 flex-1">
                <span className="name block text-[1rem]">Multiple rounds</span>
                <span className="label mt-0.5 block !normal-case !tracking-normal">
                  {multi ? `${rounds} rounds, one combined board — R1 · R2 · R3.` : "Several rounds, like a weekend trip."}
                </span>
              </span>
              <Check on={multi} />
            </button>
            {multi && (
              <div className="mt-4 flex items-center justify-between border-t border-[var(--line-soft)] pt-3">
                <span className="text-[0.9rem]">Number of rounds</span>
                <div className="flex items-center gap-3">
                  <button className="btn !min-h-[2.3rem] !min-w-[2.6rem]" style={{ border: "1px solid var(--color-line)" }}
                          onClick={() => setRoundCount(rounds - 1)}>−</button>
                  <span className="num text-[1.1rem]">{rounds}</span>
                  <button className="btn !min-h-[2.3rem] !min-w-[2.6rem]" style={{ border: "1px solid var(--color-line)" }}
                          onClick={() => setRoundCount(rounds + 1)}>+</button>
                </div>
              </div>
            )}
          </div>
          {!multi ? (
            <label className="card grid gap-1.5 p-4">
              <span className="label">When is it?</span>
              <input className="field" type="date" value={dates[0]}
                     onChange={(e) => setDates((d) => [e.target.value, ...d.slice(1)])} />
            </label>
          ) : (
            <div className="card grid gap-3 p-4">
              <span className="label">When is each round? Any dates — same week or spread across the month.</span>
              {Array.from({ length: rounds }, (_, i) => (
                <label key={i} className="flex items-center justify-between gap-3">
                  <span className="text-[0.9rem]">Round {i + 1}</span>
                  <input className="field !w-[11rem]" type="date" value={dates[i] ?? ""}
                         onChange={(e) => setDates((d) => d.map((x, j) => (j === i ? e.target.value : x)))} />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {screen === "course" && (
        <div className="grid gap-3 rise">
          {Array.from({ length: nRounds }, (_, i) => {
            const tee = teeById(teeIds[i] ?? undefined);
            const crs = courseOfTee(teeIds[i] ?? undefined);
            return (
              <button key={i} className="card flex items-center gap-4 p-4 text-left"
                      onClick={() => { setCourseFor(i); setCourseQ(""); setTeeCourse(null); setNewTee({ name: "White", par: "", cr: "", slope: "" }); }}>
                <span className="min-w-0 flex-1">
                  <span className="name block text-[1rem]">{nRounds > 1 ? `Round ${i + 1}` : "Course"}</span>
                  <span className="label mt-0.5 flex items-center gap-1.5 !normal-case !tracking-normal">
                    {tee && crs
                      ? <><TeeDot name={tee.name} /> {crs.name} — {tee.name} (par {tee.par})</>
                      : "No course set"}
                  </span>
                </span>
                <span className="label" style={{ color: "var(--color-acid)" }}>{tee ? "Change" : "Add"}</span>
              </button>
            );
          })}
          {nRounds > 1 && teeIds[0] && !allSet && (
            <button className="label text-left !normal-case !tracking-normal" style={{ color: "var(--color-acid)" }}
                    onClick={() => setTeeIds((t) => t.map(() => t[0]))}>
              ✓ Use the same course for every round
            </button>
          )}
          {firstTee && (
            <label className="card grid gap-1.5 p-4">
              <span className="label">Handicap allowance</span>
              <select className="field" value={allowance} disabled={allowed.length === 1}
                      onChange={(e) => setAllow(Number(e.target.value))}>
                {allowed.map((a) => <option key={a} value={a}>{a}%{a === 95 ? " — WHS default" : ""}</option>)}
              </select>
              <span className="label !normal-case !tracking-normal">
                {union === "England" ? "Fixed at 95% in England until 2028."
                  : `${union} allows 85–100% for singles since April 2026.`}
              </span>
            </label>
          )}
        </div>
      )}

      {screen === "players" && (
        <div className="grid gap-3 rise">
          <div className="card p-4">
            <button className="flex w-full items-center gap-4 text-left" onClick={() => setPickPlayers(!pickPlayers)}>
              <span className="min-w-0 flex-1">
                <span className="name block text-[1rem]">Add players yourself</span>
                <span className="label mt-0.5 block !normal-case !tracking-normal">
                  Pick people to add to the field now — {picked.length} of {players.length} in.
                </span>
              </span>
              <span className="label">{pickPlayers ? "▲" : "›"}</span>
            </button>
            {pickPlayers && (
              <div className="mt-3 grid gap-1.5 border-t border-[var(--line-soft)] pt-3">
                {players.map((p) => {
                  const on = inField[p.id] !== false;
                  return (
                    <button key={p.id}
                      className="flex items-center justify-between gap-3 rounded-[10px] border px-3 py-2.5 text-left"
                      style={{ borderColor: on ? "var(--color-acid)" : "var(--color-line)", opacity: on ? 1 : 0.55 }}
                      onClick={() => setInField({ ...inField, [p.id]: !on })}>
                      <span className="text-[0.9rem]">{p.name} <span className="label ml-1">{formatHandicap(p.handicapIndex)}</span></span>
                      <span className="label">{on ? "In" : "Out"}</span>
                    </button>
                  );
                })}
                {players.length === 0 && (
                  <p className="label !normal-case !tracking-normal">
                    This society has no players yet — add your first below.
                  </p>
                )}
                {/* new faces join right here — no trip to the society page first */}
                <div className="mt-2 grid gap-2 border-t border-[var(--line-soft)] pt-3">
                  <div className="flex gap-2">
                    <span className="label min-w-0 flex-1">Name</span>
                    <span className="label !w-[5.6rem] text-center">Handicap</span>
                    <span className="w-[4rem]" aria-hidden />
                  </div>
                  {/* !w — the .field rule's width:100% outguns a plain Tailwind
                      width, which was letting the HCP box swallow the row */}
                  <div className="flex gap-2">
                    <input className="field min-w-0 flex-1" placeholder="New player's name" value={newPlayer.name}
                           onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                           onKeyDown={(e) => { if (e.key === "Enter") addNewPlayer(); }} />
                    <input className="field num !w-[5.6rem] text-center" placeholder="12.4" inputMode="decimal" value={newPlayer.hcp}
                           onChange={(e) => setNewPlayer({ ...newPlayer, hcp: e.target.value })}
                           onKeyDown={(e) => { if (e.key === "Enter") addNewPlayer(); }} />
                    <button className="btn btn-primary !min-h-[3rem] w-[4rem] !px-0 !text-[0.8rem]"
                            disabled={!newPlayer.name.trim()} onClick={addNewPlayer}>Add</button>
                  </div>
                </div>
                <p className="label !normal-case !tracking-normal">
                  Use their <b>exact handicap index</b> — “12.4”, not “12”. Added straight into this
                  society’s roster, and into today’s field.
                </p>
              </div>
            )}
          </div>
          <div className="card p-4">
            {IS_REMOTE ? (
              <>
                <button className="flex w-full items-center gap-4 text-left" role="switch" aria-checked={selfReg}
                        onClick={() => setSelfReg(!selfReg)}>
                  <span className="min-w-0 flex-1">
                    <span className="name block text-[1rem]">Let players register themselves</span>
                    <span className="label mt-0.5 block !normal-case !tracking-normal">
                      A link and QR go on the event page — anyone with it puts themselves in the field.
                    </span>
                  </span>
                  <span aria-hidden className="h-6 w-11 shrink-0 rounded-full border p-0.5 transition-colors"
                        style={{ borderColor: selfReg ? "var(--color-acid)" : "var(--color-line)",
                                 background: selfReg ? "color-mix(in srgb, var(--color-acid) 25%, transparent)" : "transparent" }}>
                    <span className="block h-full w-5 rounded-full transition-transform"
                          style={{ background: selfReg ? "var(--color-acid)" : "var(--color-line)",
                                   transform: selfReg ? "translateX(1.1rem)" : "none" }} />
                  </span>
                </button>
                {selfReg && (
                  <p className="label mt-3 border-t border-[var(--line-soft)] pt-3 !normal-case !tracking-normal">
                    Their handicap is frozen into a playing handicap the moment they register, same
                    as if you’d added them. You can still add or remove anyone yourself.
                  </p>
                )}
              </>
            ) : (
              <>
                <button className="flex w-full items-center gap-4 text-left" aria-expanded={whyNoReg}
                        onClick={() => setWhyNoReg(!whyNoReg)}>
                  <span className="min-w-0 flex-1" style={{ opacity: 0.6 }}>
                    <span className="name block text-[1rem]">Let players register themselves</span>
                    <span className="label mt-0.5 block !normal-case !tracking-normal">
                      Share a link and code so players can join on their own.
                    </span>
                  </span>
                  <span aria-hidden className="h-6 w-11 shrink-0 rounded-full border border-[var(--color-line)] p-0.5 opacity-60">
                    <span className="block h-full w-5 rounded-full bg-[var(--color-line)]" />
                  </span>
                </button>
                {whyNoReg && (
                  <p className="label mt-3 border-t border-[var(--line-soft)] pt-3 !normal-case !tracking-normal">
                    Not in the on-device demo — a player registering on their own phone would have
                    nowhere to send the entry. On the live app this switch is on.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {screen === "identity" && (
        <div className="card grid gap-4 p-4 rise">
          <div>
            <span className="label mb-2 block">Pick a badge</span>
            <div className="grid grid-cols-4 gap-2">
              {BADGES.map((b) => (
                <button key={b} type="button" aria-label={b}
                  className="grid place-items-center rounded-[16px] p-0.5"
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
        </div>
      )}

      {screen === "roster" && (
        <div className="card grid gap-3 p-4 rise">
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <span className="label flex-1">Player name</span>
              <span className="label w-[5.6rem] text-center">Handicap</span>
              <span className="w-[1.4rem]" aria-hidden />
            </div>
            {roster.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="field min-w-0 flex-1" placeholder={i === 0 ? "Dave Prichard" : "Name"}
                       value={r.name} onChange={(e) => setRosterAt(i, { name: e.target.value })} />
                <input className="field num !w-[5.6rem] text-center" placeholder="12.4" inputMode="decimal"
                       value={r.hcp} onChange={(e) => setRosterAt(i, { hcp: e.target.value })} />
                <button type="button"
                        className="w-[1.4rem] shrink-0 text-center text-[1.1rem] leading-none text-[var(--color-line)] hover:text-[var(--color-live)]"
                        style={{ visibility: roster.length > 1 ? "visible" : "hidden" }}
                        aria-label={`Remove row ${i + 1}`}
                        onClick={() => setRoster((rs) => rs.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost !min-h-[2.4rem] justify-self-start !text-[0.8rem]"
                  onClick={() => setRoster((rs) => [...rs, { name: "", hcp: "" }])}>
            + Add another player
          </button>
          <p className="label !normal-case !tracking-normal">
            Use each player’s <b>exact handicap index</b> — “12.4”, not “12”. Plus golfers with a
            plus: “+1.6”. No handicap yet? Leave the box blank. You can skip this and add players
            any time.
          </p>
          {parseRoster().length > 0 && (
            <p className="label" style={{ color: "var(--color-acid)" }}>
              {parseRoster().length} player{parseRoster().length === 1 ? "" : "s"} ready
              {parseRoster().some((r) => r.hcp != null) &&
                ` · e.g. ${parseRoster()[0].name} HCP ${formatHandicap(parseRoster()[0].hcp)}`}
            </p>
          )}
        </div>
      )}

      {screen === "confirm" && (
        <div className="card grid gap-3 p-4 rise">
          <Row k="Setting up" v={kinds.find((x) => x.k === kind)?.title ?? ""} />
          <Row k="Name" v={name.trim() || "My society"} />
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
        </div>
      )}

      {step > 0 && (
        <div className="mt-5 flex items-center gap-2">
          <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>‹ Back</button>
          {(screen === "formats" || screen === "roster") && (
            <button className="btn btn-ghost flex-1" onClick={() => setStep(step + 1)}>Skip for now</button>
          )}
          {step < TOTAL ? (
            <button className="btn btn-primary flex-1" onClick={() => setStep(step + 1)}
                    disabled={
                      screen === "pick-society" ||
                      (screen === "name" && kind === "event" && !name.trim()) ||
                      (screen === "course" && !allSet)
                    }>
              Continue
            </button>
          ) : (
            <button className="btn btn-primary flex-1" onClick={create}
                    disabled={creating || (kind === "event" && !allSet)}>
              {creating ? "Creating…" :
               kind === "society" ? "Create the society" :
               kind === "season" ? "Start the season" : "Create event"}
            </button>
          )}
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------ chrome bits -- */

function Shell({ society, children }: { society?: { id: string; slug: string; name: string }; children: React.ReactNode }) {
  return (
    <>
      <Header back={society ? { href: `/society?s=${society.id}`, label: society.name } : { href: "/", label: "Home" }} />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-16">{children}</main>
    </>
  );
}

/** Squabbit-style numbered progress: done ✓ · active filled · upcoming hollow. */
function Steps({ step, total }: { step: number; total: number }) {
  return (
    <div className="mt-4 flex items-center">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < step, active = n === step;
        return (
          <span key={n} className="flex items-center" style={{ flex: n === 1 ? "0 0 auto" : "1 1 0" }}>
            {n > 1 && (
              <span className="mx-1 h-[2px] flex-1 rounded-full"
                    style={{ background: done || active ? "var(--color-acid)" : "var(--color-line)" }} />
            )}
            <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.8rem]"
                  style={done
                    ? { background: "var(--color-acid)", color: "#06080a" }
                    : active
                      ? { border: "2px solid var(--color-acid)", color: "var(--color-acid)" }
                      : { border: "1px solid var(--color-line)", color: "var(--color-dim)" }}>
              {done ? "✓" : n}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.75rem]"
          style={on ? { background: "var(--color-acid)", color: "#06080a" }
                    : { border: "1.5px solid var(--color-line)" }}>
      {on ? "✓" : ""}
    </span>
  );
}

function PickerHead({ onBack, q, setQ, placeholder, autoFocus }: {
  onBack: () => void; q: string; setQ: (s: string) => void; placeholder: string; autoFocus?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-5">
      <button className="btn btn-ghost !min-h-[2.6rem] !px-3" onClick={onBack} aria-label="Back">‹</button>
      <input className="field flex-1" placeholder={placeholder} value={q} autoFocus={autoFocus}
             onChange={(e) => setQ(e.target.value)} />
    </div>
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

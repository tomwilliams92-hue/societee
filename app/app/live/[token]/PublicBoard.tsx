"use client";

import { useEffect, useState } from "react";
import { Crest } from "@/components/Crest";
import { useDB, select } from "@/lib/store";
import { formatPlayingHandicap, ordinal, rank } from "@/lib/scoring";
import { courseById } from "@/lib/courses";

/**
 * The QR-code destination. No login, no account, no download — this is the
 * whole adoption story, so it gets the full honours-board treatment rather
 * than a stripped-back "public view".
 */
export function PublicBoard({ token }: { token: string }) {
  const db = useDB();
  const ev = select.eventByToken(db, token);
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  if (!ev) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-center">
        <div>
          <Crest size={54} />
          <h1 className="engraved mt-4 text-2xl">That board isn’t live</h1>
          <p className="mt-2 text-[var(--color-ink-soft)]">
            The link may have expired, or the day hasn’t started yet.
          </p>
        </div>
      </main>
    );
  }

  const society = db.societies.find((s) => s.id === ev.societyId)!;
  const course = courseById(ev.courseId);
  const entries = select.entries(db, ev.id);
  const rounds = select.roundsForEvent(db, ev.id);
  const sideComps = select.sideComps(db, ev.id);

  const rows = rank(
    entries.map((en) => {
      const player = db.players.find((p) => p.id === en.playerId)!;
      const round = rounds.find((r) => r.playerId === en.playerId);
      return { en, player, points: round?.stableford ?? null, gross: round?.gross ?? null };
    }),
    (r) => r.points
  );

  const inCount = rounds.length;

  return (
    <main
      className="flex-1 px-4 py-8 sm:py-12"
      style={{
        background:
          "radial-gradient(ellipse 70rem 34rem at 50% 0%, #14523c 0%, #0b3d2c 42%, #06251a 100%)",
      }}
    >
      <div className="mx-auto w-full max-w-2xl">
        {/* ------------------------------------------------------ head -- */}
        <header className="rise text-center">
          <Crest size={52} />
          <p
            className="label mt-4"
            style={{ color: "rgba(192,154,62,.85)" }}
          >
            {society.name}
          </p>
          <h1
            className="display mt-2 text-[clamp(2rem,7vw,3rem)]"
            style={{ color: "#f2ecda" }}
          >
            {ev.name}
          </h1>
          <p className="mt-3 text-[0.9rem]" style={{ color: "rgba(234,227,207,.6)" }}>
            {course?.clubName ?? ""} · {fmtDate(ev.playsOn)}
          </p>

          <div className="mt-5 flex items-center justify-center gap-5">
            {ev.status === "live" && (
              <span className="chip chip-live" style={{ background: "rgba(168,50,42,.16)" }}>
                <span className="pulse" /> Live
              </span>
            )}
            <span className="label" style={{ color: "rgba(234,227,207,.55)" }}>
              {inCount} of {entries.length} in{now && ` · ${now}`}
            </span>
          </div>
        </header>

        {/* ----------------------------------------------- the board ★ -- */}
        <div
          className="mt-9 rise"
          style={{
            animationDelay: "120ms",
            border: "1px solid var(--brass-rule)",
            borderRadius: "4px",
            padding: "clamp(1rem,4vw,1.75rem)",
            background: "rgba(6,37,26,.42)",
            boxShadow: "0 24px 60px -30px rgba(0,0,0,.8)",
          }}
        >
          <div
            className="mb-4 flex items-end justify-between border-b pb-3"
            style={{ borderColor: "var(--brass-rule)" }}
          >
            <h2 className="engraved text-[1.1rem]" style={{ color: "var(--color-brass-lift)" }}>
              Stableford
            </h2>
            <span className="label" style={{ color: "rgba(192,154,62,.75)", fontSize: "0.62rem" }}>
              points
            </span>
          </div>

          {rows.map((r, i) => (
            <div
              key={r.en.id}
              className={`board-row rise${r.position === 1 && r.points != null ? " lead" : ""}`}
              style={{ animationDelay: `${160 + Math.min(i, 16) * 40}ms` }}
            >
              <span className="pos">
                {r.points == null ? "—" : `${ordinal(r.position)}${r.tied ? "=" : ""}`}
              </span>
              <span className="min-w-0">
                <span className="nm block truncate">{r.player.name}</span>
                <span
                  className="mt-0.5 block text-[0.7rem] tracking-wide"
                  style={{ color: "rgba(234,227,207,.5)" }}
                >
                  {r.points == null
                    ? `still out · off ${formatPlayingHandicap(r.en.playingHandicap)}`
                    : `${r.gross} gross · off ${formatPlayingHandicap(r.en.playingHandicap)}`}
                </span>
              </span>
              <span className="pts">{r.points ?? "–"}</span>
            </div>
          ))}
        </div>

        {/* ------------------------------------------------- side comps -- */}
        {sideComps.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {sideComps.map((sc, i) => {
              const winner = db.players.find((p) => p.id === sc.winnerId);
              return (
                <div
                  key={sc.id}
                  className="rise p-4"
                  style={{
                    animationDelay: `${340 + i * 60}ms`,
                    border: "1px solid rgba(192,154,62,.28)",
                    borderRadius: "3px",
                    background: "rgba(6,37,26,.35)",
                  }}
                >
                  <p className="label" style={{ color: "rgba(192,154,62,.8)" }}>
                    {sc.kind === "ntp" ? "Nearest the pin" : "Longest drive"}
                    {sc.hole ? ` · hole ${sc.hole}` : ""}
                  </p>
                  <p className="engraved mt-1.5 text-[1.1rem]" style={{ color: "#eae3cf" }}>
                    {winner?.name ?? "Not won"}
                  </p>
                  {sc.detail && (
                    <p className="num mt-0.5 text-[0.82rem]" style={{ color: "rgba(234,227,207,.6)" }}>
                      {sc.detail}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <footer className="mt-10 text-center">
          <p className="label" style={{ color: "rgba(234,227,207,.4)" }}>
            Powered by Societee
          </p>
        </footer>
      </div>
    </main>
  );
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

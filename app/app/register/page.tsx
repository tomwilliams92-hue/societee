"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Crest } from "@/components/Crest";
import { parseHandicap } from "@/lib/scoring";
import { IS_REMOTE } from "@/lib/supabase/config";
import { supabase } from "@/lib/supabase/client";

/**
 * The self-registration form — a player with the event's link puts themselves
 * in the field from their own phone. No account, no app: name, handicap, done.
 * The server freezes their playing handicap on entry, exactly as the organiser
 * adding them would have.
 */
function RegisterInner() {
  const token = useSearchParams().get("e") ?? "";
  const [info, setInfo] = useState<{ name: string; plays_on: string; society: string; course: string | null; open: boolean } | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "done" | "error">("loading");
  const [name, setName] = useState("");
  const [hcp, setHcp] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ player: string; playing_handicap: number | null } | null>(null);

  useEffect(() => {
    if (!IS_REMOTE || !token) { setState("missing"); return; }
    const sb = supabase()!;
    void sb.rpc("register_info", { token }).then(({ data, error }: { data: unknown; error: unknown }) => {
      if (error || !data) { setState("missing"); return; }
      setInfo(data as never);
      setState("ok");
    });
  }, [token]);

  const submit = async () => {
    setBusy(true); setErr(null);
    const sb = supabase()!;
    const { data, error } = await sb.rpc("register_player", {
      token, p_name: name.trim(), p_hcp: parseHandicap(hcp),
    });
    setBusy(false);
    if (error) { setErr(error.message.replace(/^.*: /, "")); return; }
    setResult(data as never);
    setState("done");
  };

  return (
    <main className="safe-top mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10">
      <header className="flex items-center gap-2.5 py-5">
        <Crest size={24} />
        <span className="label">Societee · registration</span>
      </header>

      {state === "loading" && <p className="label mt-10 text-center">One moment…</p>}

      {state === "missing" && (
        <div className="mt-10 text-center">
          <h1 className="display text-2xl">Nothing to register for</h1>
          <p className="label mt-2 !normal-case !tracking-normal">
            The link may be wrong, or registration for this event has closed.
          </p>
        </div>
      )}

      {state === "ok" && info && (
        <>
          <h1 className="display text-[1.6rem]">{info.name}</h1>
          <p className="label mt-1.5">
            {info.society}{info.course ? ` · ${info.course}` : ""} ·{" "}
            {new Date(info.plays_on + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </p>

          {!info.open ? (
            <p className="card mt-6 p-5 text-center text-[var(--color-dim)]">
              Registration for this event has closed. Speak to the organiser — a turn-up on the
              day is one tap for them.
            </p>
          ) : (
            <div className="card mt-6 grid gap-4 p-5">
              <label className="grid gap-1.5">
                <span className="label">Your name</span>
                <input className="field" autoComplete="name" value={name}
                       onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="grid gap-1.5">
                <span className="label">Handicap index — “+1.3” for plus golfers</span>
                <input className="field num" inputMode="decimal" placeholder="12.4" value={hcp}
                       onChange={(e) => setHcp(e.target.value)} />
              </label>
              {err && <p className="label !normal-case !tracking-normal" style={{ color: "#ff7a7a" }}>{err}</p>}
              <button className="btn btn-primary" disabled={busy || name.trim().length < 2}
                      onClick={() => void submit()}>
                {busy ? "Adding you…" : "Put me in the field"}
              </button>
              <p className="label !normal-case !tracking-normal">
                Your playing handicap is worked out and frozen the moment you register — the same
                arithmetic the organiser’s app uses, done on the server.
              </p>
            </div>
          )}
        </>
      )}

      {state === "done" && result && (
        <div className="mt-10 text-center">
          <h1 className="display text-2xl" style={{ color: "var(--color-acid)" }}>You’re in</h1>
          <p className="mt-3 text-[0.95rem]">
            {result.player}
            {result.playing_handicap != null && (
              <> · playing handicap <span className="num">{result.playing_handicap}</span></>
            )}
          </p>
          <p className="label mt-2 !normal-case !tracking-normal">
            See you on the first tee. The organiser has you on the sheet already.
          </p>
          <Link href={`/live-board?b=${token}`} className="btn btn-primary mt-6 inline-flex">
            Watch the board
          </Link>
        </div>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <RegisterInner />
    </Suspense>
  );
}

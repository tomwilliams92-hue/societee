"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import { IS_REMOTE } from "@/lib/supabase/config";
import { signIn, signUp, useSync } from "@/lib/supabase/sync";
import { actions, useReady } from "@/lib/store";
import { CourseScene } from "./CourseScene";
import { Crest, Wordmark } from "./Crest";

/**
 * The front door. In remote mode the organiser signs in before the app opens —
 * the session is saved on the phone, so this shows once, not every launch.
 * Two explicit screens, the way every other app does it: Sign in, or Create
 * account (name + email + password), with links between them.
 *
 * The guest promise is untouched: /live-board and /scorecard are token routes a
 * QR code opens, and players never need an account to appear on a card. Only
 * the organiser screens live behind the door.
 */
const OPEN_ROUTES = ["/live-board", "/scorecard", "/register"];

function AuthGateInner({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const sync = useSync();
  const ready = useReady();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!IS_REMOTE || OPEN_ROUTES.some((r) => path.startsWith(r))) return <>{children}</>;
  // Pre-mount the server HTML and the first client render must agree (see
  // useReady) — auth state can already have resolved by the time this
  // hydrates, so branching on it here would tear the hydration.
  if (!ready) return null;
  if (sync.email) return <>{children}</>;
  // Session still being restored from the phone — a blank beat, not a flash of
  // the sign-in form at someone who is already signed in.
  if (!sync.known) return null;

  const signup = mode === "signup";
  const canSubmit = !busy && email.trim() && pw.length >= 8 && (!signup || name.trim());

  const submit = () => {
    setBusy(true); setMsg(null);
    if (signup) {
      // The name seeds the local profile so the greeting knows who you are the
      // moment you land; handicap and the rest live in Profile.
      void signUp(email.trim(), pw).then((err) => {
        setBusy(false);
        if (err) { setMsg(err); return; }
        actions.setMe({ name: name.trim(), handicapIndex: null });
      });
    } else {
      void signIn(email.trim(), pw).then((err) => { setBusy(false); setMsg(err); });
    }
  };

  const switchMode = (m: "signin" | "signup") => { setMode(m); setMsg(null); };

  return (
    <div className="relative flex-1">
      <div className="relative overflow-hidden">
        <CourseScene />
        <div className="relative mx-auto w-full max-w-lg px-4 pb-4 pt-28">
          <div className="flex items-center gap-2.5">
            <Crest size={30} />
            <Wordmark className="!text-[1.35rem]" />
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-lg px-4 pb-16">
        <h1 className="display mt-2 text-[clamp(1.6rem,6vw,2.1rem)]">
          {signup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="label mt-2 !normal-case !tracking-normal">
          {signup
            ? "One account runs all your societies, on every device."
            : "Sign in to run your societies. You stay signed in on this phone."}
        </p>

        <form
          className="card mt-5 grid gap-3 p-4"
          onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
          {signup && (
            <label className="grid gap-1.5">
              <span className="label">Your name</span>
              <input className="field" type="text" autoComplete="name" required
                     placeholder="e.g. Tom Williams"
                     value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <label className="grid gap-1.5">
            <span className="label">Email</span>
            <input className="field" type="email" autoComplete="email" required
                   value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="grid gap-1.5">
            <span className="label">Password</span>
            <input className="field" type="password" required minLength={8}
                   autoComplete={signup ? "new-password" : "current-password"}
                   placeholder={signup ? "At least 8 characters" : undefined}
                   value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          {msg && <p className="label !normal-case !tracking-normal" style={{ color: "#ff7a7a" }}>{msg}</p>}
          <button className="btn btn-primary" disabled={!canSubmit}>
            {busy ? (signup ? "Creating account…" : "Signing in…")
                  : (signup ? "Create account" : "Sign in")}
          </button>
        </form>

        <p className="label mt-5 text-center !normal-case !tracking-normal">
          {signup ? "Already have an account? " : "New to Societee? "}
          <button
            type="button"
            className="underline underline-offset-4"
            style={{ color: "var(--color-acid)" }}
            onClick={() => switchMode(signup ? "signin" : "signup")}
          >
            {signup ? "Sign in" : "Create an account"}
          </button>
        </p>

        <p className="label mt-6 !normal-case !tracking-normal">
          Joining somebody else&rsquo;s day? You don&rsquo;t need an account — open the link or
          scan the QR code you were sent and you&rsquo;re straight in.
        </p>
      </main>
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  // usePathname needs a Suspense boundary in static export
  return <Suspense fallback={null}>{<AuthGateInner>{children}</AuthGateInner>}</Suspense>;
}

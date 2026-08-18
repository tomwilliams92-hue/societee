"use client";

import { useState } from "react";

/**
 * The guard in front of every delete. Two locks, deliberately:
 *   1. It lists exactly what is about to be lost — counts, not vibes.
 *   2. The organiser types the thing's NAME before the red button arms.
 * A browser confirm() is one accidental tap; this is a decision.
 */
export function ConfirmDelete({
  what,
  name,
  loses,
  onConfirm,
  onClose,
}: {
  /** "society" / "event" / "season" — used in the copy */
  what: string;
  /** the exact name that must be typed to arm the button */
  name: string;
  /** what goes with it — e.g. ["5 events", "12 players", "43 cards"] */
  loses: string[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const armed = typed.trim().toLowerCase() === name.trim().toLowerCase();

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-label={`Delete ${what} ${name}`}>
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="display text-[1.2rem]" style={{ color: "var(--color-live)" }}>
          Delete this {what}?
        </h3>
        <p className="mt-2 text-[0.9rem] leading-relaxed">
          <span className="name">{name}</span> goes, and it takes with it:
        </p>
        <ul className="mt-2 grid gap-1">
          {loses.map((l) => (
            <li key={l} className="flex items-baseline gap-2 text-[0.85rem] text-[var(--color-dim)]">
              <span aria-hidden style={{ color: "var(--color-live)" }}>×</span> {l}
            </li>
          ))}
        </ul>
        <p className="label mt-3 !normal-case !tracking-normal">
          This can’t be undone. Type <b className="text-[var(--color-text)]">{name}</b> to confirm.
        </p>
        <input
          className="field mt-2"
          placeholder={name}
          value={typed}
          autoFocus
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && armed) onConfirm(); }}
        />
        <div className="mt-4 flex gap-2">
          <button className="btn btn-ghost flex-1" onClick={onClose}>Keep it</button>
          <button
            className="btn flex-1"
            disabled={!armed}
            style={armed
              ? { background: "var(--color-live)", color: "#fff" }
              : { border: "1px solid var(--color-line)", color: "var(--color-dim)" }}
            onClick={onConfirm}
          >
            Delete forever
          </button>
        </div>
      </div>
    </div>
  );
}

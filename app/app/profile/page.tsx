"use client";

import { useState } from "react";
import { Header, Footer, SectionTitle } from "@/components/Chrome";
import { useDB, actions } from "@/lib/store";
import { formatHandicap, parseHandicap } from "@/lib/scoring";

/**
 * The device owner's own details. One place to keep your handicap index; saving
 * it flows into every player row carrying your name, so the organiser stops
 * typing it and it stops going stale.
 *
 * This is deliberately NOT an account. On the shared database it becomes the
 * claim flow — same screen, same idea, synced between phones.
 */
export default function ProfilePage() {
  const db = useDB();
  const [name, setName] = useState<string | null>(null);
  const [hcp, setHcp] = useState<string | null>(null);
  const [club, setClub] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [avatar, setAvatar] = useState<string | null>(null);
  const vAvatar = avatar ?? db.me?.avatar ?? null;

  /** Resize to a 192px square centre-crop so localStorage stays light. */
  const onPick = (file: File) => {
    const img = new Image();
    img.onload = () => {
      const size = 192;
      const c = document.createElement("canvas");
      c.width = size; c.height = size;
      const ctx = c.getContext("2d")!;
      const m = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
      setAvatar(c.toDataURL("image/jpeg", 0.85));
      setSaved(null);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  const vName = name ?? db.me?.name ?? "";
  const vHcp = hcp ?? (db.me ? formatHandicap(db.me.handicapIndex) : "");
  const vClub = club ?? db.me?.homeClub ?? "";

  const matches = vName.trim()
    ? db.players.filter((p) => p.name.trim().toLowerCase() === vName.trim().toLowerCase())
    : [];

  return (
    <>
      <Header back={{ href: "/", label: "Home" }} />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-16">
        <section className="py-8">
          <p className="label">This phone</p>
          <h1 className="display mt-2 text-[clamp(1.7rem,5vw,2.4rem)]">Your profile</h1>
          <p className="mt-3 max-w-[46ch] text-[0.9rem] leading-relaxed text-[var(--color-dim)]">
            Keep your handicap index here and it flows into every society you play in under this
            name — your organiser never has to chase it.
          </p>
        </section>

        <SectionTitle>Details</SectionTitle>
        <form
          className="card grid gap-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const n = actions.setMe({
              name: vName.trim(),
              handicapIndex: parseHandicap(vHcp),
              homeClub: vClub.trim() || undefined,
              avatar: vAvatar ?? undefined,
            });
            setSaved(
              n === 0
                ? "Saved."
                : `Saved — handicap updated on ${n} player row${n === 1 ? "" : "s"}.`
            );
          }}
        >
          <div className="flex items-center gap-4">
            {vAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vAvatar} alt="" className="rounded-full border-2 object-cover"
                   style={{ width: "4.2rem", height: "4.2rem", borderColor: "var(--color-acid)" }} />
            ) : (
              <span className="grid rounded-full border bg-[var(--color-panel-2)]"
                    style={{ width: "4.2rem", height: "4.2rem", placeItems: "center", borderColor: "var(--color-line)" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-dim)" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>
              </span>
            )}
            <label className="btn btn-ghost !min-h-[2.4rem] cursor-pointer !text-[0.8rem]">
              {vAvatar ? "Change photo" : "Add a photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
              />
            </label>
          </div>

          <label>
            <span className="label mb-1.5 block">Your name</span>
            <input
              className="field"
              placeholder="Dave Prichard"
              value={vName}
              onChange={(e) => { setName(e.target.value); setSaved(null); }}
            />
            <span className="label mt-1.5 block !normal-case !tracking-normal">
              Exactly as your organiser writes it — that&apos;s how the two are matched.
            </span>
          </label>

          <label>
            <span className="label mb-1.5 block">Handicap index</span>
            <input
              className="field num w-[9rem]"
              placeholder="12.4 or +1.6"
              value={vHcp}
              onChange={(e) => { setHcp(e.target.value); setSaved(null); }}
            />
          </label>

          <label>
            <span className="label mb-1.5 block">Home club (optional)</span>
            <input
              className="field"
              placeholder="Conwy"
              value={vClub}
              onChange={(e) => { setClub(e.target.value); setSaved(null); }}
            />
          </label>

          <div className="flex items-center gap-3">
            <button className="btn btn-primary" type="submit">Save</button>
            {saved && <span className="label" style={{ color: "var(--color-acid)" }}>{saved}</span>}
          </div>
        </form>

        {matches.length > 0 && (
          <>
            <SectionTitle aside={<span className="label">{matches.length}</span>}>
              Player rows with your name
            </SectionTitle>
            <div className="card divide-y divide-[var(--line-soft)]">
              {matches.map((p) => {
                const soc = db.societies.find((s) => s.id === p.societyId);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-[0.9rem]">{soc?.name ?? "—"}</span>
                    <span className="num text-[0.9rem]">HCP {formatHandicap(p.handicapIndex)}</span>
                  </div>
                );
              })}
            </div>
            <p className="label mt-2 !normal-case !tracking-normal">
              Saving updates these. Cards already played keep the handicap they were played off —
              a new index only changes future days.
            </p>
          </>
        )}
      </main>

      <Footer />
    </>
  );
}

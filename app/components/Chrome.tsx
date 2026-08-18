import Link from "next/link";
import { Crest, Wordmark } from "./Crest";

export function Header({ back }: { back?: { href: string; label: string } }) {
  // One rule on every page: the wordmark sits on the right, always a link
  // home; the left slot is the back button's — empty on Home, never anything
  // else. Chrome that stays put reads as an app, not a website.
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[rgba(6,8,10,0.88)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        {back ? (
          // An unmissable back button, not a breadcrumb you have to discover.
          <Link
            href={back.href}
            className="flex min-h-[2.6rem] items-center gap-1.5 rounded-full border px-3.5"
            style={{ borderColor: "var(--color-acid)", color: "var(--color-acid)", background: "rgba(47,219,0,0.08)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18 9 12l6-6" /></svg>
            <span className="label !text-[0.7rem]" style={{ color: "inherit" }}>Back</span>
          </Link>
        ) : (
          <span />
        )}
        <Link href="/" className="flex items-center gap-2">
          <Crest size={22} />
          <Wordmark className="!text-[1rem]" />
        </Link>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--color-line)] py-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4">
        <span className="label">Societee · beta</span>
        <span className="label">Run your golf society without the spreadsheets</span>
      </div>
    </footer>
  );
}

/** Section heading — heavy condensed caps with a hard rule under it. */
export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 border-b border-[var(--color-line)] pb-2">
      <h2 className="display text-[1.15rem]">{children}</h2>
      {aside}
    </div>
  );
}

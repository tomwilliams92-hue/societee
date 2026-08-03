import Link from "next/link";
import { Crest, Wordmark } from "./Crest";

export function Header({ back }: { back?: { href: string; label: string } }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[rgba(6,8,10,0.88)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Crest size={24} />
          <Wordmark />
        </Link>
        {back && (
          <>
            <span className="text-[var(--color-line)]">/</span>
            <Link href={back.href} className="label hover:text-[var(--color-text)]">
              {back.label}
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--color-line)] py-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4">
        <span className="label">Societee · demo build</span>
        <span className="label">Run your golf society without the spreadsheets</span>
      </div>
    </footer>
  );
}

/** Section heading — heavy condensed caps with a hard rule under it. */
export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 border-b border-[var(--color-line)] pb-2">
      <h2 className="display text-[1.5rem]">{children}</h2>
      {aside}
    </div>
  );
}

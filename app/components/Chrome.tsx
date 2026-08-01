import Link from "next/link";
import { Crest, Wordmark } from "./Crest";

export function Header({ back }: { back?: { href: string; label: string } }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--rule)] bg-[rgba(247,242,230,0.86)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Crest size={26} />
          <Wordmark />
        </Link>
        {back && (
          <>
            <span className="text-[var(--rule-strong)]">/</span>
            <Link href={back.href} className="label hover:text-ink">
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
    <footer className="mt-auto border-t border-[var(--rule)] py-7">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4">
        <span className="label">Societee · demo build</span>
        <span className="label">Run your golf society without the spreadsheets</span>
      </div>
    </footer>
  );
}

/** Section heading with the printed-form double rule under it. */
export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-[var(--rule-strong)] pb-2">
      <h2 className="engraved text-[1.35rem] leading-none">{children}</h2>
      {aside}
    </div>
  );
}

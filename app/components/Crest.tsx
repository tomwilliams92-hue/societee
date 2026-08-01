/* The Societee seal — a ball on a tee inside a brass roundel. Reads as a club
   crest at 24px on a phone header and at 96px on the public board. */
export function Crest({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="32" cy="32" r="30.5" fill="var(--color-green-deep)" />
      <circle cx="32" cy="32" r="30.5" stroke="var(--color-brass)" strokeWidth="1.4" />
      <circle cx="32" cy="32" r="26" stroke="var(--color-brass)" strokeWidth="0.7" opacity="0.55" />
      {/* ball */}
      <circle cx="32" cy="24.5" r="8.5" fill="var(--color-brass-lift)" />
      <circle cx="29.2" cy="21.8" r="1.05" fill="var(--color-green-deep)" opacity="0.45" />
      <circle cx="33.6" cy="21.2" r="1.05" fill="var(--color-green-deep)" opacity="0.45" />
      <circle cx="35.2" cy="25.4" r="1.05" fill="var(--color-green-deep)" opacity="0.45" />
      <circle cx="30.6" cy="26.6" r="1.05" fill="var(--color-green-deep)" opacity="0.45" />
      {/* tee */}
      <path
        d="M23.5 34.5h17l-5.6 4.2-1.5 11.3h-2.8l-1.5-11.3z"
        fill="var(--color-brass)"
      />
      {/* turf line */}
      <path d="M14 47h9M41 47h9" stroke="var(--color-brass)" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`display text-[1.35rem] leading-none ${className}`}>
      Socie<span style={{ color: "var(--color-brass)" }}>tee</span>
    </span>
  );
}

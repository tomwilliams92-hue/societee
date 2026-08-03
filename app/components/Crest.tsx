/* The Societee mark — a ball on a tee, cut down to a hard geometric badge.
   Reads at 22px on a phone header and at 60px on the public board. */
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
      <rect x="1" y="1" width="62" height="62" rx="3" fill="#0d1116" stroke="#232c33" strokeWidth="1.5" />
      {/* ball */}
      <circle cx="32" cy="24" r="9" fill="var(--color-acid)" />
      {/* tee */}
      <path d="M22 35h20l-6.6 5-1.6 12h-3.6l-1.6-12z" fill="var(--color-acid)" />
      {/* ground line */}
      <path d="M10 52h44" stroke="var(--color-acid)" strokeWidth="2" strokeLinecap="square" opacity="0.35" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`display text-[1.15rem] leading-none tracking-tight ${className}`}>
      SOCIE<span style={{ color: "var(--color-acid)" }}>TEE</span>
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * The built-in art pack: twelve golf badges, drawn as SVG so they cost nothing,
 * work offline, and stay crisp at any size. Six motifs × curated colourways.
 *
 * A society picks one (or uploads a photo, which wins). Events inherit their
 * society's badge so a day always carries its society's colours.
 * ------------------------------------------------------------------------- */

type Palette = { a: string; b: string; g: string };

const PALETTES: Record<string, Palette> = {
  green:  { a: "#2fdb00", b: "#07260b", g: "#0e3a14" },
  gold:   { a: "#f5c542", b: "#2b2107", g: "#40320e" },
  blue:   { a: "#4db8ff", b: "#06182b", g: "#0c2a44" },
  red:    { a: "#ff6b5e", b: "#2b0c08", g: "#421710" },
  silver: { a: "#cfd8dd", b: "#171d20", g: "#262f33" },
  bronze: { a: "#d08a4d", b: "#241204", g: "#3a2008" },
};

function motif(kind: string, p: Palette): React.ReactNode {
  switch (kind) {
    case "flag": // pin flag over a hole
      return (
        <>
          <path d="M30 66V22" stroke={p.a} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M30 22l22 7-22 7z" fill={p.a} />
          <ellipse cx="42" cy="68" rx="18" ry="5" fill={p.a} opacity="0.35" />
        </>
      );
    case "links": // waves and a ball — seaside golf
      return (
        <>
          <path d="M12 58c8-7 16-7 24 0s16 7 24 0" stroke={p.a} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M12 68c8-7 16-7 24 0s16 7 24 0" stroke={p.a} strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.5" />
          <circle cx="36" cy="33" r="12" fill={p.a} />
          <circle cx="32" cy="30" r="1.8" fill={p.b} opacity="0.5" />
          <circle cx="39" cy="29" r="1.8" fill={p.b} opacity="0.5" />
          <circle cx="36" cy="36" r="1.8" fill={p.b} opacity="0.5" />
        </>
      );
    case "crest": // shield with ball on tee
      return (
        <>
          <path d="M36 12l22 7v16c0 14-9 24-22 29-13-5-22-15-22-29V19z" fill="none" stroke={p.a} strokeWidth="3" />
          <circle cx="36" cy="33" r="8" fill={p.a} />
          <path d="M29 45h14l-4.5 3.4-1 7.2h-3l-1-7.2z" fill={p.a} />
        </>
      );
    case "pines": // two trees
      return (
        <>
          <path d="M26 18 12 44h10L8 62h36z" fill={p.a} opacity="0.55" />
          <path d="M48 24 36 46h8L32 62h32z" fill={p.a} />
          <path d="M26 62v6M48 62v6" stroke={p.a} strokeWidth="4" strokeLinecap="round" />
        </>
      );
    case "sunrise": // dawn tee time
      return (
        <>
          <circle cx="36" cy="50" r="16" fill={p.a} />
          <path d="M36 18v8M14 28l6 6M58 28l-6 6M8 50h8M56 50h8" stroke={p.a} strokeWidth="3.5" strokeLinecap="round" />
          <rect x="6" y="52" width="60" height="18" fill={p.b} />
          <path d="M6 54h60" stroke={p.a} strokeWidth="2.5" opacity="0.6" />
        </>
      );
    default: // "ball" — big dimpled ball
      return (
        <>
          <circle cx="36" cy="38" r="21" fill={p.a} />
          {[[-7, -6], [2, -9], [9, -2], [-9, 3], [0, 1], [8, 7], [-4, 10]].map(([dx, dy], i) => (
            <circle key={i} cx={36 + dx} cy={38 + dy} r="2.1" fill={p.b} opacity="0.45" />
          ))}
        </>
      );
  }
}

/** The curated dozen shown in the picker. */
export const BADGES = [
  "flag-green", "links-blue", "crest-gold", "pines-green",
  "sunrise-gold", "ball-silver", "flag-red", "links-green",
  "crest-silver", "pines-blue", "sunrise-red", "ball-bronze",
] as const;

export function Badge({
  id,
  size = 48,
  rounded = 14,
}: {
  id?: string;
  size?: number;
  rounded?: number;
}) {
  const [kind = "flag", colour = "green"] = (id ?? "flag-green").split("-");
  const p = PALETTES[colour] ?? PALETTES.green;
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden="true" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.g} />
          <stop offset="1" stopColor={p.b} />
        </linearGradient>
      </defs>
      <rect width="72" height="72" rx={rounded} fill={`url(#bg-${id})`} />
      <rect width="72" height="72" rx={rounded} fill="none" stroke={p.a} strokeOpacity="0.4" />
      {motif(kind, p)}
    </svg>
  );
}

/** Society identity: uploaded photo wins, else its badge, else the default. */
export function SocietyBadge({
  society,
  size = 48,
  rounded = 14,
}: {
  society?: { badge?: string; crestData?: string } | null;
  size?: number;
  rounded?: number;
}) {
  if (society?.crestData) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={society.crestData}
        alt=""
        style={{ width: size, height: size, borderRadius: rounded, objectFit: "cover", display: "block" }}
      />
    );
  }
  return <Badge id={society?.badge} size={size} rounded={rounded} />;
}

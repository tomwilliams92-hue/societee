/* ---------------------------------------------------------------------------
 * The home-screen hero: a night course under floodlight glow, fading into the
 * page black so the dashboard rises out of it. Drawn as SVG for the same
 * reasons as the badge pack — free, offline, crisp at any size.
 *
 * The composition lives in a wide 1200-unit stage with the flag just left of
 * centre; xMidYMax+slice crops the sides on a phone and shows the full stage
 * on desktop, so the flag stays in frame everywhere.
 *
 * Renders as an absolute backdrop filling its nearest positioned ancestor —
 * the host block sets the height with its own padding, so there are no
 * negative margins anywhere near the scroll container (iOS is touchy about
 * overflow above the scroll origin).
 * ------------------------------------------------------------------------- */

export function CourseScene() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg
        className="block h-full w-full"
        viewBox="0 0 1200 116"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#08141a" />
            <stop offset="0.6" stopColor="#0d2a1c" />
            <stop offset="1" stopColor="#123a1e" />
          </linearGradient>
          <linearGradient id="cs-fairway" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#10301a" />
            <stop offset="1" stopColor="#06080a" />
          </linearGradient>
          <radialGradient id="cs-glow" cx="0.46" cy="0.45" r="0.42">
            <stop offset="0" stopColor="#2fdb00" stopOpacity="0.38" />
            <stop offset="1" stopColor="#2fdb00" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1200" height="116" fill="url(#cs-sky)" />
        <rect width="1200" height="116" fill="url(#cs-glow)" />
        <ellipse cx="420" cy="128" rx="520" ry="52" fill="url(#cs-fairway)" />
        <ellipse cx="920" cy="140" rx="580" ry="58" fill="#0a1810" />
        <path d="M570 96V40" stroke="#cfe8c8" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M570 40l28 9-28 9z" fill="var(--color-live)" />
        <ellipse cx="580" cy="98" rx="28" ry="5" fill="#03110a" opacity="0.7" />
      </svg>
      {/* fade into the page so content rises out of the scene */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, transparent 30%, var(--color-ink) 96%)" }}
      />
    </div>
  );
}

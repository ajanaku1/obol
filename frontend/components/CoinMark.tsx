/** Obol's mark — a struck bronze coin. The recurring identity anchor. */
export function CoinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="coin-face" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#e6c884" />
          <stop offset="55%" stopColor="#cda655" />
          <stop offset="100%" stopColor="#7d6231" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="18.5" fill="url(#coin-face)" />
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="#3a2d15" strokeWidth="1" />
      {/* Beaded inner ring — the minted detail. */}
      <circle
        cx="20"
        cy="20"
        r="13.5"
        fill="none"
        stroke="#3a2d15"
        strokeWidth="1.4"
        strokeDasharray="0.6 2.3"
        strokeLinecap="round"
      />
      {/* The obol glyph — a single struck upright. */}
      <path d="M20 11 v18 M15 14 h10 M15 26 h10" stroke="#2a2010" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

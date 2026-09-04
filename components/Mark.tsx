/**
 * Wordmark: a route strip in miniature — the same bead-and-line motif the
 * itinerary view is built from, carrying the three operational line colours.
 */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M12 4.5v15"
        stroke="var(--hairline-strong)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="4.5" r="3" fill="var(--purple-swatch)" />
      <circle cx="12" cy="12" r="3" fill="var(--green-swatch)" />
      <circle cx="12" cy="19.5" r="3" fill="var(--yellow-swatch)" />
    </svg>
  );
}

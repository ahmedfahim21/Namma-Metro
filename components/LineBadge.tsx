/**
 * Line colour helpers.
 *
 * `lineSwatch` returns the authentic BMRCL line colour — use it for graphics
 * (map strokes, route spines, dots). `lineInk` returns a contrast-corrected
 * variant — use it whenever the colour is applied to TEXT. The real Yellow
 * Line colour is ~1.6:1 against white; painting a label with it would be
 * unreadable, so text and graphics deliberately diverge.
 */

export function lineSwatch(line: string): string {
  return `var(--${line}-swatch, var(--inactive-swatch))`;
}

export function lineInk(line: string): string {
  return `var(--${line}-ink, var(--inactive-ink))`;
}

export function LineDot({ line, size = 8 }: { line: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: lineSwatch(line) }}
    />
  );
}

/** Inline "● Purple Line" marker. `label` overrides the line's own name. */
export function LineBadge({
  line,
  label,
  className = "",
}: {
  line: string;
  label?: string;
  className?: string;
}) {
  const name = label ?? `${line.charAt(0).toUpperCase()}${line.slice(1)} Line`;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold ${className}`}
      style={{ color: lineInk(line) }}
    >
      <LineDot line={line} />
      {name}
    </span>
  );
}

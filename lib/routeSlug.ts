import { stationBySlug, routableStations } from "@/lib/network";
import type { Station } from "@/packages/network/src/schema";
import { isInService } from "@/packages/network/src/status";

const SEPARATOR = "-to-";

export function buildRouteSlug(from: Station, to: Station): string {
  return `${from.slug}${SEPARATOR}${to.slug}`;
}

/**
 * Parses a "<from>-to-<to>" route slug. Station slugs themselves never
 * contain the standalone word "to" (verified against the current dataset
 * in tests), so splitting on the first "-to-" occurrence that resolves
 * both sides to real stations is unambiguous in practice; we still try
 * every "-to-" occurrence as a fallback for safety.
 */
export function parseRouteSlug(slug: string): { from: Station; to: Station } | null {
  let searchFrom = 0;
  for (;;) {
    const idx = slug.indexOf(SEPARATOR, searchFrom);
    if (idx === -1) return null;
    const fromSlug = slug.slice(0, idx);
    const toSlug = slug.slice(idx + SEPARATOR.length);
    const from = stationBySlug.get(fromSlug);
    const to = stationBySlug.get(toSlug);
    if (from && to) return { from, to };
    searchFrom = idx + 1;
  }
}

/** A curated subset of pairs to pre-render at build time (interchanges + terminals). */
export function popularRoutePairs(): [Station, Station][] {
  // Terminals are the ends of the track you can ride, not of the line as planned.
  const maxSequenceByLine = new Map<string, number>();
  const minSequenceByLine = new Map<string, number>();
  for (const s of routableStations) {
    for (const m of s.lines.filter(isInService)) {
      maxSequenceByLine.set(m.line, Math.max(maxSequenceByLine.get(m.line) ?? -Infinity, m.sequence));
      minSequenceByLine.set(m.line, Math.min(minSequenceByLine.get(m.line) ?? Infinity, m.sequence));
    }
  }
  const featured = routableStations.filter(
    (s) =>
      s.interchange ||
      s.lines
        .filter(isInService)
        .some(
          (m) =>
            m.sequence === minSequenceByLine.get(m.line) || m.sequence === maxSequenceByLine.get(m.line),
        ),
  );
  const pairs: [Station, Station][] = [];
  for (const a of featured) {
    for (const b of featured) {
      if (a.id !== b.id) pairs.push([a, b]);
    }
  }
  return pairs;
}

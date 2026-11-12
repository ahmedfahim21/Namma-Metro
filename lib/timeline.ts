import type { LineId, Segment, Station } from "@/packages/network/src/schema";

/**
 * The network's growth as a list of openings, built from the opening date on
 * every segment. Sections that are still being built come last, dated to the
 * first of their target month.
 */

export interface OpeningEvent {
  id: string;
  /** YYYY-MM-DD the stretch opened, or the first of its target month if not yet open. */
  date: string;
  line: LineId;
  /** Station ids at either end of the stretch, in line order. */
  from: string;
  to: string;
  meters: number;
  /** True for stretches that have no confirmed opening day yet. */
  planned: boolean;
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** "March 2027" -> "2027-03-01". */
export function expectedToDate(expected: string): string {
  const match = expected.trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  const month = match ? MONTH_NAMES.indexOf(match[1].toLowerCase()) : -1;
  if (!match || month < 0) {
    throw new Error(`Cannot place "${expected}" on the timeline; use "<Month> <Year>".`);
  }
  return `${match[2]}-${String(month + 1).padStart(2, "0")}-01`;
}

function segmentDate(segment: Segment): { date: string; planned: boolean } {
  if (segment.openDate) return { date: segment.openDate, planned: false };
  if (!segment.expected) {
    throw new Error(`Segment ${segment.from} → ${segment.to} has neither an opening date nor a target.`);
  }
  return { date: expectedToDate(segment.expected), planned: true };
}

/** Openings in date order. Segments must be listed in line order, as the build emits them. */
export function openingEvents(segments: Segment[]): OpeningEvent[] {
  const events: OpeningEvent[] = [];
  for (const segment of segments) {
    const { date, planned } = segmentDate(segment);
    const last = events[events.length - 1];
    // Neighbouring segments of one line that opened the same day are one stretch.
    if (last && last.line === segment.line && last.date === date && last.to === segment.from) {
      last.to = segment.to;
      last.meters += segment.distanceMeters;
    } else {
      events.push({
        id: `${segment.line}:${segment.from}:${date}`,
        date,
        line: segment.line,
        from: segment.from,
        to: segment.to,
        meters: segment.distanceMeters,
        planned,
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

/** The first day each station had (or is due to have) any trains. */
export function stationFirstDates(stations: Station[]): Map<string, { date: string; planned: boolean }> {
  const result = new Map<string, { date: string; planned: boolean }>();
  for (const station of stations) {
    const dates = station.lines.map((m) => {
      if (m.openDate) return { date: m.openDate, planned: false };
      if (!m.expected) throw new Error(`${station.name} has neither an opening date nor a target.`);
      return { date: expectedToDate(m.expected), planned: true };
    });
    result.set(station.id, dates.sort((a, b) => a.date.localeCompare(b.date))[0]);
  }
  return result;
}

/** Size of the network on `date`. Stretches still being built are counted apart from open track. */
export function networkAt(
  events: OpeningEvent[],
  firstDates: Map<string, { date: string; planned: boolean }>,
  date: string,
): { meters: number; stations: number; lines: number; plannedMeters: number; plannedStations: number } {
  const reached = events.filter((e) => e.date <= date);
  const open = reached.filter((e) => !e.planned);
  const stationDates = [...firstDates.values()].filter((d) => d.date <= date);
  return {
    meters: open.reduce((sum, e) => sum + e.meters, 0),
    stations: stationDates.filter((d) => !d.planned).length,
    lines: new Set(open.map((e) => e.line)).size,
    plannedMeters: reached.filter((e) => e.planned).reduce((sum, e) => sum + e.meters, 0),
    plannedStations: stationDates.filter((d) => d.planned).length,
  };
}

/** "2011-10" style month keys from the first opening to the last, inclusive. */
export function monthRange(events: OpeningEvent[]): string[] {
  if (events.length === 0) return [];
  const [startYear, startMonth] = events[0].date.split("-").map(Number);
  const [endYear, endMonth] = events[events.length - 1].date.split("-").map(Number);
  const months: string[] = [];
  for (let y = startYear, m = startMonth; y < endYear || (y === endYear && m <= endMonth); m++) {
    if (m > 12) {
      m = 1;
      y++;
    }
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

/** Last day of a "YYYY-MM" month, so that month includes everything opened in it. */
export function monthEnd(month: string): string {
  return `${month}-31`;
}

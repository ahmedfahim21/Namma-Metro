import type { TimetableEntry, LineId, DayType } from "../../network/src/schema";
import type { Leg } from "./itinerary";

export interface DepartureEstimate {
  /** Minutes since midnight, local time, that this departure is expected. */
  minute: number;
  /** Seconds from `now` until this departure. */
  inSeconds: number;
}

export interface LegDeparture {
  line: LineId;
  serviceOpen: boolean;
  firstTrainMinute: number;
  lastTrainMinute: number;
  headwaySeconds: number;
  /** Expected wait from `now`, modelled as half the current headway. */
  expectedWaitSeconds: number;
  nextDepartures: DepartureEstimate[];
}

export function dayTypeFor(date: Date): DayType {
  const day = date.getDay(); // 0 = Sunday
  if (day === 0) return "sunday_holiday";
  if (day === 6) return "saturday";
  return "weekday";
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function headwayAt(entry: TimetableEntry, minute: number): number {
  const band = entry.headwayBands.find((b) => minute >= b.startMinute && minute < b.endMinute);
  return band?.headwaySeconds ?? entry.headwayBands[entry.headwayBands.length - 1].headwaySeconds;
}

/**
 * Determines whether a leg travels in increasing or decreasing station
 * sequence (needed to pick the matching timetable direction), using the
 * ordered `stations` list already resolved on the leg together with each
 * station's `sequence` on this line.
 */
export function directionIndexForLeg(leg: Leg, sequenceOf: (stationId: string, line: LineId) => number | undefined): 0 | 1 {
  const first = sequenceOf(leg.boardStation, leg.line);
  const last = sequenceOf(leg.alightStation, leg.line);
  if (first === undefined || last === undefined) return 0;
  return last >= first ? 0 : 1;
}

/**
 * Estimates the next few departures for a leg, given the current time.
 * This is modelled from published first/last train times and typical
 * frequency bands — NOT a live feed. `now` should be in the same local
 * timezone the timetable data was authored in (IST).
 */
export function estimateDepartures(
  timetables: TimetableEntry[],
  line: LineId,
  directionIndex: 0 | 1,
  now: Date,
  count = 3,
): LegDeparture | null {
  const dayType = dayTypeFor(now);
  const entry = timetables.find(
    (t) => t.line === line && t.directionIndex === directionIndex && t.dayType === dayType,
  );
  if (!entry) return null;

  const nowMinute = minutesSinceMidnight(now);
  const serviceOpen = nowMinute >= entry.firstTrainMinute && nowMinute <= entry.lastTrainMinute;
  const headwaySeconds = headwayAt(entry, nowMinute);

  const nextDepartures: DepartureEstimate[] = [];
  if (serviceOpen) {
    // Model departures as evenly spaced from first train at the current
    // headway; find the next multiple of headway after `now`.
    const elapsedSinceFirst = (nowMinute - entry.firstTrainMinute) * 60;
    const headwaysElapsed = Math.ceil(elapsedSinceFirst / headwaySeconds);
    for (let i = 0; i < count; i++) {
      const departSeconds = (headwaysElapsed + i) * headwaySeconds;
      const departMinute = entry.firstTrainMinute + departSeconds / 60;
      if (departMinute > entry.lastTrainMinute) break;
      nextDepartures.push({
        minute: departMinute,
        inSeconds: Math.max(0, Math.round(departSeconds - elapsedSinceFirst)),
      });
    }
  }

  return {
    line,
    serviceOpen,
    firstTrainMinute: entry.firstTrainMinute,
    lastTrainMinute: entry.lastTrainMinute,
    headwaySeconds,
    expectedWaitSeconds: Math.round(headwaySeconds / 2),
    nextDepartures,
  };
}

export function formatClock(minute: number): string {
  const m = Math.round(minute) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

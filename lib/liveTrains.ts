import type { LineId, Segment, Station, TimetableEntry, DayType } from "@/packages/network/src/schema";
import { dateInIST, openState } from "@/packages/network/src/status";

/**
 * Where trains would be right now if they ran exactly to the modelled
 * timetable. BMRCL publishes no live positions, so this is a simulation: a
 * train leaves each terminal every headway and takes the modelled run time
 * between stations. Good for showing how busy the network is; not for
 * catching a specific train.
 */

/** One direction of one line: the stations a train calls at, in order, and when. */
export interface LineService {
  line: LineId;
  directionIndex: 0 | 1;
  stationIds: string[];
  /** Seconds after leaving the first station that the train departs each station. */
  departAfter: number[];
  /** Seconds from the first station to arrival at the last. */
  tripSeconds: number;
}

export interface LiveTrain {
  id: string;
  line: LineId;
  directionIndex: 0 | 1;
  fromStation: string;
  toStation: string;
  /** 0 while standing at `fromStation`, rising to 1 on arrival at `toStation`. */
  progress: number;
}

/** Time spent standing at each platform, taken out of the modelled run time. */
export const DWELL_SECONDS = 25;

/**
 * The stretch of each line that is carrying passengers on `today` (IST,
 * YYYY-MM-DD), in both directions. Sections that are announced but not yet
 * open have no trains.
 */
export function lineServices(stations: Station[], segments: Segment[], today: string): LineService[] {
  const services: LineService[] = [];
  const byLine = new Map<LineId, Segment[]>();
  for (const segment of segments) {
    if (openState(segment, today) !== "open") continue;
    byLine.set(segment.line, [...(byLine.get(segment.line) ?? []), segment]);
  }

  for (const [line, open] of byLine) {
    const sequence = (id: string) =>
      stations.find((s) => s.id === id)!.lines.find((m) => m.line === line)!.sequence;
    const ordered = [...open].sort((a, b) => sequence(a.from) - sequence(b.from));
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].from !== ordered[i - 1].to) {
        throw new Error(`The open part of the ${line} line is not one continuous stretch.`);
      }
    }
    const forward = [ordered[0].from, ...ordered.map((s) => s.to)];
    const runs = ordered.map((s) => s.runSeconds);

    const build = (stationIds: string[], runSeconds: number[], directionIndex: 0 | 1): LineService => {
      const departAfter = [0];
      for (const run of runSeconds) departAfter.push(departAfter[departAfter.length - 1] + run);
      return { line, directionIndex, stationIds, departAfter, tripSeconds: departAfter[departAfter.length - 1] };
    };
    services.push(build(forward, runs, 0));
    services.push(build([...forward].reverse(), [...runs].reverse(), 1));
  }
  return services;
}

/** Every departure from the starting terminal across the service day, in seconds since midnight. */
export function terminalDepartures(entry: TimetableEntry): number[] {
  const departures: number[] = [];
  let minute = entry.firstTrainMinute;
  while (minute <= entry.lastTrainMinute) {
    departures.push(minute * 60);
    const band =
      entry.headwayBands.find((b) => minute >= b.startMinute && minute < b.endMinute) ??
      entry.headwayBands[entry.headwayBands.length - 1];
    minute += band.headwaySeconds / 60;
  }
  return departures;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * Every train on the network at `secondsSinceMidnight` on a `dayType` day.
 * Trains that set off before midnight and are still running are included.
 */
export function trainsAt(
  services: LineService[],
  timetables: TimetableEntry[],
  dayType: DayType,
  secondsSinceMidnight: number,
): LiveTrain[] {
  const trains: LiveTrain[] = [];
  for (const service of services) {
    const entry = timetables.find(
      (t) => t.line === service.line && t.directionIndex === service.directionIndex && t.dayType === dayType,
    );
    if (!entry) continue;
    const departures = terminalDepartures(entry);
    // Also look a day back, for a late train still finishing its run after midnight.
    for (const dayOffset of [0, -86_400]) {
      for (const departure of departures) {
        const elapsed = secondsSinceMidnight - (departure + dayOffset);
        if (elapsed < 0 || elapsed >= service.tripSeconds) continue;
        let hop = 0;
        while (hop < service.departAfter.length - 2 && service.departAfter[hop + 1] <= elapsed) hop++;
        const run = service.departAfter[hop + 1] - service.departAfter[hop];
        const dwell = Math.min(DWELL_SECONDS, run / 2);
        const moving = (elapsed - service.departAfter[hop] - dwell) / (run - dwell);
        trains.push({
          id: `${service.line}-${service.directionIndex}-${dayOffset === 0 ? "" : "y"}${departure}`,
          line: service.line,
          directionIndex: service.directionIndex,
          fromStation: service.stationIds[hop],
          toStation: service.stationIds[hop + 1],
          progress: moving <= 0 ? 0 : easeInOut(Math.min(1, moving)),
        });
      }
    }
  }
  return trains;
}

const IST_OFFSET_MS = 5.5 * 3_600_000;

/** The Bengaluru wall clock for an instant, whatever timezone the device is in. */
export function istClock(epochMs: number): { today: string; dayType: DayType; secondsSinceMidnight: number } {
  const shifted = epochMs + IST_OFFSET_MS;
  const day = new Date(shifted).getUTCDay();
  return {
    today: dateInIST(new Date(epochMs)),
    dayType: day === 0 ? "sunday_holiday" : day === 6 ? "saturday" : "weekday",
    secondsSinceMidnight: (((shifted % 86_400_000) + 86_400_000) % 86_400_000) / 1000,
  };
}

/** The instant on the same Bengaluru day as `epochMs` at `seconds` past midnight. */
export function atSecondsOfDay(epochMs: number, seconds: number): number {
  const shifted = epochMs + IST_OFFSET_MS;
  const midnight = shifted - (((shifted % 86_400_000) + 86_400_000) % 86_400_000);
  return midnight + seconds * 1000 - IST_OFFSET_MS;
}

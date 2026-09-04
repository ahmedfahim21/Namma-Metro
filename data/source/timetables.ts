/**
 * Timetable model, v1.
 *
 * Namma Metro does not publish a public per-station timetable API. Figures
 * here are assembled from BMRCL's published first/last train times and
 * commonly-cited peak/off-peak frequency bands (see SOURCES.md). Headways
 * are modelled per line/direction/day-type rather than scraped per-train,
 * and are clearly presented in the UI as "typical frequency", not a live
 * feed — there is no public real-time train position API to build one on.
 */
import type { LineId } from "./stations";

export interface HeadwayBand {
  startMinute: number; // minutes since midnight
  endMinute: number;
  headwaySeconds: number;
}

export interface TimetableSpec {
  line: LineId;
  direction: string; // human label, e.g. "Whitefield-bound"
  directionIndex: 0 | 1;
  dayType: "weekday" | "saturday" | "sunday_holiday";
  firstTrainMinute: number;
  lastTrainMinute: number;
  headwayBands: HeadwayBand[];
  source: string;
}

const SOURCE =
  "BMRCL published first/last train times + commonly reported peak (4-6 min) / "
  + "off-peak (7-10 min) frequency bands, checked September 2026. Modelled, not live.";

function standardBands(peakHeadway: number, offPeakHeadway: number, eveningHeadway: number): HeadwayBand[] {
  return [
    { startMinute: 0, endMinute: 7 * 60, headwaySeconds: offPeakHeadway }, // before 07:00
    { startMinute: 7 * 60, endMinute: 10 * 60, headwaySeconds: peakHeadway }, // 07:00-10:00
    { startMinute: 10 * 60, endMinute: 17 * 60, headwaySeconds: offPeakHeadway }, // 10:00-17:00
    { startMinute: 17 * 60, endMinute: 20 * 60 + 30, headwaySeconds: peakHeadway }, // 17:00-20:30
    { startMinute: 20 * 60 + 30, endMinute: 24 * 60, headwaySeconds: eveningHeadway }, // after 20:30
  ];
}

function weekendBands(headway: number): HeadwayBand[] {
  return [{ startMinute: 0, endMinute: 24 * 60, headwaySeconds: headway }];
}

const lineDirections: Record<LineId, [string, string]> = {
  purple: ["Whitefield-bound", "Challaghatta-bound"],
  green: ["Silk Institute-bound", "Madavara-bound"],
  yellow: ["Bommasandra-bound", "RV Road-bound"],
  pink: ["Nagawara-bound", "Kalena Agrahara-bound"],
  blue: ["Airport-bound", "Central-bound"],
};

function forLine(line: LineId, peak: number, offPeak: number, evening: number, satHeadway: number, sunHeadway: number): TimetableSpec[] {
  const [dir1, dir2] = lineDirections[line];
  const specs: TimetableSpec[] = [];
  ([[dir1, 0], [dir2, 1]] as [string, 0 | 1][]).forEach(([direction, directionIndex]) => {
    specs.push({
      line,
      direction,
      directionIndex,
      dayType: "weekday",
      firstTrainMinute: 5 * 60,
      lastTrainMinute: 23 * 60,
      headwayBands: standardBands(peak, offPeak, evening),
      source: SOURCE,
    });
    specs.push({
      line,
      direction,
      directionIndex,
      dayType: "saturday",
      firstTrainMinute: 5 * 60,
      lastTrainMinute: 23 * 60,
      headwayBands: weekendBands(satHeadway),
      source: SOURCE,
    });
    specs.push({
      line,
      direction,
      directionIndex,
      dayType: "sunday_holiday",
      firstTrainMinute: 6 * 60,
      lastTrainMinute: 23 * 60,
      headwayBands: weekendBands(sunHeadway),
      source: SOURCE,
    });
  });
  return specs;
}

export const timetables: TimetableSpec[] = [
  ...forLine("purple", 4 * 60, 7 * 60, 12 * 60, 6 * 60, 8 * 60),
  ...forLine("green", 4 * 60, 7 * 60, 12 * 60, 6 * 60, 8 * 60),
  ...forLine("yellow", 6 * 60, 10 * 60, 15 * 60, 10 * 60, 12 * 60),
];

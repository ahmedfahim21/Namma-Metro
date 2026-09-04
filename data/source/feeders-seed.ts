/**
 * First/last-mile seed data, v1.
 *
 * The plan calls for deriving feeder-bus stops from the unofficial
 * Vonter/bmtc-gtfs dataset at build time (snapping stops within ~400m of
 * each metro station). That importer is NOT implemented in this session —
 * it needs the GTFS files fetched and parsed, which is real work on its
 * own. What's here instead is a small, hand-curated seed for the busiest
 * interchange/terminal stations, clearly marked as such, so the UI and the
 * data shape are real and testable today. Swapping this file's source for
 * a real `scripts/build-feeders.ts` GTFS importer later is a drop-in
 * replacement — see packages/lastmile/src/index.ts, which only depends on
 * the FeederStop shape, not on how it was produced.
 */

export interface FeederStopSeed {
  stationId: string; // metro station slug
  busStopName: string;
  routes: string[]; // BMTC route numbers, best-effort, verify locally
  walkMeters: number;
}

export const feederSeed: FeederStopSeed[] = [
  { stationId: "nadaprabhu-kempegowda-station-majestic", busStopName: "Kempegowda Bus Station (Majestic)", routes: ["Most BMTC trunk routes"], walkMeters: 250 },
  { stationId: "mahatma-gandhi-road", busStopName: "Trinity Circle", routes: ["335E", "365"], walkMeters: 150 },
  { stationId: "baiyappanahalli", busStopName: "Baiyappanahalli Bus Stop", routes: ["290", "291"], walkMeters: 200 },
  { stationId: "whitefield-kadugodi", busStopName: "Kadugodi Bus Stand", routes: ["335E", "500D"], walkMeters: 300 },
  { stationId: "yeshwanthpur", busStopName: "Yeshwanthpur Bus Stop", routes: ["251", "253"], walkMeters: 180 },
  { stationId: "rashtreeya-vidyalaya-road", busStopName: "RV Road Bus Stop", routes: ["215", "219"], walkMeters: 150 },
  { stationId: "jayanagar", busStopName: "Jayanagar 4th Block", routes: ["210", "215"], walkMeters: 220 },
  { stationId: "banashankari", busStopName: "Banashankari Bus Stand", routes: ["Multiple south routes"], walkMeters: 250 },
  { stationId: "central-silk-board", busStopName: "Silk Board Junction", routes: ["500C", "500D"], walkMeters: 200 },
  { stationId: "electronic-city", busStopName: "Electronic City Toll Gate", routes: ["356", "600"], walkMeters: 280 },
];

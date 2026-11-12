/**
 * Assembles data/source/*.ts into validated data/*.json.
 * Run with: pnpm run build:data
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  lines as lineDefs,
  interchanges,
  interchangeWalkSeconds,
  aliases,
  type LineDef,
  type LineStatus,
  type SectionDef,
} from "../data/source/stations";
import { coords } from "../data/source/coords";
import { timetables } from "../data/source/timetables";
import { fareRules } from "../data/source/fares";
import { NetworkSchema, type Station, type Segment, type Line } from "../packages/network/src/schema";

const OUT_DIR = resolve(__dirname, "../data");
const PUBLIC_DATA_DIR = resolve(__dirname, "../public/data");
const COORD_SOURCE = "Position and Kannada name © OpenStreetMap contributors (ODbL).";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[(),.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function coordOf(name: string) {
  const coord = coords[name];
  if (!coord) {
    throw new Error(
      `No coordinates for "${name}". Run \`pnpm run import:osm\` after adding it to data/source/stations.ts.`,
    );
  }
  return coord;
}

const STATUS_RANK: Record<LineStatus, number> = { operational: 0, opening_soon: 1, under_construction: 2 };

/** Resolves each station and each segment of a line to the section it belongs to. */
function resolveSections(def: LineDef) {
  const indexOf = (name: string) => {
    const index = def.stations.indexOf(name);
    if (index < 0) throw new Error(`Section boundary "${name}" is not a station on the ${def.id} line.`);
    return index;
  };
  const ranges = def.sections.map((section) => ({ section, from: indexOf(section.from), to: indexOf(section.to) }));
  for (const range of ranges) {
    if (range.from >= range.to) throw new Error(`Section ${range.section.from} → ${range.section.to} runs backwards.`);
  }

  const forSegment = (i: number): SectionDef => {
    const hit = ranges.filter((r) => i >= r.from && i < r.to);
    if (hit.length !== 1) {
      throw new Error(
        `Segment ${def.stations[i]} → ${def.stations[i + 1]} (${def.id}) is covered by ${hit.length} sections; expected exactly one.`,
      );
    }
    return hit[0].section;
  };

  // A boundary station belongs to whichever adjoining section is further along: open beats planned, earlier beats later.
  const forStation = (i: number): SectionDef => {
    const hit = ranges.filter((r) => i >= r.from && i <= r.to).map((r) => r.section);
    if (hit.length === 0) throw new Error(`Station ${def.stations[i]} (${def.id}) is not in any section.`);
    return hit.sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        (a.openDate ?? "9999").localeCompare(b.openDate ?? "9999"),
    )[0];
  };

  return { forSegment, forStation };
}

// Average scheduled speed including station dwell, ~32 km/h -> m/s.
const AVG_SPEED_MPS = (32 * 1000) / 3600;
const MIN_RUN_SECONDS = 60;

const stationById = new Map<string, Station>();
const segments: Segment[] = [];

for (const def of lineDefs) {
  const sections = resolveSections(def);

  // Straight-line hops undercount the track, which curves between stations.
  // Scale them so the line adds up to its published route length.
  const straight = def.stations
    .slice(1)
    .map((name, i) => haversineMeters(coordOf(def.stations[i]), coordOf(name)));
  const straightTotal = straight.reduce((sum, d) => sum + d, 0);
  const trackFactor = (def.lengthKm * 1000) / straightTotal;
  if (trackFactor < 0.97 || trackFactor > 1.25) {
    throw new Error(
      `${def.id}: published length ${def.lengthKm} km is ${trackFactor.toFixed(2)}× the straight-line station spacing ` +
        `(${(straightTotal / 1000).toFixed(2)} km). Check the station order, coordinates or lengthKm.`,
    );
  }

  def.stations.forEach((name, idx) => {
    const id = slugify(name);
    const section = sections.forStation(idx);
    const layout = def.underground.includes(name)
      ? ("underground" as const)
      : def.atGrade?.includes(name)
        ? ("at_grade" as const)
        : ("elevated" as const);
    const membership = {
      line: def.id,
      sequence: idx,
      status: section.status,
      openDate: section.openDate,
      expected: section.expected,
      layout,
    };
    const existing = stationById.get(id);
    const interchangeLines = interchanges[name];
    if (existing) {
      if (!interchangeLines || !interchangeLines.includes(def.id)) {
        throw new Error(
          `Station name collision on "${name}" (line ${def.id}) is not declared in the ` +
            `interchanges map in data/source/stations.ts. If this is a real interchange, add it ` +
            `there; if it's two different stations that happen to share a name, rename one.`,
        );
      }
      existing.lines.push(membership);
      if (STATUS_RANK[section.status] < STATUS_RANK[existing.status]) existing.status = section.status;
    } else {
      const coord = coordOf(name);
      stationById.set(id, {
        id,
        slug: id,
        name,
        nameKn: coord.nameKn,
        aliases: aliases[name] ?? [],
        lat: coord.lat,
        lng: coord.lng,
        coordConfidence: "surveyed",
        lines: [membership],
        // Set below, once every line has been read: it depends on how many are in service.
        interchange: false,
        interchangeWalkSeconds: interchangeWalkSeconds[name],
        exits: [],
        hasLift: true,
        hasEscalator: true,
        hasParking: false,
        status: section.status,
        source: `${def.source} ${COORD_SOURCE} (${coord.osm})`,
      });
    }
  });

  for (let i = 0; i < def.stations.length - 1; i++) {
    const section = sections.forSegment(i);
    const distance = Math.round(straight[i] * trackFactor);
    segments.push({
      line: def.id,
      from: slugify(def.stations[i]),
      to: slugify(def.stations[i + 1]),
      runSeconds: Math.max(MIN_RUN_SECONDS, Math.round(distance / AVG_SPEED_MPS)),
      distanceMeters: distance,
      status: section.status,
      openDate: section.openDate,
      expected: section.expected,
      source: `${def.source} Distance: OpenStreetMap station spacing scaled to the published ${def.lengthKm} km route length.`,
    });
  }
}

// A station is an interchange you can use only when two of its lines carry passengers.
for (const station of stationById.values()) {
  station.interchange = station.lines.filter((m) => m.status !== "under_construction").length > 1;
}

for (const name of Object.keys(interchanges)) {
  if (!stationById.has(slugify(name))) throw new Error(`Interchange "${name}" is not a station on any line.`);
}
for (const name of Object.keys(aliases)) {
  if (!stationById.has(slugify(name))) throw new Error(`Alias entry "${name}" is not a station on any line.`);
}

const lines: Line[] = lineDefs.map((def) => ({
  id: def.id,
  name: def.name,
  nameKn: def.nameKn,
  color: def.color,
  status: [...def.sections].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])[0].status,
  terminals: [def.stations[0], def.stations[def.stations.length - 1]] as [string, string],
  lengthKm: def.lengthKm,
  source: def.source,
}));

const network = {
  version: "2.0.0",
  generatedAt: new Date().toISOString(),
  lines,
  stations: Array.from(stationById.values()),
  segments,
  timetables,
  fares: fareRules,
};

const parsed = NetworkSchema.safeParse(network);
if (!parsed.success) {
  console.error("Network data failed validation:");
  console.error(parsed.error.format());
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, "network.json"), JSON.stringify(parsed.data, null, 2));
// Also published under /public so the service worker can fetch + cache it
// directly (the app itself uses the bundled import above, not this copy).
writeFileSync(resolve(PUBLIC_DATA_DIR, "network.json"), JSON.stringify(parsed.data));
writeFileSync(resolve(OUT_DIR, "lines.json"), JSON.stringify(parsed.data.lines, null, 2));
writeFileSync(resolve(OUT_DIR, "stations.json"), JSON.stringify(parsed.data.stations, null, 2));
writeFileSync(resolve(OUT_DIR, "segments.json"), JSON.stringify(parsed.data.segments, null, 2));
writeFileSync(resolve(OUT_DIR, "timetables.json"), JSON.stringify(parsed.data.timetables, null, 2));
writeFileSync(resolve(OUT_DIR, "fares.json"), JSON.stringify(parsed.data.fares, null, 2));

console.log(
  `Built network.json: ${parsed.data.stations.length} stations, ${parsed.data.segments.length} segments, ${parsed.data.lines.length} lines.`,
);

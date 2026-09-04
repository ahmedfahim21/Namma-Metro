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
  shortNames,
  type LineDef,
} from "../data/source/stations";
import { timetables } from "../data/source/timetables";
import { fareRules } from "../data/source/fares";
import { NetworkSchema, type Station, type Segment, type Line } from "../packages/network/src/schema";

const OUT_DIR = resolve(__dirname, "../data");
const PUBLIC_DATA_DIR = resolve(__dirname, "../public/data");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[(),.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Linearly interpolate lat/lng for every station index using the line's anchors. */
function interpolateCoords(def: LineDef): { lat: number; lng: number }[] {
  const anchors = [...def.anchors].sort((a, b) => a.index - b.index);
  const result: { lat: number; lng: number }[] = new Array(def.stations.length);
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    const span = b.index - a.index;
    for (let idx = a.index; idx <= b.index; idx++) {
      const t = span === 0 ? 0 : (idx - a.index) / span;
      result[idx] = {
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      };
    }
  }
  return result;
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

// Average scheduled speed including station dwell, ~32 km/h -> m/s.
const AVG_SPEED_MPS = (32 * 1000) / 3600;
const MIN_RUN_SECONDS = 60;

const stationById = new Map<string, Station>();
const segments: Segment[] = [];

for (const def of lineDefs) {
  const coords = interpolateCoords(def);
  def.stations.forEach((name, idx) => {
    const id = slugify(name);
    const existing = stationById.get(id);
    const interchangeLines = interchanges[name];
    const membership = { line: def.id, sequence: idx };
    if (existing) {
      if (!interchangeLines || !interchangeLines.includes(def.id)) {
        throw new Error(
          `Station name collision on "${name}" (line ${def.id}) is not declared in the ` +
            `interchanges map in data/source/stations.ts. If this is a real interchange, add it ` +
            `there; if it's two different stations that happen to share a name, rename one.`,
        );
      }
      existing.lines.push(membership);
      existing.interchange = true;
      if (interchangeWalkSeconds[name]) {
        existing.interchangeWalkSeconds = interchangeWalkSeconds[name];
      }
      // Keep the better coordinate confidence / status if this line is operational
      // and the previously-seen line for this station wasn't.
      if (def.status === "operational") existing.status = "operational";
    } else {
      stationById.set(id, {
        id,
        slug: id,
        name,
        shortName: shortNames[name],
        lat: coords[idx].lat,
        lng: coords[idx].lng,
        coordConfidence: "approximate",
        lines: [membership],
        interchange: Boolean(interchangeLines),
        interchangeWalkSeconds: interchangeWalkSeconds[name],
        exits: [],
        hasLift: true,
        hasEscalator: true,
        hasParking: false,
        status: def.status,
        source: def.source,
      });
    }
  });

  for (let i = 0; i < def.stations.length - 1; i++) {
    const fromName = def.stations[i];
    const toName = def.stations[i + 1];
    const fromId = slugify(fromName);
    const toId = slugify(toName);
    const distance = Math.max(
      300,
      Math.round(haversineMeters(coords[i], coords[i + 1])),
    );
    const runSeconds = Math.max(MIN_RUN_SECONDS, Math.round(distance / AVG_SPEED_MPS));
    segments.push({
      line: def.id,
      from: fromId,
      to: toId,
      runSeconds,
      distanceMeters: distance,
      source: def.source,
    });
  }
}

const lines: Line[] = lineDefs.map((def) => ({
  id: def.id,
  name: def.name,
  nameKn: def.nameKn,
  color: def.color,
  status: def.status,
  terminals: [def.stations[0], def.stations[def.stations.length - 1]] as [string, string],
  source: def.source,
}));

const network = {
  version: "1.0.0",
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

import network from "@/data/network.json";
import { createRouter } from "@/packages/routing/src/itinerary";
import type {
  Station,
  Segment,
  Line,
  LineId,
  FareRules,
  TimetableEntry,
} from "@/packages/network/src/schema";

export const stations = network.stations as Station[];
export const segments = network.segments as Segment[];
export const lines = network.lines as Line[];
export const fareRules = network.fares as FareRules;
export const timetables = network.timetables as TimetableEntry[];

export const lineById = new Map(lines.map((l) => [l.id, l]));
export const stationById = new Map(stations.map((s) => [s.id, s]));
export const stationBySlug = new Map(stations.map((s) => [s.slug, s]));

export function isRoutable(station: Station): boolean {
  return station.lines.some((m) => lineById.get(m.line)?.status === "operational");
}

export const routableStations = stations.filter(isRoutable);

// Only ride on segments of operational lines — a non-operational line (e.g.
// Pink, still under construction) can appear as station/interchange metadata
// for the map, but must never be usable as a through-route.
const operationalLineIds = new Set(
  lines.filter((l) => l.status === "operational").map((l) => l.id),
);
const routableSegments = segments.filter((s) => operationalLineIds.has(s.line));

let cachedRouter: ReturnType<typeof createRouter> | null = null;
export function getRouter() {
  if (!cachedRouter) cachedRouter = createRouter(stations, routableSegments);
  return cachedRouter;
}

/**
 * What to show in UI chrome where space is tight. Page titles, metadata and
 * search keep the full official `name`.
 */
export function displayName(station: Pick<Station, "name" | "shortName">): string {
  return station.shortName ?? station.name;
}

export function displayNameById(id: string): string {
  const station = stationById.get(id);
  return station ? displayName(station) : id;
}

/** Sequence number of a station on a given line, if it's served by that line. */
export function sequenceOf(stationId: string, line: string): number | undefined {
  return stationById.get(stationId)?.lines.find((m) => m.line === line)?.sequence;
}

/**
 * The terminal a train is heading for — what's actually written on the
 * platform indicator. `directionIndex` 0 travels in increasing station
 * sequence, so it heads for the second terminal.
 */
export function towardsTerminal(line: LineId, directionIndex: 0 | 1): string | undefined {
  const terminal = lineById.get(line)?.terminals[directionIndex === 0 ? 1 : 0];
  if (!terminal) return undefined;
  const station = stations.find((s) => s.name === terminal);
  return station ? displayName(station) : terminal;
}

/**
 * Station search. An empty query returns interchanges and terminals — the
 * stations someone is most likely to want — so focusing an empty field still
 * offers something useful instead of a blank dropdown.
 */
export function searchStations(query: string, limit = 8, excludeId?: string): Station[] {
  const pool = excludeId ? routableStations.filter((s) => s.id !== excludeId) : routableStations;
  const q = query.trim().toLowerCase();

  if (!q) {
    return pool.filter((s) => s.interchange || isTerminal(s)).slice(0, limit);
  }

  // Score against both the official name and the familiar short name, so
  // "RV Road" finds "Rashtreeya Vidyalaya Road" and "kempegowda" finds
  // "Nadaprabhu Kempegowda Station, Majestic".
  function scoreOf(candidate: string): number {
    const name = candidate.toLowerCase();
    if (name === q) return 100;
    if (name.startsWith(q)) return 80;
    if (name.split(/[\s,()./]+/).some((w) => w.startsWith(q))) return 65;
    if (name.includes(q)) return 50;
    return -1;
  }

  return pool
    .map((s) => {
      let score = Math.max(scoreOf(s.name), s.shortName ? scoreOf(s.shortName) : -1);
      if (score < 0 && s.nameKn?.includes(query)) score = 40;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.name.length - b.s.name.length)
    .slice(0, limit)
    .map((x) => x.s);
}

const maxSequenceByLine = new Map<string, number>();
for (const s of stations) {
  for (const m of s.lines) {
    maxSequenceByLine.set(m.line, Math.max(maxSequenceByLine.get(m.line) ?? 0, m.sequence));
  }
}

export function isTerminal(station: Station): boolean {
  return station.lines.some((m) => m.sequence === 0 || m.sequence === maxSequenceByLine.get(m.line));
}

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestStations(lat: number, lng: number, limit = 5): (Station & { distanceMeters: number })[] {
  return routableStations
    .map((s) => ({ ...s, distanceMeters: haversineMeters({ lat, lng }, s) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

import network from "@/data/network.json";
import { createRouter } from "@/packages/routing/src/itinerary";
import type { Station, Segment, Line, FareRules, TimetableEntry } from "@/packages/network/src/schema";
import { isInService } from "@/packages/network/src/status";

export const stations = network.stations as Station[];
export const segments = network.segments as Segment[];
export const lines = network.lines as Line[];
export const fareRules = network.fares as FareRules;
export const timetables = network.timetables as TimetableEntry[];

export const lineById = new Map(lines.map((l) => [l.id, l]));
export const stationById = new Map(stations.map((s) => [s.id, s]));
export const stationBySlug = new Map(stations.map((s) => [s.slug, s]));

/** A station you can plan a trip to: at least one of its lines is open or has an opening day. */
export function isRoutable(station: Station): boolean {
  return station.lines.some(isInService);
}

export const routableStations = stations.filter(isRoutable);

// Sections still under construction (e.g. the Pink Line tunnel north of
// Tavarekere) are drawn on the map but must never be usable as a through-route.
export const routableSegments = segments.filter(isInService);

let cachedRouter: ReturnType<typeof createRouter> | null = null;
export function getRouter() {
  if (!cachedRouter) cachedRouter = createRouter(stations, routableSegments);
  return cachedRouter;
}

/** Sequence number of a station on a given line, if it's served by that line. */
export function sequenceOf(stationId: string, line: string): number | undefined {
  return stationById.get(stationId)?.lines.find((m) => m.line === line)?.sequence;
}

export function searchStations(query: string, limit = 8): Station[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = routableStations
    .map((s) => {
      const name = s.name.toLowerCase();
      let score = -1;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 50;
      else if (s.aliases.some((a) => a.toLowerCase() === q)) score = 90;
      else if (s.aliases.some((a) => a.toLowerCase().startsWith(q))) score = 70;
      else if (s.aliases.some((a) => a.toLowerCase().includes(q))) score = 45;
      else if (s.nameKn?.includes(query.trim())) score = 40;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.name.length - b.s.name.length);
  return scored.slice(0, limit).map((x) => x.s);
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

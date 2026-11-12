import networkJson from "../../../data/network.json";
import { isInService } from "./status";
import { NetworkSchema, type Network, type Station, type Line, type Segment } from "./schema";

let cached: Network | null = null;

/** Loads and validates the built network dataset. Cheap after the first call. */
export function loadNetwork(): Network {
  if (cached) return cached;
  const parsed = NetworkSchema.parse(networkJson);
  cached = parsed;
  return parsed;
}

export function getStations(): Station[] {
  return loadNetwork().stations;
}

export function getLines(): Line[] {
  return loadNetwork().lines;
}

export function getSegments(): Segment[] {
  return loadNetwork().segments;
}

export function getStationById(id: string): Station | undefined {
  return getStations().find((s) => s.id === id);
}

export function getStationBySlug(slug: string): Station | undefined {
  return getStations().find((s) => s.slug === slug);
}

/** Routable stations: at least one line there is open or has an opening day. */
export function getRoutableStations(): Station[] {
  return getStations().filter((s) => s.lines.some(isInService));
}

export function getLineById(id: string) {
  return getLines().find((l) => l.id === id);
}

export * from "./schema";
export { networkJson };

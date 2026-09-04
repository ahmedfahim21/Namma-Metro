import networkJson from "../../../data/network.json";
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

/** Routable stations: on at least one operational line. */
export function getRoutableStations(): Station[] {
  return getStations().filter((s) =>
    s.lines.some((m) => {
      const line = getLines().find((l) => l.id === m.line);
      return line?.status === "operational";
    }),
  );
}

export function getLineById(id: string) {
  return getLines().find((l) => l.id === id);
}

export * from "./schema";
export { networkJson };

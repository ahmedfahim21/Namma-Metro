import type { Station, LineId, Segment } from "../../network/src/schema";
import { buildGraph, type LineNode } from "./graph";
import { shortestPath, type PathStep } from "./dijkstra";

export interface Leg {
  line: LineId;
  boardStation: string;
  alightStation: string;
  /** Ordered list of station ids ridden on this leg, board through alight inclusive. */
  stations: string[];
  durationSeconds: number;
  distanceMeters: number;
}

export interface InterchangeStep {
  station: string;
  fromLine: LineId;
  toLine: LineId;
  walkSeconds: number;
}

export type ItineraryLabel = "fastest" | "fewest_interchanges" | "least_walking" | "cheapest";

export interface Itinerary {
  id: string;
  labels: ItineraryLabel[];
  legs: Leg[];
  interchanges: InterchangeStep[];
  totalRideSeconds: number;
  totalWalkSeconds: number;
  totalDurationSeconds: number;
  totalDistanceMeters: number;
  /** Total stops traversed across the whole trip (used for the fare engine). */
  totalStops: number;
  originStation: string;
  destinationStation: string;
}

const BIG = 1_000_000;

const WEIGHTERS: Record<ItineraryLabel, (kind: "ride" | "transfer", seconds: number) => number> = {
  fastest: (_kind, seconds) => seconds,
  fewest_interchanges: (kind, seconds) => (kind === "transfer" ? BIG + seconds : seconds),
  least_walking: (kind, seconds) => (kind === "transfer" ? seconds * BIG : seconds),
  cheapest: (kind, seconds) => (kind === "ride" ? BIG + seconds : seconds),
};

/** Builds a routable graph plus a distance lookup for ride edges. */
export function createRouter(stations: Station[], segments: Segment[]) {
  const graph = buildGraph(stations, segments);
  const distanceByEdge = new Map<string, number>();
  for (const seg of segments) {
    distanceByEdge.set(`${seg.line}::${seg.from}->${seg.to}`, seg.distanceMeters);
    distanceByEdge.set(`${seg.line}::${seg.to}->${seg.from}`, seg.distanceMeters);
  }
  const stationById = new Map(stations.map((s) => [s.id, s]));

  function pathToItinerary(path: PathStep[], labels: ItineraryLabel[]): Itinerary {
    const legs: Leg[] = [];
    const interchanges: InterchangeStep[] = [];
    let totalRideSeconds = 0;
    let totalWalkSeconds = 0;
    let totalDistanceMeters = 0;
    let totalStops = 0;

    let currentLeg: Leg | null = null;

    for (let i = 1; i < path.length; i++) {
      const step = path[i];
      const prevNode = path[i - 1].node;
      const edge = step.edge!;
      if (edge.kind === "ride") {
        const distKey = `${prevNode.line}::${prevNode.station}->${step.node.station}`;
        const distance = distanceByEdge.get(distKey) ?? 0;
        if (!currentLeg || currentLeg.line !== prevNode.line) {
          currentLeg = {
            line: prevNode.line,
            boardStation: prevNode.station,
            alightStation: step.node.station,
            stations: [prevNode.station, step.node.station],
            durationSeconds: edge.seconds,
            distanceMeters: distance,
          };
          legs.push(currentLeg);
        } else {
          currentLeg.alightStation = step.node.station;
          currentLeg.stations.push(step.node.station);
          currentLeg.durationSeconds += edge.seconds;
          currentLeg.distanceMeters += distance;
        }
        totalRideSeconds += edge.seconds;
        totalDistanceMeters += distance;
        totalStops += 1;
      } else {
        interchanges.push({
          station: prevNode.station,
          fromLine: prevNode.line,
          toLine: step.node.line,
          walkSeconds: edge.seconds,
        });
        totalWalkSeconds += edge.seconds;
        currentLeg = null;
      }
    }

    const origin = path[0].node.station;
    const destination = path[path.length - 1].node.station;

    return {
      id: `${origin}->${destination}:${labels.join("+")}`,
      labels,
      legs,
      interchanges,
      totalRideSeconds,
      totalWalkSeconds,
      totalDurationSeconds: totalRideSeconds + totalWalkSeconds,
      totalDistanceMeters,
      totalStops,
      originStation: origin,
      destinationStation: destination,
    };
  }

  function pathSignature(path: PathStep[]): string {
    return path.map((s) => `${s.node.station}:${s.node.line}`).join("|");
  }

  /**
   * Plans a trip from `originId` to `destinationId`, returning up to four
   * labelled itineraries (fastest / fewest interchanges / least walking /
   * cheapest), deduplicated when two criteria produce the same physical path.
   */
  function planTrip(originId: string, destinationId: string): Itinerary[] {
    const origin = stationById.get(originId);
    const destination = stationById.get(destinationId);
    if (!origin || !destination) return [];

    const sources: LineNode[] = origin.lines.map((m) => ({ station: origin.id, line: m.line }));
    const targets: LineNode[] = destination.lines.map((m) => ({ station: destination.id, line: m.line }));

    const byPath = new Map<string, { path: PathStep[]; labels: ItineraryLabel[] }>();

    for (const label of Object.keys(WEIGHTERS) as ItineraryLabel[]) {
      const weighter = WEIGHTERS[label];
      const path = shortestPath(graph, sources, targets, (edge) => weighter(edge.kind, edge.seconds));
      if (!path) continue;
      const sig = pathSignature(path);
      const existing = byPath.get(sig);
      if (existing) {
        existing.labels.push(label);
      } else {
        byPath.set(sig, { path, labels: [label] });
      }
    }

    return Array.from(byPath.values())
      .map(({ path, labels }) => pathToItinerary(path, labels))
      .sort((a, b) => a.totalDurationSeconds - b.totalDurationSeconds);
  }

  return { graph, planTrip };
}

export type Router = ReturnType<typeof createRouter>;

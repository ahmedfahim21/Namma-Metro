import type { Station, Segment, LineId } from "../../network/src/schema";

/** A node in the line-expanded graph: a station while riding a specific line. */
export interface LineNode {
  station: string;
  line: LineId;
}

export interface Edge {
  to: LineNode;
  kind: "ride" | "transfer";
  seconds: number;
  /** Only set for "ride" edges: the physical stop being passed through. */
  viaStation?: string;
}

export function nodeKey(n: LineNode): string {
  return `${n.station}::${n.line}`;
}

export interface Graph {
  adjacency: Map<string, Edge[]>;
  nodesByStation: Map<string, LineNode[]>;
}

const DEFAULT_TRANSFER_SECONDS = 150;

/**
 * Builds a line-expanded graph: each node is (station, line). Riding a
 * segment moves along the same line; transferring at an interchange station
 * moves to a different line at the same station, at the cost of the walk
 * time between platforms.
 */
export function buildGraph(stations: Station[], segments: Segment[]): Graph {
  const adjacency = new Map<string, Edge[]>();
  const nodesByStation = new Map<string, LineNode[]>();

  function ensureNode(n: LineNode) {
    const key = nodeKey(n);
    if (!adjacency.has(key)) adjacency.set(key, []);
    const list = nodesByStation.get(n.station) ?? [];
    if (!list.some((x) => x.line === n.line)) list.push(n);
    nodesByStation.set(n.station, list);
  }

  function addEdge(from: LineNode, edge: Edge) {
    ensureNode(from);
    adjacency.get(nodeKey(from))!.push(edge);
  }

  for (const station of stations) {
    for (const membership of station.lines) {
      ensureNode({ station: station.id, line: membership.line });
    }
  }

  for (const seg of segments) {
    const a: LineNode = { station: seg.from, line: seg.line };
    const b: LineNode = { station: seg.to, line: seg.line };
    addEdge(a, { to: b, kind: "ride", seconds: seg.runSeconds, viaStation: seg.to });
    addEdge(b, { to: a, kind: "ride", seconds: seg.runSeconds, viaStation: seg.from });
  }

  for (const station of stations) {
    if (!station.interchange || station.lines.length < 2) continue;
    const walkSeconds = station.interchangeWalkSeconds ?? DEFAULT_TRANSFER_SECONDS;
    for (const a of station.lines) {
      for (const b of station.lines) {
        if (a.line === b.line) continue;
        addEdge(
          { station: station.id, line: a.line },
          { to: { station: station.id, line: b.line }, kind: "transfer", seconds: walkSeconds },
        );
      }
    }
  }

  return { adjacency, nodesByStation };
}

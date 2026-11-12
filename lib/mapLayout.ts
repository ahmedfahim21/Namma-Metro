import type { Line, LineId, Station } from "@/packages/network/src/schema";
import { stations as allStations, lines as allLines } from "@/lib/network";

/**
 * Schematic ("octilinear") map layout.
 *
 * Real coordinates make a metro map look like a scribble: stations bunch up
 * downtown, and small survey errors show up as kinks. Every published metro
 * map instead snaps lines to 0/45/90 degree runs with evenly spaced stations.
 * We do the same here: interchanges and terminals keep their geographic
 * position (so the map still reads like Bengaluru), and every run between two
 * of those anchors becomes at most two straight strokes with the intermediate
 * stations spread evenly along it.
 */

export interface LayoutPoint {
  x: number;
  y: number;
  /** Set when this vertex is a station rather than a bend in the line. */
  stationId?: string;
}

export interface LineGeometry {
  line: LineId;
  status: Line["status"];
  points: LayoutPoint[];
}

export type LabelPlacement = "right" | "left" | "diagonal";

export interface MapLayout {
  width: number;
  height: number;
  /** Tight bounding box of everything drawn, before any framing padding. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  positions: Map<string, { x: number; y: number }>;
  geometries: LineGeometry[];
  /** Where a station's name should sit relative to its dot. */
  labels: Map<string, LabelPlacement>;
}

const WIDTH = 1000;
const HEIGHT = 820;
const PADDING = 64;
const EPS = 1e-6;

type Pt = { x: number; y: number };

function distance(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Perpendicular distance from `p` to the segment `a`–`b`. */
function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (len2 < EPS) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
  return distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

function distanceToPolyline(p: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) best = Math.min(best, distanceToSegment(p, poly[i - 1], poly[i]));
  return best;
}

/** Point at arc-length `s` along a polyline. */
function pointAtLength(poly: Pt[], s: number): Pt {
  let remaining = s;
  for (let i = 1; i < poly.length; i++) {
    const segment = distance(poly[i - 1], poly[i]);
    if (remaining <= segment || i === poly.length - 1) {
      const t = segment < EPS ? 0 : Math.max(0, Math.min(1, remaining / segment));
      return {
        x: poly[i - 1].x + (poly[i].x - poly[i - 1].x) * t,
        y: poly[i - 1].y + (poly[i].y - poly[i - 1].y) * t,
      };
    }
    remaining -= segment;
  }
  return poly[poly.length - 1];
}

/**
 * The octilinear route between two anchors: a 45-degree diagonal plus a
 * straight run, ordered whichever way tracks the real stations more closely.
 */
function octilinearRun(a: Pt, b: Pt, via: Pt[]): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const diagonal = Math.min(Math.abs(dx), Math.abs(dy));
  // Already axis-aligned or already a perfect diagonal — a single stroke does it.
  if (diagonal < EPS || Math.abs(Math.abs(dx) - Math.abs(dy)) < EPS) return [a, b];

  const step = { x: Math.sign(dx) * diagonal, y: Math.sign(dy) * diagonal };
  const diagonalFirst = [a, { x: a.x + step.x, y: a.y + step.y }, b];
  const straightFirst = [a, { x: b.x - step.x, y: b.y - step.y }, b];
  if (via.length === 0) return diagonalFirst;

  const error = (poly: Pt[]) => via.reduce((sum, p) => sum + distanceToPolyline(p, poly), 0);
  return error(diagonalFirst) <= error(straightFirst) ? diagonalFirst : straightFirst;
}

/**
 * Stations where the real line changes bearing sharply. Treating them as
 * anchors is what turns a long meandering run into the L-shaped strokes a
 * metro map is made of, instead of one averaged diagonal.
 */
function corners(points: Pt[]): number[] {
  const found: number[] = [];
  let lastCorner = 0;
  for (let i = 2; i < points.length - 2; i++) {
    const before = points[Math.max(0, i - 2)];
    const after = points[Math.min(points.length - 1, i + 2)];
    const inAngle = Math.atan2(points[i].y - before.y, points[i].x - before.x);
    const outAngle = Math.atan2(after.y - points[i].y, after.x - points[i].x);
    let turn = Math.abs(((outAngle - inAngle) * 180) / Math.PI);
    if (turn > 180) turn = 360 - turn;
    // Ignore wobble, and keep corners a few stations apart so short kinks in
    // the survey data don't shred a line into fragments.
    if (turn > 42 && i - lastCorner >= 3) {
      found.push(i);
      lastCorner = i;
    }
  }
  return found;
}

function labelPlacement(before: Pt | undefined, at: Pt, after: Pt | undefined): LabelPlacement {
  const from = before ?? at;
  const to = after ?? at;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx < EPS && dy < EPS) return "right";
  // Vertical runs have room for a plain horizontal label beside the dot;
  // horizontal and diagonal runs would collide, so those names go on a slant.
  return dy > dx * 1.5 ? "right" : "diagonal";
}

export function buildLayout(stations: Station[], lines: Line[]): MapLayout {
  const byId = new Map(stations.map((s) => [s.id, s]));
  const avgLat = stations.reduce((sum, s) => sum + s.lat, 0) / stations.length;
  const lngScale = Math.cos((avgLat * Math.PI) / 180);
  const raw = new Map<string, Pt>(
    stations.map((s) => [s.id, { x: s.lng * lngScale, y: -s.lat }]),
  );

  const ordered = new Map<string, Station[]>();
  for (const line of lines) {
    const onLine = stations
      .filter((s) => s.lines.some((m) => m.line === line.id))
      .sort(
        (a, b) =>
          (a.lines.find((m) => m.line === line.id)?.sequence ?? 0) -
          (b.lines.find((m) => m.line === line.id)?.sequence ?? 0),
      );
    ordered.set(line.id, onLine);
  }

  // Anchors keep their real position: interchanges (shared by two lines, so
  // they must agree) and terminals (they shape the overall silhouette).
  const anchors = new Set<string>();
  for (const s of stations) if (s.lines.length > 1) anchors.add(s.id);
  for (const line of lines) {
    const onLine = ordered.get(line.id) ?? [];
    if (onLine.length === 0) continue;
    anchors.add(onLine[0].id);
    anchors.add(onLine[onLine.length - 1].id);
    for (const i of corners(onLine.map((s) => raw.get(s.id)!))) anchors.add(onLine[i].id);
  }

  const positions = new Map<string, Pt>();
  for (const id of anchors) positions.set(id, raw.get(id)!);

  const geometries: LineGeometry[] = [];
  for (const line of lines) {
    const onLine = ordered.get(line.id) ?? [];
    if (onLine.length < 2) continue;

    const anchorIndices = onLine
      .map((s, i) => (anchors.has(s.id) ? i : -1))
      .filter((i) => i >= 0);

    const points: LayoutPoint[] = [{ ...positions.get(onLine[0].id)!, stationId: onLine[0].id }];

    for (let k = 1; k < anchorIndices.length; k++) {
      const startIndex = anchorIndices[k - 1];
      const endIndex = anchorIndices[k];
      const between = onLine.slice(startIndex + 1, endIndex);
      const a = positions.get(onLine[startIndex].id)!;
      const b = positions.get(onLine[endIndex].id)!;
      const poly = octilinearRun(a, b, between.map((s) => raw.get(s.id)!));

      const total = poly.slice(1).reduce((sum, p, i) => sum + distance(poly[i], p), 0);
      const spacing = total / (between.length + 1);

      // Bends and stations both land on the run; emit them in arc-length order.
      const bendLengths =
        poly.length === 3 ? [distance(poly[0], poly[1])] : [];
      const stops = between.map((s, i) => ({ s: spacing * (i + 1), stationId: s.id }));
      const vertices = [...stops, ...bendLengths.map((s) => ({ s, stationId: undefined }))].sort(
        (p, q) => p.s - q.s,
      );

      for (const vertex of vertices) {
        const p = pointAtLength(poly, vertex.s);
        if (vertex.stationId) positions.set(vertex.stationId, p);
        points.push({ ...p, stationId: vertex.stationId });
      }
      points.push({ ...b, stationId: onLine[endIndex].id });
    }

    geometries.push({ line: line.id, status: line.status, points });
  }

  // Fit everything into the canvas.
  const xs = geometries.flatMap((g) => g.points.map((p) => p.x));
  const ys = geometries.flatMap((g) => g.points.map((p) => p.y));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(
    (WIDTH - 2 * PADDING) / (maxX - minX || 1),
    (HEIGHT - 2 * PADDING) / (maxY - minY || 1),
  );
  const offsetX = PADDING + (WIDTH - 2 * PADDING - (maxX - minX) * scale) / 2;
  const offsetY = PADDING + (HEIGHT - 2 * PADDING - (maxY - minY) * scale) / 2;
  const toCanvas = (p: Pt): Pt => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (p.y - minY) * scale,
  });

  for (const [id, p] of positions) positions.set(id, toCanvas(p));
  for (const geometry of geometries) {
    geometry.points = geometry.points.map((p) => ({ ...toCanvas(p), stationId: p.stationId }));
  }

  const labels = new Map<string, LabelPlacement>();
  for (const geometry of geometries) {
    geometry.points.forEach((p, i) => {
      if (!p.stationId) return;
      const station = byId.get(p.stationId);
      // An interchange is drawn once; the first line to claim it wins.
      if (labels.has(p.stationId) && !station?.interchange) return;
      labels.set(p.stationId, labelPlacement(geometry.points[i - 1], p, geometry.points[i + 1]));
    });
  }

  const drawn = geometries.flatMap((g) => g.points);
  const bounds = {
    minX: Math.min(...drawn.map((p) => p.x)),
    minY: Math.min(...drawn.map((p) => p.y)),
    maxX: Math.max(...drawn.map((p) => p.x)),
    maxY: Math.max(...drawn.map((p) => p.y)),
  };

  return { width: WIDTH, height: HEIGHT, bounds, positions, geometries, labels };
}

/** Smallest view of `box` that keeps `aspect` and leaves `pad` around it. */
export function frameBox(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  aspect: number,
  pad = 0,
): { x: number; y: number; w: number; h: number } {
  let w = box.maxX - box.minX + pad * 2;
  let h = box.maxY - box.minY + pad * 2;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return {
    x: (box.minX + box.maxX) / 2 - w / 2,
    y: (box.minY + box.maxY) / 2 - h / 2,
    w,
    h,
  };
}

let cached: MapLayout | null = null;

export function getMapLayout(): MapLayout {
  if (!cached) cached = buildLayout(allStations, allLines);
  return cached;
}

/**
 * The vertices a train travels between two stations of one line, following the
 * drawn geometry (so it turns where the line turns) rather than cutting corners.
 */
export function legPolyline(geometry: LineGeometry, fromStation: string, toStation: string): Pt[] {
  const from = geometry.points.findIndex((p) => p.stationId === fromStation);
  const to = geometry.points.findIndex((p) => p.stationId === toStation);
  if (from < 0 || to < 0) return [];
  const slice = geometry.points.slice(Math.min(from, to), Math.max(from, to) + 1);
  const points = from <= to ? slice : [...slice].reverse();
  return points.map((p) => ({ x: p.x, y: p.y }));
}

/** SVG path data for a polyline, with the corners rounded off. */
export function roundedPath(points: Pt[], radius = 10): string {
  if (points.length === 0) return "";
  if (points.length < 3) return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const inLen = distance(prev, curr);
    const outLen = distance(curr, next);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r < 0.5) {
      d += ` L${curr.x.toFixed(2)},${curr.y.toFixed(2)}`;
      continue;
    }
    const start = {
      x: curr.x + ((prev.x - curr.x) / inLen) * r,
      y: curr.y + ((prev.y - curr.y) / inLen) * r,
    };
    const end = {
      x: curr.x + ((next.x - curr.x) / outLen) * r,
      y: curr.y + ((next.y - curr.y) / outLen) * r,
    };
    d += ` L${start.x.toFixed(2)},${start.y.toFixed(2)} Q${curr.x.toFixed(2)},${curr.y.toFixed(2)} ${end.x.toFixed(2)},${end.y.toFixed(2)}`;
  }
  const last = points[points.length - 1];
  d += ` L${last.x.toFixed(2)},${last.y.toFixed(2)}`;
  return d;
}

// ---------------------------------------------------------------------------
// Train travel
// ---------------------------------------------------------------------------

export interface TravelLeg {
  points: Pt[];
  /** Cumulative arc length at each point; index 0 is 0. */
  length: number[];
}

export interface TrainPose {
  x: number;
  y: number;
  /** Degrees, matching the SVG rotate() convention. */
  angle: number;
  legIndex: number;
}

export interface TrainTimeline {
  /** Length of one full loop, in milliseconds. */
  cycle: number;
  at(elapsedMs: number): TrainPose;
}

export function cumulativeLengths(points: Pt[]): number[] {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
  return cumulative;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * A looping ride along the route: each leg is eased so the train pulls away and
 * brakes rather than sliding at a constant speed, holds at every interchange,
 * then waits at the destination before starting over.
 */
export function createTrainTimeline(
  legs: TravelLeg[],
  { dwellMs = 700, endHoldMs = 1100 }: { dwellMs?: number; endHoldMs?: number } = {},
): TrainTimeline | null {
  const usable = legs.filter((leg) => leg.points.length >= 2 && leg.length[leg.length.length - 1] > 0);
  if (usable.length === 0) return null;

  const total = usable.reduce((sum, leg) => sum + leg.length[leg.length.length - 1], 0);
  const stops = usable.reduce((sum, leg) => sum + leg.points.length, 0);
  const rideMs = Math.min(14_000, Math.max(4_500, 260 * stops));
  const entries = usable.map((leg) => ({
    leg,
    duration: rideMs * (leg.length[leg.length.length - 1] / total),
  }));
  const cycle = rideMs + dwellMs * (entries.length - 1) + endHoldMs;

  function poseOn(leg: TravelLeg, progress: number, legIndex: number): TrainPose {
    const target = leg.length[leg.length.length - 1] * progress;
    let i = 1;
    while (i < leg.length.length - 1 && leg.length[i] < target) i++;
    const span = leg.length[i] - leg.length[i - 1];
    const t = span < EPS ? 0 : (target - leg.length[i - 1]) / span;
    const a = leg.points[i - 1];
    const b = leg.points[i];
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      legIndex,
    };
  }

  return {
    cycle,
    at(elapsedMs: number): TrainPose {
      let t = ((elapsedMs % cycle) + cycle) % cycle;
      for (let i = 0; i < entries.length; i++) {
        if (t < entries[i].duration) return poseOn(entries[i].leg, easeInOutCubic(t / entries[i].duration), i);
        t -= entries[i].duration;
        // Dwell at the interchange (or the end-of-line hold on the last leg).
        if (t < dwellMs || i === entries.length - 1) return poseOn(entries[i].leg, 1, i);
        t -= dwellMs;
      }
      return poseOn(entries[entries.length - 1].leg, 1, entries.length - 1);
    },
  };
}

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
  /**
   * Set on a bend: the stations either side of it and how far between them it
   * sits (0–1). Lets the bend follow its stations when they move to another
   * arrangement, e.g. geographic or travel-time.
   */
  bend?: { from: string; to: string; t: number };
}

export interface LineGeometry {
  line: LineId;
  points: LayoutPoint[];
}

/** One arrangement of the network: where each station is and how each line runs. */
export interface MapFrame {
  positions: Map<string, Pt>;
  geometries: LineGeometry[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export type LabelPlacement = "right" | "left" | "above" | "below" | "diagonal";

export interface MapLayout {
  width: number;
  height: number;
  /** Tight bounding box of everything drawn, before any framing padding. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  positions: Map<string, { x: number; y: number }>;
  geometries: LineGeometry[];
  /** Where a station's name should sit relative to its dot. */
  labels: Map<string, LabelPlacement>;
  /** True geographic positions (equirectangular), fitted to the same canvas. */
  geo: Map<string, { x: number; y: number }>;
  /** Label sides for interchanges and terminals when drawn at their geographic positions. */
  geoLabels: Map<string, LabelPlacement>;
}

const WIDTH = 1000;
const HEIGHT = 820;
const PADDING = 64;
const EPS = 1e-6;

export type Pt = { x: number; y: number };

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

/**
 * The name to print beside a station on the map. Official names can run to
 * fifty characters ("Sri Balagangadharanatha Swamiji Station, Hosahalli"), so
 * long ones fall back to the everyday name people use for the place.
 */
export function mapLabel(station: Station): string {
  return station.name.length > 24 && station.aliases.length > 0 ? station.aliases[0] : station.name;
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

/**
 * Interchanges and terminals are labelled at every zoom, so their names get
 * the clearest of the four sides: away from the lines and from each other.
 */
function prominentLabels(
  stations: Station[],
  positions: Map<string, Pt>,
  geometries: LineGeometry[],
): Map<string, LabelPlacement> {
  const labels = new Map<string, LabelPlacement>();
  const samples: Pt[] = [];
  for (const geometry of geometries) {
    for (let i = 1; i < geometry.points.length; i++) {
      const a = geometry.points[i - 1];
      const b = geometry.points[i];
      const steps = Math.max(1, Math.ceil(distance(a, b) / 5));
      for (let k = 0; k <= steps; k++) {
        samples.push({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps });
      }
    }
  }
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const prominent = stations.filter(
    (s) =>
      s.interchange ||
      geometries.some(
        (g) => g.points[0].stationId === s.id || g.points[g.points.length - 1].stationId === s.id,
      ),
  );
  for (const station of prominent) {
    const p = positions.get(station.id)!;
    const width = mapLabel(station).length * 6.4 + 6;
    const boxes: [LabelPlacement, { x0: number; y0: number; x1: number; y1: number }][] = [
      ["right", { x0: p.x + 10, y0: p.y - 8, x1: p.x + 12 + width, y1: p.y + 8 }],
      ["left", { x0: p.x - 12 - width, y0: p.y - 8, x1: p.x - 10, y1: p.y + 8 }],
      ["above", { x0: p.x - width / 2, y0: p.y - 28, x1: p.x + width / 2, y1: p.y - 11 }],
      ["below", { x0: p.x - width / 2, y0: p.y + 11, x1: p.x + width / 2, y1: p.y + 28 }],
    ];
    let best = boxes[0];
    let bestScore = Infinity;
    for (const candidate of boxes) {
      const box = candidate[1];
      const onLine = samples.filter((q) => q.x > box.x0 && q.x < box.x1 && q.y > box.y0 && q.y < box.y1).length;
      const onLabel = placed.filter(
        (o) => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0,
      ).length;
      const score = onLine + onLabel * 200;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    labels.set(station.id, best[0]);
    placed.push(best[1]);
  }

  return labels;
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
      const vertices = [
        ...stops,
        ...bendLengths.map((s) => ({ s, stationId: undefined as string | undefined })),
      ].sort((p, q) => p.s - q.s);
      // Every station on the run with its arc length, so a bend knows its neighbours.
      const marks = [
        { s: 0, stationId: onLine[startIndex].id },
        ...stops,
        { s: total, stationId: onLine[endIndex].id },
      ];

      for (const vertex of vertices) {
        const p = pointAtLength(poly, vertex.s);
        if (vertex.stationId) {
          positions.set(vertex.stationId, p);
          points.push({ ...p, stationId: vertex.stationId });
          continue;
        }
        const next = marks.findIndex((m) => m.s > vertex.s);
        const before = marks[next - 1];
        const after = marks[next];
        points.push({
          ...p,
          bend: {
            from: before.stationId,
            to: after.stationId,
            t: (vertex.s - before.s) / (after.s - before.s),
          },
        });
      }
      points.push({ ...b, stationId: onLine[endIndex].id });
    }

    geometries.push({ line: line.id, points });
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
    geometry.points = geometry.points.map((p) => ({ ...p, ...toCanvas(p) }));
  }

  const labels = new Map<string, LabelPlacement>();
  for (const geometry of geometries) {
    geometry.points.forEach((p, i) => {
      if (!p.stationId) return;
      const station = byId.get(p.stationId);
      // A shared station is drawn once; the first line to claim it wins.
      if (labels.has(p.stationId)) return;
      if (!station) return;
      labels.set(p.stationId, labelPlacement(geometry.points[i - 1], p, geometry.points[i + 1]));
    });
  }

  for (const [id, placement] of prominentLabels(stations, positions, geometries)) labels.set(id, placement);

  const drawn = geometries.flatMap((g) => g.points);
  const bounds = {
    minX: Math.min(...drawn.map((p) => p.x)),
    minY: Math.min(...drawn.map((p) => p.y)),
    maxX: Math.max(...drawn.map((p) => p.x)),
    maxY: Math.max(...drawn.map((p) => p.y)),
  };

  // The same stations at their true positions, fitted to the canvas on their own terms.
  const rawAll = stations.map((s) => raw.get(s.id)!);
  const gMinX = Math.min(...rawAll.map((p) => p.x));
  const gMaxX = Math.max(...rawAll.map((p) => p.x));
  const gMinY = Math.min(...rawAll.map((p) => p.y));
  const gMaxY = Math.max(...rawAll.map((p) => p.y));
  const gScale = Math.min(
    (WIDTH - 2 * PADDING) / (gMaxX - gMinX || 1),
    (HEIGHT - 2 * PADDING) / (gMaxY - gMinY || 1),
  );
  const gOffsetX = PADDING + (WIDTH - 2 * PADDING - (gMaxX - gMinX) * gScale) / 2;
  const gOffsetY = PADDING + (HEIGHT - 2 * PADDING - (gMaxY - gMinY) * gScale) / 2;
  const geo = new Map<string, Pt>(
    stations.map((s) => {
      const p = raw.get(s.id)!;
      return [s.id, { x: gOffsetX + (p.x - gMinX) * gScale, y: gOffsetY + (p.y - gMinY) * gScale }];
    }),
  );

  const layout: MapLayout = {
    width: WIDTH,
    height: HEIGHT,
    bounds,
    positions,
    geometries,
    labels,
    geo,
    geoLabels: new Map(),
  };
  layout.geoLabels = prominentLabels(stations, geo, frameFromPositions(layout, geo).geometries);
  return layout;
}

// ---------------------------------------------------------------------------
// Frames: the same network in different arrangements, and moving between them
// ---------------------------------------------------------------------------

function boundsOf(points: Pt[]): MapFrame["bounds"] {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

/** The tidy diagram, exactly as laid out. */
export function schematicFrame(layout: MapLayout): MapFrame {
  return { positions: layout.positions, geometries: layout.geometries, bounds: layout.bounds };
}

/**
 * Re-draws the network with its stations at `positions`. Lines keep the same
 * vertices as the schematic (so the two can be blended), with each bend carried
 * along between the two stations it sits between.
 */
export function frameFromPositions(layout: MapLayout, positions: Map<string, Pt>): MapFrame {
  const at = (id: string): Pt => {
    const p = positions.get(id);
    if (!p) throw new Error(`No position for station "${id}" in this arrangement.`);
    return p;
  };
  const geometries = layout.geometries.map((geometry) => ({
    line: geometry.line,
    points: geometry.points.map((point): LayoutPoint => {
      if (point.stationId) return { ...at(point.stationId), stationId: point.stationId };
      const { from, to, t } = point.bend!;
      const a = at(from);
      const b = at(to);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, bend: point.bend };
    }),
  }));
  return { positions, geometries, bounds: boundsOf([...positions.values()]) };
}

/** Blend of two frames of the same layout; `k` runs 0 (all `a`) to 1 (all `b`). */
export function tweenFrame(a: MapFrame, b: MapFrame, k: number): MapFrame {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const mix = (p: Pt, q: Pt): Pt => ({ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k });
  const positions = new Map<string, Pt>();
  for (const [id, p] of a.positions) positions.set(id, mix(p, b.positions.get(id) ?? p));
  const geometries = a.geometries.map((geometry, g) => ({
    line: geometry.line,
    points: geometry.points.map((p, i) => ({ ...p, ...mix(p, b.geometries[g].points[i]) })),
  }));
  return { positions, geometries, bounds: boundsOf([...positions.values()]) };
}

/**
 * Splits a line into stretches that should be drawn alike. `keyOf` names the
 * style of the hop between two neighbouring stations; consecutive hops with the
 * same key become one stretch, bends included.
 */
export function styleRuns(
  geometry: LineGeometry,
  keyOf: (fromStation: string, toStation: string) => string,
): { key: string; from: string; to: string; points: Pt[] }[] {
  const runs: { key: string; from: string; to: string; points: Pt[] }[] = [];
  let lastStation = -1;
  geometry.points.forEach((point, i) => {
    if (!point.stationId) return;
    if (lastStation >= 0) {
      const from = geometry.points[lastStation].stationId!;
      const key = keyOf(from, point.stationId);
      const hop = geometry.points.slice(lastStation, i + 1).map((p) => ({ x: p.x, y: p.y }));
      const current = runs[runs.length - 1];
      if (current && current.key === key) {
        current.points.push(...hop.slice(1));
        current.to = point.stationId;
      } else {
        runs.push({ key, from, to: point.stationId, points: hop });
      }
    }
    lastStation = i;
  });
  return runs;
}

/** Where something `progress` (0–1) of the way from one station to the next sits, and which way it faces. */
export function poseBetween(
  geometry: LineGeometry,
  fromStation: string,
  toStation: string,
  progress: number,
): { x: number; y: number; angle: number } | null {
  const points = legPolyline(geometry, fromStation, toStation);
  if (points.length < 2) return null;
  const lengths = cumulativeLengths(points);
  const target = lengths[lengths.length - 1] * Math.max(0, Math.min(1, progress));
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < target) i++;
  const span = lengths[i] - lengths[i - 1];
  const t = span < EPS ? 0 : (target - lengths[i - 1]) / span;
  const a = points[i - 1];
  const b = points[i];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  };
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

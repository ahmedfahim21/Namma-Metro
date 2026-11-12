import { describe, expect, it } from "vitest";
import {
  createTrainTimeline,
  cumulativeLengths,
  getMapLayout,
  legPolyline,
  roundedPath,
} from "@/lib/mapLayout";
import { stations, lines } from "@/lib/network";

const layout = getMapLayout();

function angleOf(a: { x: number; y: number }, b: { x: number; y: number }) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

describe("map layout", () => {
  it("places every station exactly once", () => {
    expect(layout.positions.size).toBe(stations.length);
    for (const station of stations) {
      const p = layout.positions.get(station.id);
      expect(p, station.name).toBeDefined();
      expect(Number.isFinite(p!.x) && Number.isFinite(p!.y)).toBe(true);
    }
  });

  it("keeps every station inside the canvas", () => {
    for (const [id, p] of layout.positions) {
      expect(p.x, id).toBeGreaterThanOrEqual(0);
      expect(p.x, id).toBeLessThanOrEqual(layout.width);
      expect(p.y, id).toBeGreaterThanOrEqual(0);
      expect(p.y, id).toBeLessThanOrEqual(layout.height);
    }
  });

  it("draws every line segment at a multiple of 45 degrees", () => {
    for (const geometry of layout.geometries) {
      for (let i = 1; i < geometry.points.length; i++) {
        const angle = angleOf(geometry.points[i - 1], geometry.points[i]);
        const offset = Math.abs(((angle % 45) + 45) % 45);
        const deviation = Math.min(offset, 45 - offset);
        expect(deviation, `${geometry.line} @${i}`).toBeLessThan(0.01);
      }
    }
  });

  it("draws each line's stations in network order", () => {
    for (const line of lines) {
      const geometry = layout.geometries.find((g) => g.line === line.id);
      if (!geometry) continue;
      const drawn = geometry.points.map((p) => p.stationId).filter(Boolean);
      const expected = stations
        .filter((s) => s.lines.some((m) => m.line === line.id))
        .sort(
          (a, b) =>
            (a.lines.find((m) => m.line === line.id)?.sequence ?? 0) -
            (b.lines.find((m) => m.line === line.id)?.sequence ?? 0),
        )
        .map((s) => s.id);
      expect(drawn).toEqual(expected);
    }
  });

  it("shares one position between the lines that meet at an interchange", () => {
    const majestic = stations.find((s) => s.lines.length > 1)!;
    const seen = layout.geometries
      .flatMap((g) => g.points)
      .filter((p) => p.stationId === majestic.id)
      .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`);
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });
});

describe("legPolyline", () => {
  const purple = layout.geometries.find((g) => g.line === "purple")!;
  const onPurple = purple.points.filter((p) => p.stationId);

  it("returns the drawn vertices from board to alight", () => {
    const from = onPurple[2].stationId!;
    const to = onPurple[6].stationId!;
    const points = legPolyline(purple, from, to);
    expect(points[0]).toEqual({ x: layout.positions.get(from)!.x, y: layout.positions.get(from)!.y });
    expect(points[points.length - 1]).toEqual({
      x: layout.positions.get(to)!.x,
      y: layout.positions.get(to)!.y,
    });
    expect(points.length).toBeGreaterThanOrEqual(5);
  });

  it("reverses when travelling the other way", () => {
    const from = onPurple[6].stationId!;
    const to = onPurple[2].stationId!;
    const forward = legPolyline(purple, to, from);
    const backward = legPolyline(purple, from, to);
    expect(backward).toEqual([...forward].reverse());
  });

  it("returns nothing for a station that is not on the line", () => {
    expect(legPolyline(purple, "nope", onPurple[1].stationId!)).toEqual([]);
  });
});

describe("roundedPath", () => {
  it("rounds a corner instead of drawing a hard vertex", () => {
    const d = roundedPath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    expect(d.startsWith("M0.00,0.00")).toBe(true);
    expect(d).toContain("Q100.00,0.00");
    expect(d.endsWith("L100.00,100.00")).toBe(true);
  });

  it("passes short paths straight through", () => {
    expect(roundedPath([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe("M1.00,2.00 L3.00,4.00");
    expect(roundedPath([])).toBe("");
  });
});

describe("train timeline", () => {
  const straight = {
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    length: [0, 100],
  };
  const down = {
    points: [
      { x: 100, y: 0 },
      { x: 100, y: 60 },
    ],
    length: [0, 60],
  };

  it("starts at the origin and ends at the destination", () => {
    const timeline = createTrainTimeline([straight, down])!;
    expect(timeline.at(0)).toMatchObject({ x: 0, y: 0, legIndex: 0 });
    const end = timeline.at(timeline.cycle - 1);
    expect(end).toMatchObject({ x: 100, y: 60, legIndex: 1 });
  });

  it("never travels backwards along the route", () => {
    const timeline = createTrainTimeline([straight, down])!;
    let previous = -1;
    for (let t = 0; t < timeline.cycle; t += 25) {
      const pose = timeline.at(t);
      // Distance covered so far: leg 0 is horizontal, leg 1 vertical.
      const covered = pose.legIndex === 0 ? pose.x : 100 + pose.y;
      expect(covered + 1e-6).toBeGreaterThanOrEqual(previous);
      previous = covered;
    }
  });

  it("holds at the interchange between legs", () => {
    const timeline = createTrainTimeline([straight, down], { dwellMs: 600 })!;
    const legOneEnd = timeline.cycle - 600 - 1100 - (60 / 160) * (timeline.cycle - 600 - 1100);
    const during = timeline.at(legOneEnd + 200);
    const later = timeline.at(legOneEnd + 500);
    expect(during).toEqual(later);
    expect(during).toMatchObject({ x: 100, y: 0 });
  });

  it("loops: the same point in the next cycle matches this one", () => {
    const timeline = createTrainTimeline([straight, down])!;
    expect(timeline.at(1234)).toEqual(timeline.at(1234 + timeline.cycle));
  });

  it("points the train the way it is travelling", () => {
    const timeline = createTrainTimeline([straight, down])!;
    expect(timeline.at(timeline.cycle * 0.1).angle).toBe(0);
    expect(timeline.at(timeline.cycle - 1).angle).toBe(90);
  });

  it("ignores legs with no length", () => {
    expect(createTrainTimeline([{ points: [{ x: 1, y: 1 }], length: [0] }])).toBeNull();
    expect(createTrainTimeline([])).toBeNull();
  });

  it("drives a real itinerary's geometry", () => {
    const purple = layout.geometries.find((g) => g.line === "purple")!;
    const onPurple = purple.points.filter((p) => p.stationId);
    const points = legPolyline(purple, onPurple[0].stationId!, onPurple[8].stationId!);
    const timeline = createTrainTimeline([{ points, length: cumulativeLengths(points) }])!;
    expect(timeline.at(0)).toMatchObject({ x: points[0].x, y: points[0].y });
    const end = timeline.at(timeline.cycle - 1);
    expect(end.x).toBeCloseTo(points[points.length - 1].x, 6);
    expect(end.y).toBeCloseTo(points[points.length - 1].y, 6);
  });
});

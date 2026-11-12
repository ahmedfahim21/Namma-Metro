import { describe, expect, it } from "vitest";
import {
  frameFromPositions,
  mapLabel,
  poseBetween,
  schematicFrame,
  styleRuns,
  tweenFrame,
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

describe("frames", () => {
  const schematic = schematicFrame(layout);
  const geographic = frameFromPositions(layout, layout.geo);

  it("gives every station a geographic position inside the canvas", () => {
    expect(layout.geo.size).toBe(stations.length);
    for (const [id, p] of layout.geo) {
      expect(p.x, id).toBeGreaterThanOrEqual(0);
      expect(p.x, id).toBeLessThanOrEqual(layout.width);
      expect(p.y, id).toBeGreaterThanOrEqual(0);
      expect(p.y, id).toBeLessThanOrEqual(layout.height);
    }
  });

  it("keeps north up and east right in the geographic arrangement", () => {
    const at = (name: string) => layout.geo.get(stations.find((s) => s.name === name)!.id)!;
    expect(at("Madavara").y).toBeLessThan(at("Silk Institute").y);
    expect(at("Challaghatta").x).toBeLessThan(at("Whitefield (Kadugodi)").x);
    expect(at("Nagawara").y).toBeLessThan(at("Kalena Agrahara").y);
  });

  it("re-draws lines with the same vertices, so the two arrangements can blend", () => {
    expect(geographic.geometries.map((g) => g.points.length)).toEqual(
      schematic.geometries.map((g) => g.points.length),
    );
    for (const geometry of geographic.geometries) {
      for (const point of geometry.points) {
        if (point.stationId) expect(point).toMatchObject(layout.geo.get(point.stationId)!);
        else expect(point.bend).toBeDefined();
      }
    }
  });

  it("carries each bend along on the straight line between its two stations", () => {
    for (const geometry of geographic.geometries) {
      for (const point of geometry.points) {
        if (!point.bend) continue;
        const a = layout.geo.get(point.bend.from)!;
        const b = layout.geo.get(point.bend.to)!;
        expect(point.bend.t).toBeGreaterThan(0);
        expect(point.bend.t).toBeLessThan(1);
        expect(point.x).toBeCloseTo(a.x + (b.x - a.x) * point.bend.t, 6);
        expect(point.y).toBeCloseTo(a.y + (b.y - a.y) * point.bend.t, 6);
      }
    }
  });

  it("blends from one arrangement to the other", () => {
    expect(tweenFrame(schematic, geographic, 0)).toBe(schematic);
    expect(tweenFrame(schematic, geographic, 1)).toBe(geographic);
    const half = tweenFrame(schematic, geographic, 0.5);
    for (const [id, p] of half.positions) {
      const a = schematic.positions.get(id)!;
      const b = geographic.positions.get(id)!;
      expect(p.x, id).toBeCloseTo((a.x + b.x) / 2, 6);
      expect(p.y, id).toBeCloseTo((a.y + b.y) / 2, 6);
    }
  });

  it("fails loudly when an arrangement is missing a station", () => {
    expect(() => frameFromPositions(layout, new Map())).toThrow();
  });
});

describe("styleRuns", () => {
  const pink = layout.geometries.find((g) => g.line === "pink")!;

  it("splits the Pink Line where the open track ends", () => {
    const open = new Set(["kalena-agrahara", "hulimavu", "iimb", "jp-nagar-4th-phase", "jayadeva-hospital"]);
    const runs = styleRuns(pink, (from) => (open.has(from) ? "open" : "planned"));
    expect(runs.map((r) => [r.key, r.from, r.to])).toEqual([
      ["open", "kalena-agrahara", "tavarekere"],
      ["planned", "tavarekere", "nagawara"],
    ]);
    // The two stretches meet at Tavarekere and together cover the whole line.
    expect(runs[0].points[runs[0].points.length - 1]).toEqual(runs[1].points[0]);
    expect(runs[0].points.length + runs[1].points.length - 1).toBe(pink.points.length);
  });

  it("keeps a line whole when every hop is drawn alike", () => {
    const runs = styleRuns(pink, () => "same");
    expect(runs).toHaveLength(1);
    expect(runs[0].points).toHaveLength(pink.points.length);
  });
});

describe("poseBetween", () => {
  const pink = layout.geometries.find((g) => g.line === "pink")!;

  it("starts at one station and ends at the next", () => {
    const start = poseBetween(pink, "hulimavu", "iimb", 0)!;
    const end = poseBetween(pink, "hulimavu", "iimb", 1)!;
    expect(start).toMatchObject(layout.positions.get("hulimavu")!);
    expect(end.x).toBeCloseTo(layout.positions.get("iimb")!.x, 6);
    expect(end.y).toBeCloseTo(layout.positions.get("iimb")!.y, 6);
  });

  it("faces the opposite way when travelling in the other direction", () => {
    const north = poseBetween(pink, "hulimavu", "iimb", 0.5)!;
    const south = poseBetween(pink, "iimb", "hulimavu", 0.5)!;
    expect(Math.abs(Math.abs(north.angle - south.angle) - 180)).toBeLessThan(0.01);
    expect(north.x).toBeCloseTo(south.x, 6);
  });

  it("returns nothing for a station that is not on the line", () => {
    expect(poseBetween(pink, "hulimavu", "indiranagar", 0.5)).toBeNull();
  });
});

describe("mapLabel", () => {
  const named = (name: string) => stations.find((s) => s.name === name)!;

  it("uses the everyday name when the official one is too long for the map", () => {
    expect(mapLabel(named("Nadaprabhu Kempegowda Station, Majestic"))).toBe("Majestic");
    expect(mapLabel(named("Rashtreeya Vidyalaya Road"))).toBe("RV Road");
    expect(mapLabel(named("Indiranagar"))).toBe("Indiranagar");
    expect(mapLabel(named("Whitefield (Kadugodi)"))).toBe("Whitefield (Kadugodi)");
  });

  it("chooses a side for every interchange and terminal label", () => {
    for (const name of ["Jayadeva Hospital", "Rashtreeya Vidyalaya Road", "Kalena Agrahara", "Nagawara"]) {
      expect(["right", "left", "above", "below"], name).toContain(layout.labels.get(named(name).id));
      expect(["right", "left", "above", "below"], name).toContain(layout.geoLabels.get(named(name).id));
    }
    // Two interchanges a few stops apart must not print over each other.
    const rv = layout.positions.get(named("Rashtreeya Vidyalaya Road").id)!;
    const jayadeva = layout.positions.get(named("Jayadeva Hospital").id)!;
    const sameRow = Math.abs(rv.y - jayadeva.y) < 14;
    if (sameRow && layout.labels.get(named("Rashtreeya Vidyalaya Road").id) === "right") {
      expect(jayadeva.x - rv.x).toBeGreaterThan(mapLabel(named("Rashtreeya Vidyalaya Road")).length * 6.4);
    }
  });
});

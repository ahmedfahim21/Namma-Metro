import { describe, it, expect } from "vitest";
import { getRouter, stations } from "@/lib/network";
import { getMapLayout } from "@/lib/mapLayout";
import { radialLayout } from "@/lib/isochrone";

const router = getRouter();
const layout = getMapLayout();
const MAJESTIC = "nadaprabhu-kempegowda-station-majestic";

describe("reachFrom", () => {
  const reach = router.reachFrom(MAJESTIC);

  it("reaches every station with trains and none without", () => {
    expect(reach.size).toBe(88);
    expect(reach.has("dairy-circle")).toBe(false);
    expect(reach.has("nagawara")).toBe(false);
    expect(reach.get(MAJESTIC)).toEqual({ seconds: 0, meters: 0, interchanges: 0 });
  });

  it("agrees with the trip planner on time, distance and changes", () => {
    for (const destination of ["whitefield-kadugodi", "electronic-city", "tavarekere", "silk-institute"]) {
      const fastest = router.planTrip(MAJESTIC, destination)[0];
      expect(reach.get(destination), destination).toEqual({
        seconds: fastest.totalDurationSeconds,
        meters: fastest.totalDistanceMeters,
        interchanges: fastest.interchanges.length,
      });
    }
  });

  it("counts the changes needed to reach the Pink Line", () => {
    // Green to RV Road, Yellow to Jayadeva, Pink to Kalena Agrahara.
    expect(reach.get("kalena-agrahara")!.interchanges).toBe(2);
    expect(reach.get("indiranagar")!.interchanges).toBe(0);
  });

  it("returns nothing for a station that does not exist", () => {
    expect(router.reachFrom("no-such-station").size).toBe(0);
  });
});

describe("radialLayout", () => {
  const reach = router.reachFrom(MAJESTIC);
  const radial = radialLayout(layout, MAJESTIC, reach);

  it("puts the origin at the centre and every station at its journey time", () => {
    expect(radial.positions.get(MAJESTIC)).toEqual(radial.center);
    for (const [id, r] of reach) {
      const p = radial.positions.get(id)!;
      const distance = Math.hypot(p.x - radial.center.x, p.y - radial.center.y);
      expect(distance, id).toBeCloseTo((r.seconds / 60) * radial.pixelsPerMinute, 6);
    }
  });

  it("keeps every station on its real compass bearing from the origin", () => {
    const origin = layout.geo.get(MAJESTIC)!;
    for (const id of ["whitefield-kadugodi", "madavara", "kalena-agrahara"]) {
      const geo = layout.geo.get(id)!;
      const p = radial.positions.get(id)!;
      const real = Math.atan2(geo.y - origin.y, geo.x - origin.x);
      const drawn = Math.atan2(p.y - radial.center.y, p.x - radial.center.x);
      expect(drawn, id).toBeCloseTo(real, 6);
    }
  });

  it("draws rings every ten minutes out past the furthest station", () => {
    const longest = Math.max(...[...reach.values()].map((r) => r.seconds)) / 60;
    expect(radial.rings[0]).toBe(10);
    expect(radial.rings[radial.rings.length - 1]).toBe(radial.maxMinutes);
    expect(radial.maxMinutes).toBeGreaterThanOrEqual(longest);
    expect(radial.maxMinutes - longest).toBeLessThan(10);
  });

  it("parks stations without trains outside the last ring", () => {
    const p = radial.positions.get("nagawara")!;
    const distance = Math.hypot(p.x - radial.center.x, p.y - radial.center.y);
    expect(distance).toBeGreaterThan(radial.maxMinutes * radial.pixelsPerMinute);
    expect(radial.positions.size).toBe(stations.length);
  });

  it("refuses to centre on a station that has no trains", () => {
    expect(() => radialLayout(layout, "nagawara", router.reachFrom("nagawara"))).toThrow();
  });
});

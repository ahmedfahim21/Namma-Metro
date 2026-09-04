import { describe, it, expect } from "vitest";
import { createProjection, polylinePath } from "@/lib/projection";

const W = 600;
const PAD = 40;

function finite(...values: number[]) {
  return values.every((v) => Number.isFinite(v));
}

describe("createProjection", () => {
  it("keeps every projected point inside the canvas", () => {
    const points = [
      { lat: 12.85, lng: 77.48 },
      { lat: 13.05, lng: 77.75 },
      { lat: 12.95, lng: 77.6 },
    ];
    const { project, width, height } = createProjection(points, W, PAD);
    for (const p of points) {
      const { x, y } = project(p.lat, p.lng);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(height);
    }
  });

  it("puts north above south", () => {
    const points = [
      { lat: 12.85, lng: 77.6 },
      { lat: 13.05, lng: 77.6 },
    ];
    const { project } = createProjection(points, W, PAD);
    expect(project(13.05, 77.6).y).toBeLessThan(project(12.85, 77.6).y);
  });

  it("puts east right of west", () => {
    const points = [
      { lat: 12.95, lng: 77.48 },
      { lat: 12.95, lng: 77.75 },
    ];
    const { project } = createProjection(points, W, PAD);
    expect(project(12.95, 77.75).x).toBeGreaterThan(project(12.95, 77.48).x);
  });

  it("does not collapse or produce NaN for a due east-west run (zero latitude span)", () => {
    const points = [
      { lat: 12.95, lng: 77.5 },
      { lat: 12.95, lng: 77.7 },
    ];
    const { project, height } = createProjection(points, W, PAD);
    const a = project(12.95, 77.5);
    const b = project(12.95, 77.7);
    expect(finite(a.x, a.y, b.x, b.y, height)).toBe(true);
    expect(b.x).toBeGreaterThan(a.x);
  });

  it("does not collapse or produce NaN for a due north-south run (zero longitude span)", () => {
    const points = [
      { lat: 12.85, lng: 77.6 },
      { lat: 13.05, lng: 77.6 },
    ];
    const { project, height } = createProjection(points, W, PAD);
    const a = project(12.85, 77.6);
    const b = project(13.05, 77.6);
    expect(finite(a.x, a.y, b.x, b.y, height)).toBe(true);
    expect(height).toBeGreaterThan(0);
    expect(b.y).toBeLessThan(a.y);
  });

  it("caps the canvas aspect ratio so a long line doesn't produce a sliver", () => {
    const points = [
      { lat: 12.8, lng: 77.6 },
      { lat: 13.1, lng: 77.605 },
    ];
    const { height } = createProjection(points, W, PAD, 1.5);
    expect(height).toBeLessThanOrEqual(W * 1.5 + 0.001);
  });

  it("handles a single point without dividing by zero", () => {
    const { project, height } = createProjection([{ lat: 12.95, lng: 77.6 }], W, PAD);
    const p = project(12.95, 77.6);
    expect(finite(p.x, p.y, height)).toBe(true);
  });
});

describe("polylinePath", () => {
  it("builds a moveto followed by linetos", () => {
    expect(polylinePath([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe("M1.0,2.0 L3.0,4.0");
  });

  it("returns an empty string for no points", () => {
    expect(polylinePath([])).toBe("");
  });
});

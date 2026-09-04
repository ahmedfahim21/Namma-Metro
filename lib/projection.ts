import type { Station } from "@/packages/network/src/schema";

export interface Projection {
  project: (lat: number, lng: number) => { x: number; y: number };
  width: number;
  height: number;
}

/**
 * Projects lat/lng into an SVG canvas of fixed `width`, sizing the height to
 * the content so there's never dead space. Longitude is scaled by cos(lat)
 * so the network keeps its true shape rather than stretching east-west.
 */
export function createProjection(
  bounds: Pick<Station, "lat" | "lng">[],
  width: number,
  padding: number,
  maxAspect = 2.2,
): Projection {
  const lats = bounds.map((s) => s.lat);
  const lngs = bounds.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const lngScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = (maxLng - minLng) * lngScale;
  const spanY = maxLat - minLat;

  const usableW = width - 2 * padding;
  // A journey along one line is nearly a straight line; without a floor on
  // the minor axis the canvas would collapse to a sliver.
  const scale = spanX > 0 ? usableW / spanX : usableW / Math.max(spanY, 1e-6);
  const rawHeight = spanY * scale + 2 * padding;
  const height = Math.min(rawHeight, width * maxAspect);
  const fitScale = rawHeight > height ? (height - 2 * padding) / Math.max(spanY, 1e-9) : scale;

  const drawnW = spanX * fitScale;
  const drawnH = spanY * fitScale;
  const offsetX = (width - drawnW) / 2;
  const offsetY = (height - drawnH) / 2;

  return {
    width,
    height,
    project(lat: number, lng: number) {
      return {
        x: offsetX + (lng - minLng) * lngScale * fitScale,
        // SVG y grows downward; latitude grows north.
        y: offsetY + (maxLat - lat) * fitScale,
      };
    },
  };
}

/** Builds an SVG path through a list of projected points. */
export function polylinePath(points: { x: number; y: number }[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

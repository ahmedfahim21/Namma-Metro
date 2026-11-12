import type { Reach } from "@/packages/routing/src/itinerary";
import type { MapLayout, Pt } from "@/lib/mapLayout";

/**
 * Travel-time arrangement: the chosen station sits in the middle and every
 * other station moves out along its real compass bearing until its distance
 * from the centre equals its journey time. Rings are then lines of equal time.
 */

export interface RadialLayout {
  positions: Map<string, Pt>;
  center: Pt;
  pixelsPerMinute: number;
  /** Ring times in minutes, innermost first. */
  rings: number[];
  maxMinutes: number;
}

const RING_STEP_MINUTES = 10;

export function radialLayout(layout: MapLayout, originId: string, reach: Map<string, Reach>): RadialLayout {
  const originGeo = layout.geo.get(originId);
  // A station with no trains "reaches" only itself, which is no map at all.
  if (!originGeo || !reach.has(originId) || reach.size < 2) {
    throw new Error(`Cannot build a travel-time map from "${originId}": it has no trains.`);
  }
  const center = { x: layout.width / 2, y: layout.height / 2 };
  const longest = Math.max(...[...reach.values()].map((r) => r.seconds)) / 60;
  const maxMinutes = Math.max(RING_STEP_MINUTES, Math.ceil(longest / RING_STEP_MINUTES) * RING_STEP_MINUTES);
  const radius = Math.min(layout.width, layout.height) / 2 - 40;
  const pixelsPerMinute = radius / maxMinutes;

  const positions = new Map<string, Pt>();
  for (const [id, geo] of layout.geo) {
    if (id === originId) {
      positions.set(id, center);
      continue;
    }
    const bearing = Math.atan2(geo.y - originGeo.y, geo.x - originGeo.x);
    const reached = reach.get(id);
    // Stations with no trains yet wait just outside the last ring.
    const minutes = reached ? reached.seconds / 60 : maxMinutes + RING_STEP_MINUTES;
    positions.set(id, {
      x: center.x + Math.cos(bearing) * minutes * pixelsPerMinute,
      y: center.y + Math.sin(bearing) * minutes * pixelsPerMinute,
    });
  }

  const rings: number[] = [];
  for (let m = RING_STEP_MINUTES; m <= maxMinutes; m += RING_STEP_MINUTES) rings.push(m);
  return { positions, center, pixelsPerMinute, rings, maxMinutes };
}

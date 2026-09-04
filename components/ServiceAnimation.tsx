"use client";

import { useMemo } from "react";
import { segments, timetables, lineById } from "@/lib/network";
import { lineSwatch } from "./LineBadge";
import type { LineId, Station } from "@/packages/network/src/schema";

/**
 * Trains are driven by SVG `<animateMotion>` along the line's own path —
 * declarative, smooth, and free of a per-frame React render. Each train on a
 * line shares one path and is offset by a negative `begin`, which is exactly
 * how real headways stagger services.
 *
 * This is a visualisation of *frequency*, not a live feed: BMRCL publishes no
 * real-time position data. It runs sped up, because a real end-to-end run is
 * over an hour, and the caller labels it as simulated.
 */

/** Wall-clock seconds compressed into one animation second. */
export const SPEED = 90;
const MAX_TRAINS_PER_DIRECTION = 10;

export interface LinePath {
  lineId: LineId;
  /** Stations in increasing sequence order. */
  stations: Station[];
  /** Path string in increasing sequence order. */
  d: string;
  /** Same path reversed, for the opposite direction. */
  reversed: string;
}

function runSecondsFor(lineId: LineId): number {
  return segments
    .filter((s) => s.line === lineId)
    .reduce((total, s) => total + s.runSeconds, 0);
}

function headwayFor(lineId: LineId): number {
  // Use an off-peak band: peak headways put so many trains on screen that the
  // line reads as a dotted rule rather than a service.
  const entry = timetables.find((t) => t.line === lineId && t.dayType === "weekday");
  if (!entry) return 600;
  return Math.max(...entry.headwayBands.map((b) => b.headwaySeconds));
}

export function ServiceAnimation({ paths }: { paths: LinePath[] }) {
  const trains = useMemo(
    () =>
      paths.flatMap((path) => {
        if (lineById.get(path.lineId)?.status !== "operational") return [];

        const runSeconds = runSecondsFor(path.lineId);
        if (runSeconds <= 0) return [];
        const headway = headwayFor(path.lineId);
        const durationSeconds = runSeconds / SPEED;
        const count = Math.min(
          MAX_TRAINS_PER_DIRECTION,
          Math.max(1, Math.ceil(runSeconds / headway)),
        );

        return (["forward", "reverse"] as const).flatMap((direction) =>
          Array.from({ length: count }, (_, k) => ({
            key: `${path.lineId}-${direction}-${k}`,
            lineId: path.lineId,
            d: direction === "forward" ? path.d : path.reversed,
            durationSeconds,
            // Stagger by one headway per train, so spacing matches frequency.
            beginSeconds: -((k * headway) / SPEED) - (direction === "reverse" ? headway / SPEED / 2 : 0),
          })),
        );
      }),
    [paths],
  );

  return (
    <g aria-hidden>
      {trains.map((train) => (
        <circle
          key={train.key}
          r={4.2}
          fill={lineSwatch(train.lineId)}
          stroke="var(--surface)"
          strokeWidth={1.8}
        >
          <animateMotion
            dur={`${train.durationSeconds.toFixed(2)}s`}
            begin={`${train.beginSeconds.toFixed(2)}s`}
            repeatCount="indefinite"
            path={train.d}
            rotate="auto"
          />
        </circle>
      ))}
    </g>
  );
}

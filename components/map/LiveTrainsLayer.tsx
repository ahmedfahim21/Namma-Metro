"use client";

import { useMemo, useSyncExternalStore } from "react";
import { stations, segments, timetables } from "@/lib/network";
import { istClock, lineServices, trainsAt, type LineService } from "@/lib/liveTrains";
import { poseBetween, type LineGeometry } from "@/lib/mapLayout";
import { lineColor } from "../LineBadge";
import type { SimClock } from "./simClock";

const serverSnapshot = () => 0;

// Which stretches are running only changes when the date does, so work it out once per day.
const servicesByDay = new Map<string, LineService[]>();
function servicesOn(today: string): LineService[] {
  let services = servicesByDay.get(today);
  if (!services) {
    services = lineServices(stations, segments, today);
    servicesByDay.set(today, services);
  }
  return services;
}

/** Every simulated train on the network, drawn on top of the lines. */
export function LiveTrainsLayer({
  clock,
  geometries,
  opacity = 1,
}: {
  clock: SimClock;
  geometries: LineGeometry[];
  opacity?: number;
}) {
  const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, serverSnapshot);
  const { today, dayType, secondsSinceMidnight } = istClock(now);
  const services = servicesOn(today);
  const byLine = useMemo(() => new Map(geometries.map((g) => [g.line, g])), [geometries]);
  if (now === 0) return null;

  return (
    <g className="pointer-events-none transition-opacity duration-500" opacity={opacity}>
      {trainsAt(services, timetables, dayType, secondsSinceMidnight).map((train) => {
        const geometry = byLine.get(train.line);
        const pose = geometry && poseBetween(geometry, train.fromStation, train.toStation, train.progress);
        if (!pose) return null;
        return (
          <g key={train.id} transform={`translate(${pose.x.toFixed(2)},${pose.y.toFixed(2)}) rotate(${pose.angle.toFixed(1)})`}>
            <rect x={-11} y={-6} width={22} height={12} rx={6} fill="var(--map-bg)" />
            <rect x={-9.5} y={-4.5} width={19} height={9} rx={4.5} fill={lineColor(train.line)} />
            <rect x={-9.5} y={-4.5} width={19} height={9} rx={4.5} fill="var(--train-shade)" />
            <circle cx={5.5} cy={0} r={1.5} fill="var(--map-bg)" />
          </g>
        );
      })}
    </g>
  );
}

/** Text readout of the simulated clock: "08:42 · 47 trains running". */
export function LiveReadout({ clock }: { clock: SimClock }) {
  const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, serverSnapshot);
  const { today, dayType, secondsSinceMidnight } = istClock(now);
  const services = servicesOn(today);
  if (now === 0) return <span className="text-muted">Starting the clock…</span>;
  const count = trainsAt(services, timetables, dayType, secondsSinceMidnight).length;
  const hours = Math.floor(secondsSinceMidnight / 3600);
  const minutes = Math.floor((secondsSinceMidnight % 3600) / 60);
  return (
    <span className="tabular-nums">
      <span className="text-base tracking-tight text-foreground">
        {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}
      </span>
      <span className="ml-2 text-muted">
        {count === 0 ? "no trains running" : `${count} train${count === 1 ? "" : "s"} running`}
      </span>
    </span>
  );
}

/** Slider over the 24 hours of the simulated day. */
export function DayScrubber({ clock, onScrub }: { clock: SimClock; onScrub: (seconds: number) => void }) {
  const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, serverSnapshot);
  const { secondsSinceMidnight } = istClock(now);
  return (
    <input
      type="range"
      min={0}
      max={86_399}
      step={60}
      value={Math.floor(secondsSinceMidnight)}
      onChange={(event) => onScrub(Number(event.target.value))}
      aria-label="Time of day"
      className="map-range w-full"
      disabled={now === 0}
    />
  );
}

"use client";

import { useMemo } from "react";
import type { Itinerary } from "@/packages/routing/src/itinerary";
import { stationById, displayNameById } from "@/lib/network";
import { createProjection, polylinePath } from "@/lib/projection";
import { lineSwatch } from "./LineBadge";
import type { Station } from "@/packages/network/src/schema";

const W = 600;
const PAD = 46;
const DRAW_MS = 900;
/** Total time budget for the station dots to pop in, however many there are. */
const DOT_STAGGER_BUDGET = 700;
/** Above this many intermediate stops, dots crowd the line — draw none. */
const MAX_STOP_DOTS = 14;

export function JourneyMap({ itinerary }: { itinerary: Itinerary }) {
  const model = useMemo(() => {
    const legStations: Station[][] = itinerary.legs.map((leg) =>
      leg.stations.map((id) => stationById.get(id)).filter((s): s is Station => Boolean(s)),
    );
    const all = legStations.flat();
    if (all.length < 2) return null;

    const projection = createProjection(all, W, PAD, 0.75);
    const { project, height } = projection;

    // The full extent of each line the trip uses, drawn faintly behind the
    // journey so the route reads in the context of the network.
    const contextLines = Array.from(new Set(itinerary.legs.map((l) => l.line))).map((lineId) => {
      const onLine = Array.from(stationById.values())
        .filter((s) => s.lines.some((m) => m.line === lineId))
        .sort(
          (a, b) =>
            (a.lines.find((m) => m.line === lineId)?.sequence ?? 0) -
            (b.lines.find((m) => m.line === lineId)?.sequence ?? 0),
        );
      return { lineId, d: polylinePath(onLine.map((s) => project(s.lat, s.lng))) };
    });

    const legs = itinerary.legs.map((leg, i) => ({
      line: leg.line,
      d: polylinePath(legStations[i].map((s) => project(s.lat, s.lng))),
      // Each leg starts drawing as the previous one finishes.
      delay: (i * DRAW_MS) / itinerary.legs.length,
      duration: DRAW_MS / itinerary.legs.length,
    }));

    const origin = all[0];
    const destination = all[all.length - 1];
    const changes = itinerary.interchanges
      .map((ic) => stationById.get(ic.station))
      .filter((s): s is Station => Boolean(s));

    const anchorIds = new Set([origin.id, destination.id, ...changes.map((s) => s.id)]);
    const intermediate = all.filter((s) => !anchorIds.has(s.id));
    // On a long trip the stops sit so close together that marking each one
    // turns the route into a dashed line. Past that point the stroke alone
    // reads better — the stop list is right below in the route strip anyway.
    const dots =
      intermediate.length > MAX_STOP_DOTS
        ? []
        : intermediate.map((s, i, arr) => ({
            id: s.id,
            ...project(s.lat, s.lng),
            delay: DRAW_MS * 0.35 + (i / Math.max(1, arr.length - 1)) * DOT_STAGGER_BUDGET,
          }));

    return {
      height,
      contextLines,
      legs,
      dots,
      origin: { station: origin, ...project(origin.lat, origin.lng) },
      destination: { station: destination, ...project(destination.lat, destination.lng) },
      changes: changes.map((s) => ({ station: s, ...project(s.lat, s.lng) })),
      originLine: itinerary.legs[0].line,
      destinationLine: itinerary.legs[itinerary.legs.length - 1].line,
    };
  }, [itinerary]);

  if (!model) return null;

  const labelFor = (x: number, text: string) => ({
    x: x > W * 0.7 ? x - 12 : x + 12,
    anchor: x > W * 0.7 ? ("end" as const) : ("start" as const),
    text,
  });

  const originLabel = labelFor(model.origin.x, displayNameById(model.origin.station.id));
  const destLabel = labelFor(model.destination.x, displayNameById(model.destination.station.id));

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-sunken">
      <svg
        viewBox={`0 0 ${W} ${Math.round(model.height)}`}
        width="100%"
        role="img"
        aria-label={`Route from ${displayNameById(model.origin.station.id)} to ${displayNameById(
          model.destination.station.id,
        )}`}
        className="block"
      >
        {model.contextLines.map(({ lineId, d }) => (
          <path
            key={`ctx-${lineId}`}
            d={d}
            fill="none"
            stroke={lineSwatch(lineId)}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.11}
          />
        ))}

        {model.legs.map((leg, i) => (
          <path
            key={`leg-${i}`}
            d={leg.d}
            pathLength={1}
            fill="none"
            stroke={lineSwatch(leg.line)}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw"
            style={
              {
                "--draw-duration": `${leg.duration}ms`,
                "--draw-delay": `${leg.delay}ms`,
              } as React.CSSProperties
            }
          />
        ))}

        {model.dots.map((dot) => (
          <circle
            key={dot.id}
            cx={dot.x}
            cy={dot.y}
            r={2.4}
            fill="var(--surface)"
            stroke="var(--ink-faint)"
            strokeWidth={1.3}
            className="animate-pop"
            style={{ "--pop-delay": `${dot.delay}ms` } as React.CSSProperties}
          />
        ))}

        {model.changes.map((change) => (
          <g key={`change-${change.station.id}`}>
            <circle
              cx={change.x}
              cy={change.y}
              r={6.5}
              fill="var(--surface)"
              stroke="var(--ink)"
              strokeWidth={3}
              className="animate-pop"
              style={{ "--pop-delay": `${DRAW_MS * 0.6}ms` } as React.CSSProperties}
            />
            <text
              x={labelFor(change.x, "").x}
              y={change.y - 12}
              textAnchor={labelFor(change.x, "").anchor}
              className="animate-rise pointer-events-none"
              style={
                {
                  "--rise-delay": `${DRAW_MS * 0.7}ms`,
                  fontSize: 11,
                  fontWeight: 600,
                  fill: "var(--ink)",
                  paintOrder: "stroke",
                  stroke: "var(--sunken)",
                  strokeWidth: 4,
                  strokeLinejoin: "round",
                } as React.CSSProperties
              }
            >
              {displayNameById(change.station.id)}
            </text>
          </g>
        ))}

        {/* Origin: hollow ring in its line colour, with a slow pulse. */}
        <circle
          cx={model.origin.x}
          cy={model.origin.y}
          r={7}
          fill="none"
          stroke={lineSwatch(model.originLine)}
          strokeWidth={3}
          className="animate-pulse-ring"
        />
        <circle
          cx={model.origin.x}
          cy={model.origin.y}
          r={6}
          fill="var(--surface)"
          stroke={lineSwatch(model.originLine)}
          strokeWidth={3.5}
          className="animate-pop"
        />

        {/* Destination: solid, arriving once the line has drawn. */}
        <circle
          cx={model.destination.x}
          cy={model.destination.y}
          r={7}
          fill="var(--ink)"
          className="animate-pop"
          style={{ "--pop-delay": `${DRAW_MS}ms` } as React.CSSProperties}
        />
        <circle
          cx={model.destination.x}
          cy={model.destination.y}
          r={2.5}
          fill="var(--surface)"
          className="animate-pop"
          style={{ "--pop-delay": `${DRAW_MS}ms` } as React.CSSProperties}
        />

        {[
          { label: originLabel, y: model.origin.y - 13, delay: 120 },
          { label: destLabel, y: model.destination.y - 13, delay: DRAW_MS + 100 },
        ].map(({ label, y, delay }) => (
          <text
            key={label.text + y}
            x={label.x}
            y={y}
            textAnchor={label.anchor}
            className="animate-rise pointer-events-none"
            style={
              {
                "--rise-delay": `${delay}ms`,
                fontSize: 11.5,
                fontWeight: 600,
                fill: "var(--ink)",
                paintOrder: "stroke",
                stroke: "var(--sunken)",
                strokeWidth: 4,
                strokeLinejoin: "round",
              } as React.CSSProperties
            }
          >
            {label.text}
          </text>
        ))}
      </svg>
    </div>
  );
}

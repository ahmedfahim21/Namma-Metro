"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { stations, lines, lineById, isTerminal, displayName } from "@/lib/network";
import { lineSwatch } from "./LineBadge";
import type { Station } from "@/packages/network/src/schema";

const W = 680;
const PAD = 78;

function StationLabel({
  x,
  y,
  dx,
  dy,
  text,
  bold,
}: {
  x: number;
  y: number;
  /** Unit vector pointing at clear space — away from this station's own line. */
  dx: number;
  dy: number;
  text: string;
  bold: boolean;
}) {
  const OFFSET = 12;
  return (
    <text
      x={x + dx * OFFSET}
      y={y + dy * OFFSET + 3.5}
      textAnchor={dx < -0.3 ? "end" : dx > 0.3 ? "start" : "middle"}
      className="pointer-events-none"
      style={{
        fontSize: 10.5,
        fontWeight: bold ? 600 : 500,
        fill: bold ? "var(--ink)" : "var(--ink-muted)",
        // Halo, so a label stays legible where it crosses a line.
        paintOrder: "stroke",
        stroke: "var(--surface)",
        strokeWidth: 4,
        strokeLinejoin: "round",
      }}
    >
      {text}
    </text>
  );
}

export function MetroMap() {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);

  const { project, byLine, labelled, height, labelDirections } = useMemo(() => {
    const lats = stations.map((s) => s.lat);
    const lngs = stations.map((s) => s.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    // Correct for longitude convergence so the network keeps its true shape.
    const lngScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const spanX = (maxLng - minLng) * lngScale || 1;
    const spanY = maxLat - minLat || 1;

    // Fit to width, then size the canvas to the content so there's no dead space.
    const scale = (W - 2 * PAD) / spanX;
    const height = spanY * scale + 2 * PAD;

    function project(lat: number, lng: number) {
      return {
        x: PAD + (lng - minLng) * lngScale * scale,
        // SVG y grows downward; latitude grows north.
        y: PAD + (maxLat - lat) * scale,
      };
    }

    const byLine = new Map<string, Station[]>();
    for (const line of lines) {
      byLine.set(
        line.id,
        stations
          .filter((s) => s.lines.some((m) => m.line === line.id))
          .sort(
            (a, b) =>
              (a.lines.find((m) => m.line === line.id)?.sequence ?? 0) -
              (b.lines.find((m) => m.line === line.id)?.sequence ?? 0),
          ),
      );
    }

    // Only anchors get permanent labels — terminals and interchanges.
    // Labelling all 95 at this scale is unreadable.
    const labelled = new Set(
      stations
        .filter(
          (s) =>
            s.lines.some((m) => lineById.get(m.line)?.status === "operational") &&
            (s.interchange || isTerminal(s)),
        )
        .map((s) => s.id),
    );

    /**
     * Where to put a station's label so it doesn't land on its own line.
     * A terminal points away from its only neighbour — off the end of the
     * line. An interchange has track on both sides, so it takes a diagonal,
     * which threads the gap between two roughly orthogonal lines.
     */
    function labelDirection(station: Station): { dx: number; dy: number } {
      const p = project(station.lat, station.lng);

      if (!station.interchange) {
        const membership = station.lines[0];
        const onLine = byLine.get(membership.line) ?? [];
        const idx = onLine.findIndex((s) => s.id === station.id);
        const neighbour = onLine[idx + 1] ?? onLine[idx - 1];
        if (neighbour) {
          const n = project(neighbour.lat, neighbour.lng);
          const vx = p.x - n.x;
          const vy = p.y - n.y;
          const len = Math.hypot(vx, vy) || 1;
          return { dx: vx / len, dy: vy / len };
        }
      }

      // Diagonal, biased inward so edge labels stay on canvas.
      const dx = p.x > W * 0.6 ? -0.707 : 0.707;
      return { dx, dy: -0.707 };
    }

    const labelDirections = new Map(
      stations.map((s) => [s.id, labelDirection(s)] as const),
    );

    return { project, byLine, labelled, height, labelDirections };
  }, []);

  const hoveredStation = hovered ? stations.find((s) => s.id === hovered) : null;

  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
        <svg
          viewBox={`0 0 ${W} ${Math.round(height)}`}
          width="100%"
          role="img"
          aria-label="Schematic map of the Namma Metro network. A full station list follows."
          className="block"
        >
          {/* Under-construction lines sit underneath the operational network. */}
          {[...lines]
            .sort(
              (a, b) =>
                (a.status === "operational" ? 1 : 0) - (b.status === "operational" ? 1 : 0),
            )
            .map((line) => {
              const d = (byLine.get(line.id) ?? [])
                .map((s, i) => {
                  const p = project(s.lat, s.lng);
                  return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                })
                .join(" ");
              const operational = line.status === "operational";
              return (
                <path
                  key={line.id}
                  d={d}
                  fill="none"
                  stroke={operational ? lineSwatch(line.id) : "var(--inactive-swatch)"}
                  strokeWidth={operational ? 5.5 : 3}
                  strokeDasharray={operational ? undefined : "2 9"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={operational ? 1 : 0.75}
                />
              );
            })}

          {stations.map((s) => {
            const p = project(s.lat, s.lng);
            const operational = s.lines.some(
              (m) => lineById.get(m.line)?.status === "operational",
            );

            if (!operational) {
              return (
                <circle
                  key={s.id}
                  cx={p.x}
                  cy={p.y}
                  r={2.4}
                  fill="var(--surface)"
                  stroke="var(--inactive-swatch)"
                  strokeWidth={1.6}
                  opacity={0.75}
                />
              );
            }

            return (
              <g
                key={s.id}
                role="link"
                aria-label={s.interchange ? `${s.name} — interchange` : s.name}
                className="cursor-pointer"
                onClick={() => router.push(`/station/${s.slug}`)}
                onMouseEnter={() => setHovered(s.id)}
                onMouseLeave={() => setHovered((h) => (h === s.id ? null : h))}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={s.interchange ? 6.5 : 3.4}
                  fill="var(--surface)"
                  stroke={s.interchange ? "var(--ink)" : lineSwatch(s.lines[0].line)}
                  strokeWidth={s.interchange ? 3 : 2.2}
                />
                {/* Generous invisible hit target for touch and hover. */}
                <circle cx={p.x} cy={p.y} r={13} fill="transparent" />
              </g>
            );
          })}

          {stations
            .filter((s) => labelled.has(s.id))
            .map((s) => {
              const p = project(s.lat, s.lng);
              const dir = labelDirections.get(s.id) ?? { dx: 1, dy: 0 };
              return (
                <StationLabel
                  key={`label-${s.id}`}
                  x={p.x}
                  y={p.y}
                  dx={dir.dx}
                  dy={dir.dy}
                  text={displayName(s)}
                  bold={s.interchange}
                />
              );
            })}

          {/* Hover label for everything else, drawn last so it sits on top. */}
          {hoveredStation && !labelled.has(hoveredStation.id) && (
            <StationLabel
              x={project(hoveredStation.lat, hoveredStation.lng).x}
              y={project(hoveredStation.lat, hoveredStation.lng).y}
              dx={labelDirections.get(hoveredStation.id)?.dx ?? 1}
              dy={labelDirections.get(hoveredStation.id)?.dy ?? 0}
              text={displayName(hoveredStation)}
              bold
            />
          )}
        </svg>
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem]">
        {lines.map((l) => (
          <span key={l.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-[3px] w-5 rounded-full"
              style={{
                background:
                  l.status === "operational" ? lineSwatch(l.id) : "var(--inactive-swatch)",
              }}
            />
            <span className={l.status === "operational" ? "text-ink-secondary" : "text-ink-faint"}>
              {l.name}
              {l.status !== "operational" && " · opening soon"}
            </span>
          </span>
        ))}
      </figcaption>

      {/* Text equivalent of the map: reachable by keyboard and screen reader,
          and a useful index in its own right. */}
      <details className="mt-6 border-t border-hairline pt-4">
        <summary className="cursor-pointer text-sm font-medium text-ink-secondary transition-colors hover:text-ink">
          All stations by line
        </summary>
        <div className="mt-4 space-y-5">
          {lines
            .filter((l) => l.status === "operational")
            .map((line) => (
              <section key={line.id}>
                <h3
                  className="text-[0.8125rem] font-semibold"
                  style={{ color: `var(--${line.id}-ink)` }}
                >
                  {line.name}
                </h3>
                <ul className="mt-1.5 flex flex-wrap gap-x-1 gap-y-0.5 text-[0.8125rem]">
                  {(byLine.get(line.id) ?? []).map((s, i, arr) => (
                    <li key={s.id} className="flex items-center gap-1">
                      <Link
                        href={`/station/${s.slug}`}
                        className="text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
                      >
                        {displayName(s)}
                      </Link>
                      {i < arr.length - 1 && <span className="text-ink-faint">·</span>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      </details>
    </figure>
  );
}

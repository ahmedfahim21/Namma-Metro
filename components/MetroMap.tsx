"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { stations, lines, lineById, isTerminal, displayName } from "@/lib/network";
import { createProjection, polylinePath } from "@/lib/projection";
import { lineSwatch } from "./LineBadge";
import { ServiceAnimation, SPEED, type LinePath } from "./ServiceAnimation";
import type { Station } from "@/packages/network/src/schema";

const W = 680;
const PAD = 78;
const MIN_SCALE = 1;
const MAX_SCALE = 6;

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

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
  const reducedMotion = usePrefersReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);
  const [showService, setShowService] = useState(true);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [grabbing, setGrabbing] = useState(false);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { project, byLine, labelled, height, labelDirections, linePaths } = useMemo(() => {
    const projection = createProjection(stations, W, PAD, 1.6);
    const { project, height } = projection;

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

    const labelDirections = new Map(stations.map((s) => [s.id, labelDirection(s)] as const));

    const linePaths: LinePath[] = lines.map((line) => {
      const onLine = byLine.get(line.id) ?? [];
      const points = onLine.map((s) => project(s.lat, s.lng));
      return {
        lineId: line.id,
        stations: onLine,
        d: polylinePath(points),
        reversed: polylinePath([...points].reverse()),
      };
    });

    return { project, byLine, labelled, height, labelDirections, linePaths };
  }, []);

  const hoveredStation = hovered ? stations.find((s) => s.id === hovered) : null;

  const zoomBy = useCallback((factor: number, originX = W / 2, originY = height / 2) => {
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      if (scale === v.scale) return v;
      // Keep the point under the cursor fixed while scaling.
      const k = scale / v.scale;
      return {
        scale,
        x: originX - (originX - v.x) * k,
        y: originY - (originY - v.y) * k,
      };
    });
  }, [height]);

  function toSvgPoint(e: React.PointerEvent | React.WheelEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: W / 2, y: height / 2 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * height,
    };
  }

  const atDefaultView = view.scale === 1 && view.x === 0 && view.y === 0;

  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-lg border border-hairline bg-surface">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${Math.round(height)}`}
          width="100%"
          role="img"
          aria-label="Schematic map of the Namma Metro network. A full station list follows."
          className={`block touch-none ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
          onWheel={(e) => {
            if (!e.ctrlKey && Math.abs(e.deltaY) < 2) return;
            const p = toSvgPoint(e);
            zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
          }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY, moved: false };
            setGrabbing(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;
            const dx = ((e.clientX - drag.current.x) / rect.width) * W;
            const dy = ((e.clientY - drag.current.y) / rect.height) * height;
            if (Math.hypot(dx, dy) > 3) drag.current.moved = true;
            drag.current.x = e.clientX;
            drag.current.y = e.clientY;
            setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            drag.current = null;
            setGrabbing(false);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setGrabbing(false);
          }}
        >
          <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
            {/* Under-construction lines sit underneath the operational network. */}
            {[...lines]
              .sort(
                (a, b) =>
                  (a.status === "operational" ? 1 : 0) - (b.status === "operational" ? 1 : 0),
              )
              .map((line) => {
                const path = linePaths.find((p) => p.lineId === line.id);
                const operational = line.status === "operational";
                return (
                  <path
                    key={line.id}
                    d={path?.d ?? ""}
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

            {showService && !reducedMotion && <ServiceAnimation paths={linePaths} />}

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
                  onClick={() => {
                    // A pan shouldn't navigate.
                    if (drag.current?.moved) return;
                    router.push(`/station/${s.slug}`);
                  }}
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
          </g>
        </svg>

        {/* Map controls */}
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <div className="flex flex-col overflow-hidden rounded-md border border-hairline bg-surface">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => zoomBy(1.4)}
              className="grid h-8 w-8 place-items-center text-ink-secondary transition-colors hover:bg-sunken hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => zoomBy(1 / 1.4)}
              className="grid h-8 w-8 place-items-center border-t border-hairline text-ink-secondary transition-colors hover:bg-sunken hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {!atDefaultView && (
            <button
              type="button"
              onClick={() => setView({ x: 0, y: 0, scale: 1 })}
              className="rounded-md border border-hairline bg-surface px-2 py-1 text-[0.6875rem] font-medium text-ink-secondary transition-colors hover:bg-sunken hover:text-ink"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem]">
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
      </div>

      {!reducedMotion && (
        <figcaption className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-hairline pt-3 text-[0.8125rem] text-ink-muted">
          <button
            type="button"
            onClick={() => setShowService((s) => !s)}
            className="font-medium text-ink-secondary underline underline-offset-2 transition-colors hover:text-ink"
          >
            {showService ? "Hide service animation" : "Show service animation"}
          </button>
          <span>
            Train spacing is modelled from published frequency and runs at {SPEED}× speed — an
            illustration of how often trains come, not live positions.
          </span>
        </figcaption>
      )}

      {/* Text equivalent of the map: reachable by keyboard and screen reader,
          and a useful index in its own right. */}
      <details className="mt-5 border-t border-hairline pt-4">
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LineId, Station } from "@/packages/network/src/schema";
import { stations, lines, lineById } from "@/lib/network";
import {
  createTrainTimeline,
  frameBox,
  cumulativeLengths,
  getMapLayout,
  legPolyline,
  roundedPath,
} from "@/lib/mapLayout";
import { lineColor } from "./LineBadge";

export interface MapRoute {
  id: string;
  legs: { line: LineId; boardStation: string; alightStation: string; stations: string[] }[];
  originStation: string;
  destinationStation: string;
}

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function MetroMap({
  route,
  labelMode = "all",
  className,
  onStationClick,
}: {
  route?: MapRoute | null;
  /** "all" labels every station; "route" only labels the stations on `route`. */
  labelMode?: "all" | "route";
  className?: string;
  onStationClick?: (station: Station) => void;
}) {
  const layout = useMemo(() => getMapLayout(), []);
  const reducedMotion = usePrefersReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // Fill whatever shape the container is, rather than letter-boxing a fixed
  // canvas inside it.
  const [aspect, setAspect] = useState(layout.width / layout.height);
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setAspect(width / height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const fullView = useMemo<View>(() => frameBox(layout.bounds, aspect, 46), [layout, aspect]);
  const [view, setView] = useState<View>(fullView);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  const viewAnimation = useRef<number | null>(null);

  const animateViewTo = useCallback(
    (target: View) => {
      if (viewAnimation.current) cancelAnimationFrame(viewAnimation.current);
      const from = viewRef.current;
      const start = performance.now();
      const duration = reducedMotion ? 0 : 550;
      const step = (now: number) => {
        const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
        const k = easeInOutCubic(t);
        setView({
          x: from.x + (target.x - from.x) * k,
          y: from.y + (target.y - from.y) * k,
          w: from.w + (target.w - from.w) * k,
          h: from.h + (target.h - from.h) * k,
        });
        if (t < 1) viewAnimation.current = requestAnimationFrame(step);
      };
      viewAnimation.current = requestAnimationFrame(step);
    },
    [reducedMotion],
  );

  useEffect(() => () => {
    if (viewAnimation.current) cancelAnimationFrame(viewAnimation.current);
  }, []);

  const geometryByLine = useMemo(
    () => new Map(layout.geometries.map((g) => [g.line, g])),
    [layout],
  );

  /** The drawn route, split per leg so each keeps its own line colour. */
  const routeLegs = useMemo(() => {
    if (!route) return null;
    return route.legs
      .map((leg) => {
        const geometry = geometryByLine.get(leg.line);
        if (!geometry) return null;
        const points = legPolyline(geometry, leg.boardStation, leg.alightStation);
        if (points.length < 2) return null;
        return { line: leg.line, points, length: cumulativeLengths(points) };
      })
      .filter((leg): leg is NonNullable<typeof leg> => leg !== null);
  }, [route, geometryByLine]);

  const routeStationIds = useMemo(() => {
    if (!route) return null;
    return new Set(route.legs.flatMap((leg) => leg.stations));
  }, [route]);

  // Frame the route when it changes; fall back to the whole network.
  useEffect(() => {
    if (!routeLegs || routeLegs.length === 0) {
      animateViewTo(fullView);
      return;
    }
    const points = routeLegs.flatMap((leg) => leg.points);
    // Generous padding so terminus labels aren't clipped by the frame.
    animateViewTo(
      frameBox(
        {
          minX: Math.min(...points.map((p) => p.x)),
          minY: Math.min(...points.map((p) => p.y)),
          maxX: Math.max(...points.map((p) => p.x)),
          maxY: Math.max(...points.map((p) => p.y)),
        },
        aspect,
        150,
      ),
    );
  }, [routeLegs, fullView, aspect, animateViewTo]);

  // ---- travelling train ----------------------------------------------------
  const [train, setTrain] = useState<{ x: number; y: number; angle: number; line: LineId } | null>(null);
  const trainFrame = useRef<number | null>(null);

  useEffect(() => {
    if (trainFrame.current) cancelAnimationFrame(trainFrame.current);
    // No route: the marker is hidden at render time, nothing to drive here.
    if (!routeLegs || routeLegs.length === 0) return;

    const timeline = createTrainTimeline(routeLegs);
    if (!timeline) return;

    const place = (elapsed: number) => {
      const pose = timeline.at(elapsed);
      setTrain({ x: pose.x, y: pose.y, angle: pose.angle, line: routeLegs[pose.legIndex].line });
    };

    if (reducedMotion) {
      // Park the train at the origin rather than moving it about.
      trainFrame.current = requestAnimationFrame(() => place(0));
    } else {
      const start = performance.now();
      const step = (now: number) => {
        place(now - start);
        trainFrame.current = requestAnimationFrame(step);
      };
      trainFrame.current = requestAnimationFrame(step);
    }

    return () => {
      if (trainFrame.current) cancelAnimationFrame(trainFrame.current);
    };
  }, [routeLegs, reducedMotion]);

  // ---- pan & zoom ----------------------------------------------------------
  const drag = useRef<{ x: number; y: number; view: View } | null>(null);
  const [panning, setPanning] = useState(false);

  const zoomBy = useCallback(
    (factor: number, focus?: { x: number; y: number }) => {
      const v = viewRef.current;
      const w = Math.max(140, Math.min(layout.width * 1.6, v.w / factor));
      const h = w * (v.h / v.w);
      const fx = focus ? (focus.x - v.x) / v.w : 0.5;
      const fy = focus ? (focus.y - v.y) / v.h : 0.5;
      setView({ x: v.x + (v.w - w) * fx, y: v.y + (v.h - h) * fy, w, h });
    },
    [layout.width],
  );

  const toUserSpace = useCallback((event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: v.x + ((event.clientX - rect.left) / rect.width) * v.w,
      y: v.y + ((event.clientY - rect.top) / rect.height) * v.h,
    };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const focus = toUserSpace(event);
      zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15, focus ?? undefined);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomBy, toUserSpace]);

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, view: viewRef.current };
    setPanning(true);
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!drag.current || !svg) return;
    const rect = svg.getBoundingClientRect();
    const { view: from } = drag.current;
    setView({
      ...from,
      x: from.x - ((event.clientX - drag.current.x) / rect.width) * from.w,
      y: from.y - ((event.clientY - drag.current.y) / rect.height) * from.h,
    });
  };
  const endDrag = () => {
    drag.current = null;
    setPanning(false);
  };

  // ---- drawing -------------------------------------------------------------
  const [hovered, setHovered] = useState<string | null>(null);
  const zoom = layout.width / view.w;
  const dimmed = routeLegs !== null && routeLegs.length > 0;

  const showLabel = (station: Station, isEndpoint: boolean) => {
    if (hovered === station.id) return true;
    if (labelMode === "route") {
      if (!routeStationIds?.has(station.id)) return false;
      return isEndpoint || station.interchange || zoom > 2.1;
    }
    return station.interchange || zoom > 1.45;
  };

  return (
    <div
      ref={frameRef}
      className={`relative overflow-hidden rounded-2xl border border-border bg-map-bg shadow-sm ${className ?? ""}`}
    >
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="h-full w-full touch-none select-none"
        style={{ cursor: panning ? "grabbing" : "grab" }}
        role="img"
        aria-label="Namma Metro network map"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <defs>
          <pattern id="metro-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--map-grid)" />
          </pattern>
        </defs>
        <rect x={-3000} y={-3000} width={9000} height={9000} fill="var(--map-bg)" />
        <rect x={-3000} y={-3000} width={9000} height={9000} fill="url(#metro-grid)" />

        {/* casings, so crossings read as over/under rather than a blob */}
        {layout.geometries.map((geometry) => (
          <path
            key={`casing-${geometry.line}`}
            d={roundedPath(geometry.points)}
            fill="none"
            stroke="var(--map-bg)"
            strokeWidth={13}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={dimmed ? 0.4 : 1}
          />
        ))}

        {layout.geometries.map((geometry) => {
          const operational = geometry.status === "operational";
          return (
            <path
              key={geometry.line}
              d={roundedPath(geometry.points)}
              fill="none"
              stroke={operational ? lineColor(geometry.line) : "var(--muted)"}
              strokeWidth={operational ? 7 : 4.5}
              strokeDasharray={operational ? undefined : "9 9"}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={dimmed ? 0.16 : operational ? 1 : 0.5}
              className="transition-opacity duration-500"
            />
          );
        })}

        {/* the planned route, drawn on top and traced in */}
        {routeLegs?.map((leg, i) => (
          <g key={`${route?.id}-${i}`}>
            <path
              d={roundedPath(leg.points)}
              fill="none"
              stroke={lineColor(leg.line)}
              strokeWidth={18}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.12}
            />
            <path
              d={roundedPath(leg.points)}
              fill="none"
              stroke={lineColor(leg.line)}
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={reducedMotion ? undefined : "route-trace"}
              style={{ "--trace-length": leg.length[leg.length.length - 1] } as React.CSSProperties}
            />
          </g>
        ))}

        {stations.map((station) => {
          const p = layout.positions.get(station.id);
          if (!p) return null;
          const operational = station.lines.some((m) => lineById.get(m.line)?.status === "operational");
          const onRoute = routeStationIds?.has(station.id) ?? false;
          const isEndpoint =
            station.id === route?.originStation || station.id === route?.destinationStation;
          const color = operational ? lineColor(station.lines[0].line) : "var(--muted)";
          const placement = station.interchange ? "right" : layout.labels.get(station.id) ?? "right";
          const radius = station.interchange ? 6.5 : 4;
          const faded = dimmed && !onRoute;
          const labelled = showLabel(station, isEndpoint);

          return (
            <g
              key={station.id}
              transform={`translate(${p.x},${p.y})`}
              opacity={faded ? 0.28 : 1}
              className="transition-opacity duration-500"
              onClick={() => operational && onStationClick?.(station)}
              onPointerEnter={() => setHovered(station.id)}
              onPointerLeave={() => setHovered((id) => (id === station.id ? null : id))}
              style={{ cursor: operational && onStationClick ? "pointer" : "default" }}
            >
              {isEndpoint && <circle r={16} fill={color} opacity={0.16} />}
              <circle
                r={isEndpoint ? radius + 2 : radius}
                fill="var(--map-bg)"
                stroke={station.interchange ? "var(--foreground)" : color}
                strokeWidth={station.interchange ? 2.5 : 2.5}
              />
              {isEndpoint && <circle r={radius - 1} fill={color} />}
              {labelled && (
                <text
                  x={placement === "diagonal" ? 9 : 12}
                  y={placement === "diagonal" ? -7 : 4}
                  transform={placement === "diagonal" ? "rotate(-35)" : undefined}
                  fontSize={station.interchange || isEndpoint ? 12 : 10.5}
                  letterSpacing="0.01em"
                  fill="var(--foreground)"
                  stroke="var(--map-bg)"
                  strokeWidth={4}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  className="pointer-events-none"
                >
                  {station.name}
                </text>
              )}
              <title>{station.interchange ? `${station.name} — interchange` : station.name}</title>
            </g>
          );
        })}

        {train && dimmed && (
          <g transform={`translate(${train.x},${train.y})`} className="pointer-events-none">
            <circle r={17} fill={lineColor(train.line)} opacity={0.16} />
            <g transform={`rotate(${train.angle})`}>
              <rect x={-14} y={-6} width={28} height={12} rx={6} fill="var(--map-bg)" />
              <rect x={-12.5} y={-4.5} width={25} height={9} rx={4.5} fill={lineColor(train.line)} />
              <circle cx={8} cy={0} r={1.6} fill="var(--map-bg)" />
            </g>
          </g>
        )}
      </svg>

      <div className="absolute top-4 right-4 flex flex-col overflow-hidden rounded-xl border border-border bg-surface/85 shadow-sm backdrop-blur">
        <button
          type="button"
          aria-label="Zoom in"
          className="px-3 py-2 text-muted transition-colors hover:bg-background hover:text-foreground"
          onClick={() => zoomBy(1.4)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          className="border-t border-border px-3 py-2 text-muted transition-colors hover:bg-background hover:text-foreground"
          onClick={() => zoomBy(1 / 1.4)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M1.5 7h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Fit map"
          className="border-t border-border px-3 py-2 text-muted transition-colors hover:bg-background hover:text-foreground"
          onClick={() => animateViewTo(fullView)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden fill="none">
            <path
              d="M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border bg-surface/85 px-3 py-2 text-[11px] tracking-wide text-muted shadow-sm backdrop-blur">
        {lines.map((line) => (
          <span key={line.id} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: line.status === "operational" ? lineColor(line.id) : "var(--muted)" }}
            />
            <span className={line.status === "operational" ? "text-foreground" : undefined}>
              {line.name.replace(" Line", "")}
            </span>
            {line.status !== "operational" && <span>soon</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

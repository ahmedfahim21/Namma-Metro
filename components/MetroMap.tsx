"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { LineId, Station } from "@/packages/network/src/schema";
import {
  dateInIST,
  formatOpenDate,
  isInService,
  isNewlyOpened,
  openState,
} from "@/packages/network/src/status";
import { tokenFareForDistance } from "@/packages/fares/src/index";
import {
  stations,
  segments,
  lines,
  stationById,
  fareRules,
  getRouter,
  isRoutable,
  segmentBetween,
} from "@/lib/network";
import {
  createTrainTimeline,
  frameBox,
  frameFromPositions,
  cumulativeLengths,
  getMapLayout,
  legPolyline,
  mapLabel,
  roundedPath,
  schematicFrame,
  styleRuns,
  tweenFrame,
  type MapFrame,
} from "@/lib/mapLayout";
import { radialLayout } from "@/lib/isochrone";
import { monthEnd, monthRange, networkAt, openingEvents, stationFirstDates } from "@/lib/timeline";
import { atSecondsOfDay } from "@/lib/liveTrains";
import { formatCurrency } from "@/lib/format";
import { lineColor } from "./LineBadge";
import { createSimClock } from "./map/simClock";
import { DayScrubber, LiveReadout, LiveTrainsLayer } from "./map/LiveTrainsLayer";

export interface MapRoute {
  id: string;
  legs: { line: LineId; boardStation: string; alightStation: string; stations: string[] }[];
  originStation: string;
  destinationStation: string;
}

export type MapMode = "network" | "live" | "time" | "timeline";

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MODES: { id: MapMode; label: string }[] = [
  { id: "network", label: "Network" },
  { id: "live", label: "Live" },
  { id: "time", label: "Travel time" },
  { id: "timeline", label: "Timeline" },
];

const SPEEDS = [
  { value: 1, label: "Real time" },
  { value: 30, label: "30×" },
  { value: 120, label: "120×" },
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TIMELINE_STEP_MS = 70;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

const subscribeNever = () => () => {};

/** Today's date in Bengaluru once running in the browser; null while server-rendering. */
function useToday(): string | null {
  return useSyncExternalStore(
    subscribeNever,
    () => dateInIST(new Date()),
    () => null,
  );
}

function lineName(line: LineId): string {
  return lines.find((l) => l.id === line)?.name ?? line;
}

/** One stretch of line to paint. */
interface Stroke {
  key: string;
  line: LineId;
  d: string;
  planned: boolean;
  /** Pulse a halo behind it: a stretch that is about to open or has just opened. */
  fresh: boolean;
  /** Animate it drawing itself in when it first appears. */
  drawIn: boolean;
}

export function MetroMap({
  route,
  labelMode = "all",
  className,
  onStationClick,
  explore = false,
  ambientTrains = false,
}: {
  route?: MapRoute | null;
  /** "all" labels every station; "route" only labels the stations on `route`. */
  labelMode?: "all" | "route";
  className?: string;
  onStationClick?: (station: Station) => void;
  /** Show the mode switcher: live trains, travel-time rings, growth timeline, real geography. */
  explore?: boolean;
  /** Run simulated trains in the background when no route is being shown. */
  ambientTrains?: boolean;
}) {
  const layout = useMemo(() => getMapLayout(), []);
  const reducedMotion = usePrefersReducedMotion();
  const today = useToday();
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<MapMode>("network");
  const [geographic, setGeographic] = useState(false);
  const [timeOrigin, setTimeOrigin] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);

  // ---- travel-time arrangement ----------------------------------------------
  const reach = useMemo(
    () => (mode === "time" && timeOrigin ? getRouter().reachFrom(timeOrigin) : null),
    [mode, timeOrigin],
  );
  const radial = useMemo(
    () => (reach && timeOrigin ? radialLayout(layout, timeOrigin, reach) : null),
    [layout, reach, timeOrigin],
  );

  // ---- timeline -------------------------------------------------------------
  const events = useMemo(() => openingEvents(segments), []);
  const firstDates = useMemo(() => stationFirstDates(stations), []);
  const months = useMemo(() => monthRange(events), [events]);
  const [monthIndex, setMonthIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timelineDate = mode === "timeline" ? monthEnd(months[monthIndex]) : null;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setMonthIndex((i) => {
        if (i >= months.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, TIMELINE_STEP_MS);
    return () => clearInterval(timer);
  }, [playing, months.length]);

  const chooseMode = (next: MapMode) => {
    setMode(next);
    setPlaying(false);
    if (next === "timeline") {
      // Someone who has asked for less motion gets the finished picture, not the film.
      setMonthIndex(reducedMotion ? months.length - 1 : 0);
      setPlaying(!reducedMotion);
    }
    if (next !== "live") setSpeed(1);
  };

  // ---- simulated clock for live trains --------------------------------------
  const clock = useMemo(() => createSimClock({ calm: reducedMotion }), [reducedMotion]);
  useEffect(() => clock.setSpeed(speed), [clock, speed]);
  const showTrains = mode === "live" || (ambientTrains && mode === "network");

  // ---- which arrangement of the network to draw -----------------------------
  const target = useMemo<MapFrame>(() => {
    if (radial) return frameFromPositions(layout, radial.positions);
    if (geographic && mode !== "time") return frameFromPositions(layout, layout.geo);
    return schematicFrame(layout);
  }, [layout, radial, geographic, mode]);

  const [frame, setFrame] = useState<MapFrame>(target);
  const frameRef = useRef(frame);
  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    const from = frameRef.current;
    if (from === target) return;
    const start = performance.now();
    const duration = reducedMotion ? 0 : 900;
    let raf = requestAnimationFrame(function step(now: number) {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      setFrame(tweenFrame(from, target, easeInOutCubic(t)));
      if (t < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [target, reducedMotion]);

  // ---- view box -------------------------------------------------------------
  // Fill whatever shape the container is, rather than letter-boxing a fixed canvas inside it.
  const [aspect, setAspect] = useState(layout.width / layout.height);
  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setAspect(width / height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const fullView = useMemo<View>(() => {
    if (radial) {
      const r = radial.maxMinutes * radial.pixelsPerMinute;
      return frameBox(
        {
          minX: radial.center.x - r,
          minY: radial.center.y - r,
          maxX: radial.center.x + r,
          maxY: radial.center.y + r,
        },
        aspect,
        22,
      );
    }
    return frameBox(target.bounds, aspect, 46);
  }, [radial, target, aspect]);

  const [view, setView] = useState<View>(fullView);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  const viewAnimation = useRef<number | null>(null);

  const animateViewTo = useCallback(
    (to: View) => {
      if (viewAnimation.current) cancelAnimationFrame(viewAnimation.current);
      const from = viewRef.current;
      const start = performance.now();
      const duration = reducedMotion ? 0 : 550;
      const step = (now: number) => {
        const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
        const k = easeInOutCubic(t);
        setView({
          x: from.x + (to.x - from.x) * k,
          y: from.y + (to.y - from.y) * k,
          w: from.w + (to.w - from.w) * k,
          h: from.h + (to.h - from.h) * k,
        });
        if (t < 1) viewAnimation.current = requestAnimationFrame(step);
      };
      viewAnimation.current = requestAnimationFrame(step);
    },
    [reducedMotion],
  );

  useEffect(
    () => () => {
      if (viewAnimation.current) cancelAnimationFrame(viewAnimation.current);
    },
    [],
  );

  const geometryByLine = useMemo(() => new Map(frame.geometries.map((g) => [g.line, g])), [frame]);
  const restingGeometryByLine = useMemo(
    () => new Map(target.geometries.map((g) => [g.line, g])),
    [target],
  );

  /** The drawn route, split per leg so each keeps its own line colour. */
  const routeLegs = useMemo(() => {
    if (!route || mode !== "network") return null;
    return route.legs
      .map((leg) => {
        const geometry = restingGeometryByLine.get(leg.line);
        if (!geometry) return null;
        const points = legPolyline(geometry, leg.boardStation, leg.alightStation);
        if (points.length < 2) return null;
        return { line: leg.line, points, length: cumulativeLengths(points) };
      })
      .filter((leg): leg is NonNullable<typeof leg> => leg !== null);
  }, [route, mode, restingGeometryByLine]);

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

  // ---- travelling train along a planned route -------------------------------
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

  // ---- pan & zoom -----------------------------------------------------------
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

  // ---- what to paint --------------------------------------------------------
  const [hovered, setHovered] = useState<string | null>(null);
  const zoom = layout.width / view.w;
  const dimmed = routeLegs !== null && routeLegs.length > 0;
  const schematic = !geographic && mode !== "time";

  const strokes = useMemo<Stroke[]>(() => {
    if (timelineDate) {
      return events
        .filter((event) => event.date <= timelineDate)
        .map((event) => {
          const geometry = geometryByLine.get(event.line)!;
          return {
            key: event.id,
            line: event.line,
            d: roundedPath(legPolyline(geometry, event.from, event.to)),
            planned: event.planned,
            fresh: false,
            drawIn: true,
          };
        });
    }
    return frame.geometries.flatMap((geometry) =>
      styleRuns(geometry, (from, to) => {
        const segment = segmentBetween(geometry.line, from, to);
        if (!isInService(segment)) return "planned";
        // Before hydration there is no date to compare with; draw it as plain open track.
        if (!today) return "open";
        return openState(segment, today) === "opens_soon" || isNewlyOpened(segment, today) ? "fresh" : "open";
      })
        // The travel-time picture only makes sense for track you can ride.
        .filter((run) => mode !== "time" || run.key !== "planned")
        .map((run) => ({
          key: `${geometry.line}:${run.from}:${run.to}`,
          line: geometry.line,
          d: roundedPath(run.points),
          planned: run.key === "planned",
          fresh: run.key === "fresh",
          drawIn: false,
        })),
    );
  }, [timelineDate, events, geometryByLine, frame, today, mode]);

  const timelineStats = useMemo(
    () => (timelineDate ? networkAt(events, firstDates, timelineDate) : null),
    [timelineDate, events, firstDates],
  );
  const latestEvent = useMemo(
    () => (timelineDate ? [...events].reverse().find((event) => event.date <= timelineDate) : undefined),
    [timelineDate, events],
  );

  const terminalIds = useMemo(
    () => new Set(frame.geometries.flatMap((g) => [g.points[0].stationId!, g.points[g.points.length - 1].stationId!])),
    [frame],
  );

  const showLabel = (station: Station, isEndpoint: boolean) => {
    if (hovered === station.id) return true;
    if (mode === "time" && timeOrigin) {
      return station.id === timeOrigin || terminalIds.has(station.id) || zoom > 2.2;
    }
    if (labelMode === "route") {
      if (!routeStationIds?.has(station.id)) return false;
      return isEndpoint || station.interchange || zoom > 2.1;
    }
    if (!schematic) return station.interchange || terminalIds.has(station.id) || zoom > 2;
    return station.interchange || terminalIds.has(station.id) || zoom > 1.45;
  };

  const handleStationClick = (station: Station) => {
    if (mode === "time") {
      if (isRoutable(station)) setTimeOrigin(station.id);
      return;
    }
    onStationClick?.(station);
  };

  const hoveredStation = hovered ? stationById.get(hovered) : undefined;
  const hoveredReach = hovered && reach ? reach.get(hovered) : undefined;
  const pinkLine = lines.find((l) => l.id === "pink");

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-map-bg shadow-sm ${className ?? ""}`}
    >
      {explore && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
          <div role="tablist" aria-label="Map view" className="flex rounded-lg bg-background p-0.5 text-[13px]">
            {MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={mode === option.id}
                onClick={() => chooseMode(option.id)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  mode === option.id
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {mode !== "time" && (
            <div className="flex rounded-lg bg-background p-0.5 text-[13px]" role="group" aria-label="Map style">
              {[
                { value: false, label: "Diagram" },
                { value: true, label: "Real geography" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={geographic === option.value}
                  onClick={() => setGeographic(option.value)}
                  className={`rounded-md px-3 py-1.5 transition-colors ${
                    geographic === option.value
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={canvasRef} className="relative min-h-0 flex-1">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className="absolute inset-0 h-full w-full touch-none select-none"
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
          <rect
            x={-3000}
            y={-3000}
            width={9000}
            height={9000}
            fill="url(#metro-grid)"
            opacity={radial ? 0 : 1}
            className="transition-opacity duration-500"
          />

          {/* rings of equal journey time */}
          {radial && (
            <g className="map-fade-in pointer-events-none">
              {radial.rings.map((minutes) => {
                const r = minutes * radial.pixelsPerMinute;
                return (
                  <g key={minutes}>
                    <circle
                      cx={radial.center.x}
                      cy={radial.center.y}
                      r={r}
                      fill="none"
                      stroke="var(--map-ring)"
                      strokeWidth={1.2}
                    />
                    <text
                      x={radial.center.x}
                      y={radial.center.y - r - 5}
                      textAnchor="middle"
                      fontSize={10.5}
                      letterSpacing="0.04em"
                      fill="var(--muted)"
                      stroke="var(--map-bg)"
                      strokeWidth={4}
                      paintOrder="stroke"
                    >
                      {minutes} min
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* casings, so crossings read as over/under rather than a blob */}
          {strokes
            .filter((stroke) => !stroke.planned)
            .map((stroke) => (
              <path
                key={`casing-${stroke.key}`}
                d={stroke.d}
                fill="none"
                stroke="var(--map-bg)"
                strokeWidth={13}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={dimmed ? 0.4 : 1}
              />
            ))}

          {strokes
            .filter((stroke) => stroke.fresh)
            .map((stroke) => (
              <path
                key={`halo-${stroke.key}`}
                d={stroke.d}
                fill="none"
                stroke={lineColor(stroke.line)}
                strokeWidth={20}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="line-halo"
                style={dimmed ? { display: "none" } : undefined}
              />
            ))}

          {strokes.map((stroke) => (
            <path
              key={stroke.key}
              d={stroke.d}
              fill="none"
              stroke={lineColor(stroke.line)}
              strokeWidth={stroke.planned ? 4 : 7}
              strokeDasharray={stroke.planned ? "0.1 9" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={stroke.drawIn && !stroke.planned ? 1 : undefined}
              opacity={dimmed ? 0.16 : stroke.planned ? 0.6 : 1}
              className={
                stroke.drawIn
                  ? stroke.planned
                    ? "map-fade-in"
                    : "line-draw-in"
                  : "transition-opacity duration-500"
              }
            />
          ))}

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
            const p = frame.positions.get(station.id);
            if (!p) return null;
            if (timelineDate && firstDates.get(station.id)!.date > timelineDate) return null;
            const inService = isRoutable(station);
            if (mode === "time" && !inService) return null;

            const onRoute = routeStationIds?.has(station.id) ?? false;
            const isEndpoint =
              mode === "network" &&
              (station.id === route?.originStation || station.id === route?.destinationStation);
            const isOrigin = mode === "time" && station.id === timeOrigin;
            const drawnLine = (station.lines.find(isInService) ?? station.lines[0]).line;
            const color = lineColor(drawnLine);
            const placement = schematic
              ? layout.labels.get(station.id) ?? "right"
              : mode === "time"
                ? "right"
                : layout.geoLabels.get(station.id) ?? "right";
            const labelAt = (
              {
                right: { x: 12, y: 4, anchor: "start" },
                left: { x: -12, y: 4, anchor: "end" },
                above: { x: 0, y: -14, anchor: "middle" },
                below: { x: 0, y: 23, anchor: "middle" },
                diagonal: { x: 9, y: -7, anchor: "start" },
              } as const
            )[placement];
            // With trains on the map the stations step back so the movement reads.
            const radius = station.interchange ? 6.5 : !inService ? 3 : mode === "live" ? 2.6 : 4;
            const faded = dimmed && !onRoute;
            const emphasised = isEndpoint || isOrigin;
            const clickable = mode === "time" ? inService : Boolean(onStationClick);

            return (
              <g
                key={station.id}
                transform={`translate(${p.x},${p.y})`}
                opacity={faded ? 0.28 : inService ? 1 : 0.7}
                className={timelineDate ? "map-fade-in" : "transition-opacity duration-500"}
                onClick={() => handleStationClick(station)}
                onPointerEnter={() => setHovered(station.id)}
                onPointerLeave={() => setHovered((id) => (id === station.id ? null : id))}
                style={{ cursor: clickable ? "pointer" : "default" }}
              >
                {/* a generous invisible target: station dots are small on a phone */}
                <circle r={11} fill="transparent" />
                {emphasised && <circle r={16} fill={color} opacity={0.16} />}
                <circle
                  r={emphasised ? radius + 2 : radius}
                  fill="var(--map-bg)"
                  stroke={station.interchange ? "var(--foreground)" : color}
                  strokeWidth={!inService ? 1.6 : mode === "live" && !station.interchange ? 1.6 : 2.5}
                />
                {emphasised && <circle r={radius - 1} fill={color} />}
                {showLabel(station, isEndpoint) && (
                  <text
                    x={labelAt.x}
                    y={labelAt.y}
                    textAnchor={labelAt.anchor}
                    transform={placement === "diagonal" ? "rotate(-35)" : undefined}
                    fontSize={station.interchange || emphasised ? 12 : 10.5}
                    letterSpacing="0.01em"
                    fill="var(--foreground)"
                    stroke="var(--map-bg)"
                    strokeWidth={4}
                    paintOrder="stroke"
                    strokeLinejoin="round"
                    className="pointer-events-none"
                  >
                    {mapLabel(station)}
                  </text>
                )}
              </g>
            );
          })}

          {showTrains && (
            <LiveTrainsLayer clock={clock} geometries={frame.geometries} opacity={dimmed ? 0 : 1} />
          )}

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

        {hoveredStation && (
          <div className="pointer-events-none absolute top-3 left-3 max-w-[70%] rounded-xl border border-border bg-surface/90 px-3 py-2 shadow-sm backdrop-blur">
            <div className="text-sm tracking-tight text-foreground">{hoveredStation.name}</div>
            {hoveredStation.nameKn && <div className="text-xs text-muted">{hoveredStation.nameKn}</div>}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
              {hoveredStation.lines.map((membership) => {
                const state = today ? openState(membership, today) : null;
                return (
                  <span key={membership.line} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: lineColor(membership.line) }} />
                    {lineName(membership.line).replace(" Line", "")}
                    {state === "opens_soon" && membership.openDate && (
                      <span>· opens {formatOpenDate(membership.openDate, false)}</span>
                    )}
                    {state === "planned" && <span>· {membership.expected ?? "under construction"}</span>}
                  </span>
                );
              })}
            </div>
            {mode === "time" && timeOrigin && hoveredReach && hoveredStation.id !== timeOrigin && (
              <div className="mt-1 text-xs text-foreground tabular-nums">
                {Math.round(hoveredReach.seconds / 60)} min ·{" "}
                {formatCurrency(tokenFareForDistance(hoveredReach.meters, fareRules))} ·{" "}
                {hoveredReach.interchanges === 0
                  ? "direct"
                  : `${hoveredReach.interchanges} change${hoveredReach.interchanges === 1 ? "" : "s"}`}
              </div>
            )}
          </div>
        )}

        <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-xl border border-border bg-surface/85 shadow-sm backdrop-blur">
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

        <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border bg-surface/85 px-3 py-2 text-[11px] tracking-wide text-muted shadow-sm backdrop-blur">
          {lines.map((line) => (
            <span key={line.id} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: lineColor(line.id) }} />
              <span className="text-foreground">{line.name.replace(" Line", "")}</span>
            </span>
          ))}
          {pinkLine && (
            <span className="flex items-center gap-1.5">
              <svg width="18" height="4" viewBox="0 0 18 4" aria-hidden>
                <path
                  d="M2 2h14"
                  stroke={lineColor("pink")}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="0.1 6"
                />
              </svg>
              under construction
            </span>
          )}
        </div>
      </div>

      {explore && mode === "live" && (
        <div className="border-t border-border bg-surface px-4 py-3 text-[13px]">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <LiveReadout clock={clock} />
            <div className="flex items-center gap-1">
              {/* Speeding the clock up is exactly the motion a reduced-motion user asked not to get. */}
              {!reducedMotion &&
                SPEEDS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={speed === option.value}
                    onClick={() => {
                      setSpeed(option.value);
                      if (option.value === 1) clock.resetToNow();
                    }}
                    className={`rounded-md px-2.5 py-1 transition-colors ${
                      speed === option.value ? "bg-background text-foreground" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
            </div>
          </div>
          <div className="mt-2">
            <DayScrubber
              clock={clock}
              onScrub={(seconds) => clock.jumpTo(atSecondsOfDay(clock.getSnapshot(), seconds))}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Simulated from the timetable. BMRCL publishes no live train positions, so use this for the
            shape of the service, not to catch a particular train.
          </p>
        </div>
      )}

      {explore && mode === "time" && (
        <div className="border-t border-border bg-surface px-4 py-3 text-[13px]">
          {timeOrigin ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="text-muted">Minutes from </span>
                <span className="text-foreground">{stationById.get(timeOrigin)?.name}</span>
              </span>
              <button
                type="button"
                className="rounded-md px-2.5 py-1 text-muted transition-colors hover:bg-background hover:text-foreground"
                onClick={() => setTimeOrigin(null)}
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="text-foreground">Tap any station to see how far the network reaches from it.</span>
          )}
          <p className="mt-1 text-[11px] text-muted">
            Distance from the centre is journey time: riding plus walking between platforms, without
            waiting for a train. Direction is the real compass bearing.
          </p>
        </div>
      )}

      {explore && mode === "timeline" && timelineStats && (
        <div className="border-t border-border bg-surface px-4 py-3 text-[13px]">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span className="tabular-nums">
              <span className="text-base tracking-tight text-foreground">
                {MONTH_LABELS[Number(months[monthIndex].slice(5)) - 1]} {months[monthIndex].slice(0, 4)}
              </span>
              <span className="ml-2 text-muted">
                {(timelineStats.meters / 1000).toFixed(1)} km · {timelineStats.stations} stations ·{" "}
                {timelineStats.lines} line{timelineStats.lines === 1 ? "" : "s"}
                {timelineStats.plannedMeters > 0 &&
                  ` · plus ${(timelineStats.plannedMeters / 1000).toFixed(1)} km and ${timelineStats.plannedStations} stations being built`}
              </span>
            </span>
            <button
              type="button"
              className="rounded-md px-2.5 py-1 text-muted transition-colors hover:bg-background hover:text-foreground"
              onClick={() => {
                if (!playing && monthIndex >= months.length - 1) setMonthIndex(0);
                setPlaying((p) => !p);
              }}
            >
              {playing ? "Pause" : monthIndex >= months.length - 1 ? "Replay" : "Play"}
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={months.length - 1}
            value={monthIndex}
            onChange={(event) => {
              setPlaying(false);
              setMonthIndex(Number(event.target.value));
            }}
            aria-label="Month"
            className="map-range mt-2 w-full"
          />
          {latestEvent && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: lineColor(latestEvent.line) }} />
              {latestEvent.planned ? "Planned " : ""}
              {formatOpenDate(latestEvent.date).replace(/^1 /, latestEvent.planned ? "" : "1 ")} ·{" "}
              {lineName(latestEvent.line)} · {stationById.get(latestEvent.from)?.name} to{" "}
              {stationById.get(latestEvent.to)?.name} · {(latestEvent.meters / 1000).toFixed(1)} km
            </p>
          )}
        </div>
      )}
    </div>
  );
}

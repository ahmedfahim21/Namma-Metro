"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { stations, lines, lineById } from "@/lib/network";
import { lineColor } from "./LineBadge";

const WIDTH = 640;
const HEIGHT = 640;
const PADDING = 32;

export function MetroMap() {
  const router = useRouter();

  const { project, byLine } = useMemo(() => {
    const lats = stations.map((s) => s.lat);
    const lngs = stations.map((s) => s.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const avgLat = (minLat + maxLat) / 2;
    const lngScale = Math.cos((avgLat * Math.PI) / 180);

    const spanX = (maxLng - minLng) * lngScale || 1;
    const spanY = maxLat - minLat || 1;
    const scale = Math.min((WIDTH - 2 * PADDING) / spanX, (HEIGHT - 2 * PADDING) / spanY);

    function project(lat: number, lng: number) {
      const x = PADDING + (lng - minLng) * lngScale * scale;
      // Flip Y: latitude increases northward, SVG y increases downward.
      const y = PADDING + (maxLat - lat) * scale;
      return { x, y };
    }

    const byLine = new Map<string, typeof stations>();
    for (const line of lines) {
      const onLine = stations
        .filter((s) => s.lines.some((m) => m.line === line.id))
        .sort((a, b) => (a.lines.find((m) => m.line === line.id)?.sequence ?? 0) - (b.lines.find((m) => m.line === line.id)?.sequence ?? 0));
      byLine.set(line.id, onLine);
    }

    return { project, byLine };
  }, []);

  return (
    <div className="overflow-auto rounded-xl border border-border bg-surface p-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Namma Metro line map">
        {lines.map((line) => {
          const onLine = byLine.get(line.id) ?? [];
          const points = onLine.map((s) => project(s.lat, s.lng));
          const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
          const isOperational = line.status === "operational";
          return (
            <path
              key={line.id}
              d={path}
              fill="none"
              stroke={isOperational ? lineColor(line.id) : "#9ca3af"}
              strokeWidth={isOperational ? 4 : 3}
              strokeDasharray={isOperational ? undefined : "6 5"}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={isOperational ? 1 : 0.6}
            />
          );
        })}
        {stations.map((s) => {
          const p = project(s.lat, s.lng);
          const isOperational = s.lines.some((m) => lineById.get(m.line)?.status === "operational");
          return (
            <g
              key={s.id}
              transform={`translate(${p.x},${p.y})`}
              className={isOperational ? "cursor-pointer" : ""}
              onClick={() => isOperational && router.push(`/station/${s.slug}`)}
            >
              <circle
                r={s.interchange ? 6 : 3.5}
                fill={isOperational ? "var(--surface)" : "#d1d5db"}
                stroke={isOperational ? (s.interchange ? "#111" : lineColor(s.lines[0].line)) : "#9ca3af"}
                strokeWidth={s.interchange ? 2.5 : 2}
              />
              <title>{s.interchange ? `${s.name} — interchange` : s.name}</title>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 px-1 text-xs">
        {lines.map((l) => (
          <span key={l.id} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: l.status === "operational" ? lineColor(l.id) : "#9ca3af" }}
            />
            {l.name}
            {l.status !== "operational" && <span className="text-muted">(opening soon)</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

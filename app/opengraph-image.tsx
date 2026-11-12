import { ImageResponse } from "next/og";
import { lines, stations } from "@/lib/network";
import { getMapLayout, roundedPath } from "@/lib/mapLayout";

export const alt = "Namma Metro Planner — Bengaluru metro map with the Purple, Green, Yellow and Pink lines";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The real network diagram, so the card always matches the data it was built from.
export default function Image() {
  const layout = getMapLayout();
  const colorOf = new Map(lines.map((line) => [line.id, line.color]));
  const interchanges = stations.filter((s) => s.interchange).map((s) => layout.positions.get(s.id)!);
  const { minX, minY, maxX, maxY } = layout.bounds;
  const pad = 30;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#101216",
          color: "#f2f3f5",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 500,
            padding: "64px 0 64px 64px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 26, color: "#9aa0ab", letterSpacing: 1 }}>Namma Metro Planner</div>
            <div style={{ display: "flex", fontSize: 62, lineHeight: 1.1, marginTop: 22, letterSpacing: -1.5 }}>
              The Pink Line is on the map
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 25, color: "#9aa0ab", lineHeight: 1.4 }}>
            Routes, fares and an animated network map for all four Bengaluru metro lines. Works offline.
          </div>
        </div>
        <svg
          width={700}
          height={630}
          viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
        >
          {layout.geometries.map((geometry) => (
            <path
              key={geometry.line}
              d={roundedPath(geometry.points)}
              fill="none"
              stroke={colorOf.get(geometry.line)}
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {interchanges.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={8} fill="#101216" stroke="#f2f3f5" strokeWidth={3} />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}

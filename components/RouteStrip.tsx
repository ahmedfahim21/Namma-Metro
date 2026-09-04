"use client";

import { useState } from "react";
import type { Itinerary } from "@/packages/routing/src/itinerary";
import { lineById, towardsTerminal, displayNameById, sequenceOf } from "@/lib/network";
import { directionIndexForLeg } from "@/packages/routing/src/departures";
import { formatDuration } from "@/lib/format";
import { lineSwatch, lineInk } from "./LineBadge";

const RAIL = 28;
const BAR = 3;

function Rail({
  above,
  below,
  children,
}: {
  above?: string;
  below?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative flex justify-center" style={{ width: RAIL }}>
      {above && (
        <span
          aria-hidden
          className="absolute top-0 h-1/2 -translate-x-1/2 left-1/2"
          style={{ width: BAR, background: above }}
        />
      )}
      {below && (
        <span
          aria-hidden
          className="absolute bottom-0 h-1/2 -translate-x-1/2 left-1/2"
          style={{ width: BAR, background: below }}
        />
      )}
      <span className="relative">{children}</span>
    </div>
  );
}

function OriginMarker({ line }: { line: string }) {
  return (
    <span
      className="block rounded-full bg-surface"
      style={{ width: 13, height: 13, border: `3.5px solid ${lineSwatch(line)}` }}
    />
  );
}

function ChangeMarker() {
  return (
    <span
      className="block rounded-full bg-surface"
      style={{ width: 15, height: 15, border: "3px solid var(--ink)" }}
    />
  );
}

function DestinationMarker() {
  return (
    <span
      className="grid place-items-center rounded-full"
      style={{ width: 15, height: 15, background: "var(--ink)" }}
    >
      <span className="block rounded-full bg-surface" style={{ width: 5, height: 5 }} />
    </span>
  );
}

function StationRow({
  rail,
  name,
  meta,
  strong = false,
}: {
  rail: React.ReactNode;
  name: string;
  meta?: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-3">
      <div className="flex" style={{ width: RAIL }}>
        {rail}
      </div>
      <div className="min-w-0 flex-1 py-1.5">
        <div className={`leading-snug ${strong ? "font-semibold" : "font-medium"} text-ink`}>
          {name}
        </div>
        {meta && <div className="mt-0.5 text-[0.8125rem] text-ink-muted">{meta}</div>}
      </div>
    </div>
  );
}

export function RouteStrip({ itinerary }: { itinerary: Itinerary }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div>
      {itinerary.legs.map((leg, i) => {
        const swatch = lineSwatch(leg.line);
        const line = lineById.get(leg.line);
        const dirIndex = directionIndexForLeg(leg, sequenceOf);
        const towards = towardsTerminal(leg.line, dirIndex);
        const intermediate = leg.stations.slice(1, -1);
        const isFirst = i === 0;
        const isLast = i === itinerary.legs.length - 1;
        const change = isLast ? null : itinerary.interchanges[i];
        const nextSwatch = change ? lineSwatch(change.toLine) : undefined;
        const isOpen = expanded === i;

        return (
          <div key={i}>
            {isFirst && (
              <StationRow
                strong
                rail={
                  <Rail below={swatch}>
                    <OriginMarker line={leg.line} />
                  </Rail>
                }
                name={displayNameById(leg.boardStation)}
              />
            )}

            {/* Ride span */}
            <div className="flex items-stretch gap-3">
              <div className="flex" style={{ width: RAIL }}>
                <Rail above={swatch} below={swatch} />
              </div>
              <div className="min-w-0 flex-1 pb-2 pt-1">
                <div
                  className="text-[0.8125rem] font-semibold"
                  style={{ color: lineInk(leg.line) }}
                >
                  {line?.name ?? leg.line}
                  {towards && (
                    <span className="font-medium text-ink-muted"> · towards {towards}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  disabled={intermediate.length === 0}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-md text-[0.8125rem] text-ink-secondary transition-colors hover:text-ink disabled:pointer-events-none"
                >
                  <span className="tnum">
                    {leg.stations.length - 1} stop{leg.stations.length - 1 === 1 ? "" : "s"} ·{" "}
                    {formatDuration(leg.durationSeconds)}
                  </span>
                  {intermediate.length > 0 && (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 12 12"
                      aria-hidden
                      className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                    >
                      <path
                        d="M2.5 4.5 6 8l3.5-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>

                {isOpen && (
                  <div className="animate-expand mt-1.5">
                    <div>
                      <ol className="space-y-1 border-l border-hairline pl-3 text-[0.8125rem] text-ink-muted">
                        {intermediate.map((id) => (
                          <li key={id}>{displayNameById(id)}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {change ? (
              <StationRow
                strong
                rail={
                  <Rail above={swatch} below={nextSwatch}>
                    <ChangeMarker />
                  </Rail>
                }
                name={displayNameById(leg.alightStation)}
                meta={
                  <>
                    Change here · {Math.round(change.walkSeconds / 60)} min walk between platforms
                  </>
                }
              />
            ) : (
              <StationRow
                strong
                rail={
                  <Rail above={swatch}>
                    <DestinationMarker />
                  </Rail>
                }
                name={displayNameById(leg.alightStation)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

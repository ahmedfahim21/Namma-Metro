"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Station } from "@/packages/network/src/schema";
import { getRouter, stationById, fareRules, timetables, sequenceOf, isRoutable } from "@/lib/network";
import type { Itinerary, ItineraryLabel } from "@/packages/routing/src/itinerary";
import { estimateDepartures, directionIndexForLeg, formatClock } from "@/packages/routing/src/departures";
import { quoteFare } from "@/packages/fares/src/index";
import { formatDuration, formatDistance, formatCurrency } from "@/lib/format";
import { StationCombobox } from "./StationCombobox";
import { lineColor } from "./LineBadge";
import { MetroMap } from "./MetroMap";

const LINE_LABEL: Record<string, string> = {
  purple: "Purple Line",
  green: "Green Line",
  yellow: "Yellow Line",
  pink: "Pink Line",
  blue: "Blue Line",
};

const LABEL_TEXT: Record<ItineraryLabel, string> = {
  fastest: "Fastest",
  fewest_interchanges: "Fewest interchanges",
  least_walking: "Least walking",
  cheapest: "Cheapest",
};

function subscribeOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeOnlineStatus,
    () => navigator.onLine,
    () => true, // server snapshot: assume online until hydrated
  );
}

function ItineraryCard({
  itinerary,
  now,
  selected,
  onSelect,
}: {
  itinerary: Itinerary;
  now: Date;
  selected: boolean;
  onSelect: () => void;
}) {
  const fare = quoteFare(itinerary.totalDistanceMeters, fareRules, now);
  const firstLeg = itinerary.legs[0];
  const departure = firstLeg
    ? estimateDepartures(
        timetables,
        firstLeg.line,
        directionIndexForLeg(firstLeg, sequenceOf),
        now,
      )
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`cursor-pointer rounded-2xl border bg-surface p-5 transition-all ${
        selected
          ? "border-accent/60 shadow-[0_1px_20px_-8px_var(--accent)]"
          : "border-border opacity-90 hover:border-muted hover:opacity-100"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {itinerary.labels.map((l) => (
            <span
              key={l}
              className="rounded-full border border-border px-2.5 py-0.5 text-[11px] tracking-wide text-muted"
            >
              {LABEL_TEXT[l]}
            </span>
          ))}
        </div>
        <div className="text-right">
          <div className="text-xl tracking-tight">{formatDuration(itinerary.totalDurationSeconds)}</div>
          <div className="text-xs text-muted">
            {itinerary.totalStops} stops · {itinerary.interchanges.length} interchange
            {itinerary.interchanges.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <ol className="mb-4 space-y-2">
        {itinerary.legs.map((leg, i) => {
          const board = stationById.get(leg.boardStation);
          const alight = stationById.get(leg.alightStation);
          return (
            <li key={i} className="flex items-start gap-3">
              <span
                className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ring-3 ring-background"
                style={{ background: lineColor(leg.line) }}
              />
              <div className="flex-1 text-sm">
                <span className="text-xs tracking-wide" style={{ color: lineColor(leg.line) }}>
                  {LINE_LABEL[leg.line] ?? leg.line}
                </span>
                <div className="text-foreground">
                  {board?.name} → {alight?.name}
                </div>
                <div className="text-xs text-muted">
                  {leg.stations.length - 1} stops · {formatDuration(leg.durationSeconds)} ·{" "}
                  {formatDistance(leg.distanceMeters)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {itinerary.interchanges.length > 0 && (
        <div className="mb-4 rounded-lg bg-background px-3 py-2 text-xs text-muted">
          {itinerary.interchanges.map((ic, i) => (
            <div key={i}>
              Change at <strong className="text-foreground">{stationById.get(ic.station)?.name}</strong>:{" "}
              {ic.fromLine} → {ic.toLine} line, ~{Math.round(ic.walkSeconds / 60)} min walk
            </div>
          ))}
        </div>
      )}

      {departure && (
        <div className="mb-4 text-sm">
          {departure.serviceOpen ? (
            <>
              <span className="font-medium">
                Next train ~{Math.round(departure.expectedWaitSeconds / 60)} min
              </span>
              {departure.nextDepartures.length > 0 && (
                <span className="text-muted">
                  {" "}
                  · upcoming: {departure.nextDepartures.map((d) => formatClock(d.minute)).join(", ")}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted">
              Service closed for this direction — first train {formatClock(departure.firstTrainMinute)}
            </span>
          )}
          <div className="text-[11px] text-muted">Estimated from typical frequency, not a live feed.</div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        {fare.quotes.map((q) => (
          <div
            key={q.mode}
            className={`rounded-lg border px-2 py-2 ${q.mode === fare.cheapest.mode ? "border-accent" : "border-border"}`}
          >
            <div className="text-xs text-muted">{q.label}</div>
            <div className="font-semibold">{formatCurrency(q.fare)}</div>
            {q.savingsVsToken > 0 && (
              <div className="text-[11px] text-green-600">save {formatCurrency(q.savingsVsToken)}</div>
            )}
          </div>
        ))}
      </div>
      {fare.passes.length > 0 && (
        <div className="mt-2 text-[11px] text-muted">
          {fare.passes
            .map((p) => `${p.label} (${formatCurrency(p.price)}) breaks even after ${p.breakEvenTrips} trips`)
            .join(" · ")}
        </div>
      )}
    </div>
  );
}

export function TripPlanner({
  defaultOrigin,
  defaultDestination,
}: {
  defaultOrigin?: Station | null;
  defaultDestination?: Station | null;
}) {
  const [origin, setOrigin] = useState<Station | null>(defaultOrigin ?? null);
  const [destination, setDestination] = useState<Station | null>(defaultDestination ?? null);
  const [now, setNow] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const online = useOnlineStatus();

  useEffect(() => {
    // Intentional: "now" must come from the client clock (fares/timetables
    // are time-of-day sensitive) and ticks every 30s for the live departure
    // countdown — there's no external store to synchronize against here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const itineraries = useMemo(() => {
    if (!origin || !destination) return [];
    return getRouter().planTrip(origin.id, destination.id);
  }, [origin, destination]);


  const selected = itineraries.find((it) => it.id === selectedId) ?? itineraries[0] ?? null;

  const mapRoute = selected
    ? {
        id: selected.id,
        legs: selected.legs.map((leg) => ({
          line: leg.line,
          boardStation: leg.boardStation,
          alightStation: leg.alightStation,
          stations: leg.stations,
        })),
        originStation: selected.originStation,
        destinationStation: selected.destinationStation,
      }
    : null;

  return (
    <div className="mx-auto w-full max-w-[110rem] px-4 py-5 sm:px-6">
      {!online && (
        <div className="mb-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Offline — showing cached network data and timetables.
        </div>
      )}

      {/* Inputs, map, results — in that reading order on a phone; the map
          takes the whole right-hand column on a wide screen. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] xl:gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:col-start-1 lg:row-start-1">
          <StationCombobox label="From" value={origin} onChange={setOrigin} />
          <StationCombobox label="To" value={destination} onChange={setDestination} />
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-4">
          <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1 text-sm">
            <span className="truncate tracking-tight">
              {selected ? (
                <>
                  {stationById.get(selected.originStation)?.name}
                  <span className="mx-2 text-muted">→</span>
                  {stationById.get(selected.destinationStation)?.name}
                </>
              ) : (
                <span className="text-muted">Bengaluru network</span>
              )}
            </span>
            <span className="flex-shrink-0 text-[11px] tracking-wide text-muted">
              drag to pan · scroll to zoom
            </span>
          </div>
          <MetroMap
            route={mapRoute}
            labelMode={mapRoute ? "route" : "all"}
            className="h-[26rem] sm:h-[32rem] lg:h-[calc(100vh-11.5rem)]"
            ambientTrains
            onStationClick={(station) => {
              // Stations on a stretch that is still being built cannot start or end a trip.
              if (!isRoutable(station)) return;
              if (!origin || (origin && destination)) {
                setOrigin(station);
                setDestination(null);
              } else {
                setDestination(station);
              }
            }}
          />
        </div>
        <div className="lg:col-start-1 lg:row-start-2 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto lg:pr-1">
          {origin && destination && origin.id === destination.id && (
            <p className="text-sm text-muted">Pick two different stations to plan a trip.</p>
          )}

          {itineraries.length === 0 && origin && destination && origin.id !== destination.id && (
            <p className="text-sm text-muted">No route found between these stations yet.</p>
          )}

          {!origin || !destination ? (
            <p className="text-sm text-muted">
              Pick a start and an end station — the map traces the route as it goes.
            </p>
          ) : null}

          {now && (
            <div className="space-y-4">
              {itineraries.map((it) => (
                <ItineraryCard
                  key={it.id}
                  itinerary={it}
                  now={now}
                  selected={it.id === selected?.id}
                  onSelect={() => setSelectedId(it.id)}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

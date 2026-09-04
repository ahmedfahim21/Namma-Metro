"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Station } from "@/packages/network/src/schema";
import { getRouter, stationById, fareRules, timetables, sequenceOf } from "@/lib/network";
import type { Itinerary, ItineraryLabel } from "@/packages/routing/src/itinerary";
import { estimateDepartures, directionIndexForLeg, formatClock } from "@/packages/routing/src/departures";
import { quoteFare } from "@/packages/fares/src/index";
import { formatDuration, formatDistance, formatCurrency } from "@/lib/format";
import { StationCombobox } from "./StationCombobox";
import { LineBadge, lineColor } from "./LineBadge";

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

function ItineraryCard({ itinerary, now }: { itinerary: Itinerary; now: Date }) {
  const fare = quoteFare(itinerary.totalStops, fareRules, now);
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
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {itinerary.labels.map((l) => (
            <span
              key={l}
              className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted"
            >
              {LABEL_TEXT[l]}
            </span>
          ))}
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">{formatDuration(itinerary.totalDurationSeconds)}</div>
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
                className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                style={{ background: lineColor(leg.line) }}
              />
              <div className="flex-1 text-sm">
                <LineBadge line={leg.line} />
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {!online && (
        <div className="mb-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Offline — showing cached network data and timetables.
        </div>
      )}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <StationCombobox label="From" value={origin} onChange={setOrigin} />
        <StationCombobox label="To" value={destination} onChange={setDestination} />
      </div>

      {origin && destination && origin.id === destination.id && (
        <p className="text-sm text-muted">Pick two different stations to plan a trip.</p>
      )}

      {itineraries.length === 0 && origin && destination && origin.id !== destination.id && (
        <p className="text-sm text-muted">No route found between these stations yet.</p>
      )}

      {now && (
        <div className="space-y-4">
          {itineraries.map((it) => (
            <ItineraryCard key={it.id} itinerary={it} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}

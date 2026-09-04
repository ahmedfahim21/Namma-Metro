"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Station } from "@/packages/network/src/schema";
import type { Itinerary, ItineraryLabel } from "@/packages/routing/src/itinerary";
import {
  getRouter,
  fareRules,
  timetables,
  sequenceOf,
  towardsTerminal,
  displayName,
} from "@/lib/network";
import { estimateDepartures, directionIndexForLeg, formatClock } from "@/packages/routing/src/departures";
import { quoteFare } from "@/packages/fares/src/index";
import { formatDuration, formatDistance } from "@/lib/format";
import { StationCombobox } from "./StationCombobox";
import { RouteStrip } from "./RouteStrip";
import { FareTable } from "./FareTable";

const LABEL_TEXT: Record<ItineraryLabel, string> = {
  fastest: "Fastest",
  fewest_interchanges: "Fewest changes",
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
    () => true, // assume online until hydrated
  );
}

function DepartureBar({ itinerary, now }: { itinerary: Itinerary; now: Date }) {
  const leg = itinerary.legs[0];
  if (!leg) return null;
  const dirIndex = directionIndexForLeg(leg, sequenceOf);
  const departure = estimateDepartures(timetables, leg.line, dirIndex, now);
  if (!departure) return null;
  const towards = towardsTerminal(leg.line, dirIndex);

  if (!departure.serviceOpen) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md bg-sunken px-3 py-2.5 text-sm">
        <span className="font-medium text-ink">Service closed</span>
        <span className="text-ink-muted">
          First train <span className="tnum">{formatClock(departure.firstTrainMinute)}</span>, last{" "}
          <span className="tnum">{formatClock(departure.lastTrainMinute)}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-sunken px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-sm text-ink-secondary">Next train</span>
        <span className="tnum text-[1.0625rem] font-semibold text-ink">
          ~{Math.round(departure.expectedWaitSeconds / 60)} min
        </span>
        {towards && <span className="text-sm text-ink-muted">towards {towards}</span>}
        {departure.nextDepartures.length > 0 && (
          <span className="tnum ml-auto text-[0.8125rem] text-ink-faint">
            {departure.nextDepartures.map((d) => formatClock(d.minute)).join("  ")}
          </span>
        )}
      </div>
      <p className="mt-1 text-[0.6875rem] text-ink-faint">
        Estimated from typical frequency — not a live feed.
      </p>
    </div>
  );
}

function ItineraryCard({
  itinerary,
  now,
  primary,
  showLabels,
}: {
  itinerary: Itinerary;
  now: Date;
  primary: boolean;
  showLabels: boolean;
}) {
  const fare = quoteFare(itinerary.totalStops, fareRules, now);

  return (
    <article
      className={`overflow-hidden rounded-lg border bg-surface ${
        primary ? "border-hairline-strong" : "border-hairline"
      }`}
    >
      <header className="flex items-start justify-between gap-4 border-b border-hairline px-4 py-3.5">
        <div className="min-w-0">
          {/* When every criterion picks the same path there is nothing to
              choose between — labelling it four times is just noise. */}
          {showLabels && (
            <div className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {itinerary.labels.map((l) => (
                <span
                  key={l}
                  className="rounded-full border border-hairline px-2 py-0.5 text-[0.6875rem] font-medium text-ink-secondary"
                >
                  {LABEL_TEXT[l]}
                </span>
              ))}
            </div>
          )}
          <p className="tnum text-[0.8125rem] text-ink-muted">
            {itinerary.totalStops} stops · {itinerary.interchanges.length}{" "}
            {itinerary.interchanges.length === 1 ? "change" : "changes"} ·{" "}
            {formatDistance(itinerary.totalDistanceMeters)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="tnum display text-2xl font-semibold">
            {formatDuration(itinerary.totalDurationSeconds)}
          </div>
          <div className="tnum text-[0.6875rem] text-ink-faint">
            {Math.round(itinerary.totalRideSeconds / 60)} min riding
            {itinerary.totalWalkSeconds > 0 &&
              ` · ${Math.round(itinerary.totalWalkSeconds / 60)} min walking`}
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        <DepartureBar itinerary={itinerary} now={now} />
        <RouteStrip itinerary={itinerary} />
        <div className="border-t border-hairline pt-3.5">
          <FareTable fare={fare} />
        </div>
      </div>
    </article>
  );
}

const SWAP_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M7.5 4v16m0 0-3.5-3.5M7.5 20 11 16.5M16.5 20V4m0 0L13 7.5M16.5 4 20 7.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function TripPlanner({
  defaultOrigin,
  defaultDestination,
  popular,
}: {
  defaultOrigin?: Station | null;
  defaultDestination?: Station | null;
  popular?: { slug: string; from: string; to: string }[];
}) {
  const [origin, setOrigin] = useState<Station | null>(defaultOrigin ?? null);
  const [destination, setDestination] = useState<Station | null>(defaultDestination ?? null);
  const [now, setNow] = useState<Date | null>(null);
  const online = useOnlineStatus();

  useEffect(() => {
    // "now" must come from the client clock — fares and timetables are
    // time-of-day sensitive — and ticks so the countdown stays honest.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const itineraries = useMemo(() => {
    if (!origin || !destination || origin.id === destination.id) return [];
    return getRouter().planTrip(origin.id, destination.id);
  }, [origin, destination]);

  const sameStation = Boolean(origin && destination && origin.id === destination.id);
  const canSwap = Boolean(origin || destination);

  return (
    <div className="mx-auto max-w-2xl px-5">
      {!online && (
        <div className="mb-4 rounded-md border border-hairline bg-sunken px-3 py-2 text-[0.8125rem] text-ink-secondary">
          You&apos;re offline — planning from cached network data.
        </div>
      )}

      {/* Origin / destination field group. The rail spans both rows so the
          origin ring, connector and destination dot read as one journey. */}
      <div className="relative rounded-lg border border-hairline-strong bg-surface has-[input:focus-visible]:border-ink-faint">
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-[30px] left-[22px] top-[30px] border-l-2 border-dotted border-hairline-strong"
        />

        <div className="flex items-start gap-3 py-3 pl-4 pr-14">
          <span
            aria-hidden
            className="relative mt-[22px] block h-[11px] w-[11px] shrink-0 rounded-full border-[2.5px] border-ink-faint bg-surface"
          />
          <div className="min-w-0 flex-1">
            <StationCombobox
              label="From"
              value={origin}
              onChange={setOrigin}
              placeholder="Origin station"
            />
          </div>
        </div>

        <div className="ml-[43px] border-t border-hairline" />

        <div className="flex items-start gap-3 py-3 pl-4 pr-14">
          <span
            aria-hidden
            className="relative mt-[22px] block h-[11px] w-[11px] shrink-0 rounded-full bg-ink"
          />
          <div className="min-w-0 flex-1">
            <StationCombobox
              label="To"
              value={destination}
              onChange={setDestination}
              placeholder="Destination station"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setOrigin(destination);
            setDestination(origin);
          }}
          disabled={!canSwap}
          aria-label="Swap origin and destination"
          className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-hairline bg-surface text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink disabled:opacity-40"
        >
          {SWAP_ICON}
        </button>
      </div>

      {sameStation && (
        <p className="mt-4 text-sm text-ink-muted">Pick two different stations to plan a trip.</p>
      )}

      {!origin && !destination && popular && popular.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow">Popular routes</h2>
          <ul className="mt-2.5 divide-y divide-hairline border-y border-hairline">
            {popular.map((route) => (
              <li key={route.slug}>
                <Link
                  href={`/route/${route.slug}`}
                  className="group flex items-center gap-2 py-2.5 text-[0.9375rem] transition-colors"
                >
                  <span className="min-w-0 truncate text-ink-secondary group-hover:text-ink">
                    {route.from}
                  </span>
                  <span className="shrink-0 text-ink-faint">→</span>
                  <span className="min-w-0 truncate text-ink-secondary group-hover:text-ink">
                    {route.to}
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className="ml-auto shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
                  >
                    <path
                      d="M9 5.5 15.5 12 9 18.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {now && itineraries.length > 0 && (
        <div className="mt-6 space-y-4">
          {itineraries.map((it, i) => (
            <ItineraryCard
              key={it.id}
              itinerary={it}
              now={now}
              primary={i === 0}
              showLabels={itineraries.length > 1}
            />
          ))}
        </div>
      )}

      {origin && destination && !sameStation && itineraries.length === 0 && (
        <p className="mt-4 text-sm text-ink-muted">
          No route found between {displayName(origin)} and {displayName(destination)} on the
          operational network.
        </p>
      )}
    </div>
  );
}

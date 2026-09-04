import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  stationBySlug,
  routableStations,
  lineById,
  timetables,
  isTerminal,
  displayName,
} from "@/lib/network";
import { buildRouteSlug } from "@/lib/routeSlug";
import { LineBadge } from "@/components/LineBadge";
import { formatClock } from "@/packages/routing/src/departures";
import feederData from "@/data/generated/feeders.json";
import type { FeederStop } from "@/packages/lastmile/src/index";

const feeders = feederData as FeederStop[];

const MAJOR_DESTINATION_SLUGS = [
  "nadaprabhu-kempegowda-station-majestic",
  "mahatma-gandhi-road",
  "whitefield-kadugodi",
  "electronic-city",
  "indiranagar",
  "jayanagar",
  "yeshwanthpur",
];

export function generateStaticParams() {
  return routableStations.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const station = stationBySlug.get(slug);
  if (!station) return {};
  const lineNames = station.lines
    .map((m) => lineById.get(m.line)?.name)
    .filter(Boolean)
    .join(" and ");
  return {
    title: `${station.name} metro station — ${lineNames}`,
    description: `${station.name} on Bengaluru's ${lineNames}: first and last train times, accessibility, nearby feeder buses and trip planning.`,
    alternates: { canonical: `/station/${slug}` },
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline py-6">
      <h2 className="eyebrow">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function StationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const station = stationBySlug.get(slug);
  if (!station) notFound();

  const stationFeeders = feeders.filter((f) => f.stationId === station.id);
  const trips = MAJOR_DESTINATION_SLUGS.flatMap((slug) => {
    const to = stationBySlug.get(slug);
    if (!to || to.id === station.id) return [];
    return [{ slug: buildRouteSlug(station, to), name: displayName(to) }];
  }).slice(0, 5);
  const facilities = [
    { label: "Lift", available: station.hasLift },
    { label: "Escalator", available: station.hasEscalator },
    { label: "Parking", available: station.hasParking },
  ];

  return (
    <div className="mx-auto max-w-2xl px-5 pt-10 pb-10">
      <nav className="mb-4 text-[0.8125rem] text-ink-muted">
        <Link href="/" className="transition-colors hover:text-ink">
          Planner
        </Link>
        <span className="mx-1.5 text-ink-faint">/</span>
        <Link href="/map" className="transition-colors hover:text-ink">
          Stations
        </Link>
      </nav>

      <h1 className="display text-[1.875rem] font-semibold sm:text-[2.25rem]">
        {displayName(station)}
      </h1>
      {station.shortName && (
        <p className="mt-1.5 text-[0.9375rem] text-ink-muted">Officially {station.name}</p>
      )}
      {station.nameKn && <p className="mt-1 text-[0.9375rem] text-ink-muted">{station.nameKn}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {station.lines.map((m) => (
          <LineBadge key={m.line} line={m.line} />
        ))}
        {station.interchange && (
          <span className="rounded-full border border-hairline px-2 py-0.5 text-[0.6875rem] font-medium text-ink-secondary">
            Interchange · {Math.round((station.interchangeWalkSeconds ?? 150) / 60)} min between
            platforms
          </span>
        )}
        {isTerminal(station) && (
          <span className="rounded-full border border-hairline px-2 py-0.5 text-[0.6875rem] font-medium text-ink-secondary">
            Terminus
          </span>
        )}
      </div>

      <Section title="First & last train — weekday">
        <ul className="divide-y divide-hairline border-y border-hairline">
          {station.lines.flatMap((m) =>
            timetables
              .filter((t) => t.line === m.line && t.dayType === "weekday")
              .map((t) => (
                <li
                  key={`${m.line}-${t.direction}`}
                  className="flex items-center justify-between gap-4 py-2.5 text-sm"
                >
                  <LineBadge line={m.line} label={t.direction} />
                  <span className="tnum text-ink-secondary">
                    {formatClock(t.firstTrainMinute)} – {formatClock(t.lastTrainMinute)}
                  </span>
                </li>
              )),
          )}
        </ul>
        <p className="mt-2 text-[0.6875rem] text-ink-faint">
          Modelled from published service hours — not a live feed.
        </p>
      </Section>

      <Section title="Facilities">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {facilities.map((f) => (
            <li key={f.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={f.available ? "text-ink" : "text-ink-faint"}
              >
                {f.available ? "✓" : "—"}
              </span>
              <span className={f.available ? "text-ink-secondary" : "text-ink-faint"}>
                {f.label}
                {!f.available && " not on record"}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {stationFeeders.length > 0 && (
        <Section title="Feeder buses nearby">
          <ul className="divide-y divide-hairline border-y border-hairline">
            {stationFeeders.map((f) => (
              <li key={f.busStopName} className="py-2.5">
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium text-ink">{f.busStopName}</span>
                  <span className="tnum shrink-0 text-[0.8125rem] text-ink-muted">
                    {f.walkMeters} m walk
                  </span>
                </div>
                <p className="mt-0.5 text-[0.8125rem] text-ink-muted">{f.routes.join(", ")}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.6875rem] text-ink-faint">
            Seed data, not from a live BMTC feed — verify locally.
          </p>
        </Section>
      )}

      {trips.length > 0 && (
        <Section title={`Trips from ${displayName(station)}`}>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {trips.map((trip) => (
              <li key={trip.slug}>
                <Link
                  href={`/route/${trip.slug}`}
                  className="group flex items-center gap-2 py-2.5 text-[0.9375rem] text-ink-secondary transition-colors hover:text-ink"
                >
                  <span className="truncate">to {trip.name}</span>
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
        </Section>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  stations,
  stationBySlug,
  lineById,
  timetables,
  isRoutable,
  getRouter,
  fareRules,
} from "@/lib/network";
import { isInService } from "@/packages/network/src/status";
import { LineBadge, lineColor } from "@/components/LineBadge";
import { OpeningChip } from "@/components/OpeningNote";
import { formatClock } from "@/packages/routing/src/departures";
import { tokenFareForDistance } from "@/packages/fares/src/index";
import { buildRouteSlug } from "@/lib/routeSlug";
import { formatCurrency, formatDuration } from "@/lib/format";
import feederData from "@/data/generated/feeders.json";
import type { FeederStop } from "@/packages/lastmile/src/index";
import type { Station } from "@/packages/network/src/schema";

const feederSeed = feederData as FeederStop[];

const LAYOUT_LABEL = { elevated: "Elevated", underground: "Underground", at_grade: "At ground level" } as const;

export function generateStaticParams() {
  return stations.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const station = stationBySlug.get(slug);
  if (!station) return {};
  const lineNames = station.lines.map((m) => lineById.get(m.line)?.name).filter(Boolean).join(" / ");
  const description = isRoutable(station)
    ? `${station.name} metro station on the ${lineNames}: first and last trains, neighbouring stations, fares to the main interchanges and feeder buses.`
    : `${station.name} metro station on the ${lineNames} is under construction. Where it is on the line and when it is expected to open.`;
  return {
    title: `${station.name} Metro Station — ${lineNames}`,
    description,
    alternates: { canonical: `/station/${slug}` },
  };
}

/** The stations either side of this one on a line, in line order. */
function neighbours(station: Station, line: string): { previous?: Station; next?: Station } {
  const sequence = station.lines.find((m) => m.line === line)!.sequence;
  const at = (n: number) =>
    stations.find((s) => s.lines.some((m) => m.line === line && m.sequence === n));
  return { previous: at(sequence - 1), next: at(sequence + 1) };
}

export default async function StationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const station = stationBySlug.get(slug);
  if (!station) notFound();

  const routable = isRoutable(station);
  const feeders = feederSeed.filter((f) => f.stationId === station.id);
  const reach = routable ? getRouter().reachFrom(station.id) : null;
  const hubs = stations.filter((s) => s.interchange && s.id !== station.id && reach?.has(s.id));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <p className="text-xs tracking-wide text-muted">
        <Link href="/map" className="hover:text-foreground">
          Metro map
        </Link>
        <span className="mx-1.5">/</span>Station
      </p>
      <h1 className="mt-2 text-3xl tracking-tight">{station.name}</h1>
      {station.nameKn && <p className="mt-1 text-lg text-muted">{station.nameKn}</p>}
      {station.aliases.length > 0 && (
        <p className="mt-1 text-sm text-muted">Also known as {station.aliases.join(", ")}</p>
      )}

      <section className="mt-6 space-y-2">
        {station.lines.map((m) => {
          const { previous, next } = neighbours(station, m.line);
          return (
            <div key={m.line} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <LineBadge line={m.line} />
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>{LAYOUT_LABEL[m.layout]}</span>
                  <OpeningChip opening={m} color={lineColor(m.line)} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Previous", station: previous },
                  { label: "Next", station: next },
                ].map(({ label, station: other }) => (
                  <div key={label}>
                    <div className="text-[11px] tracking-wide text-muted">{label}</div>
                    {other ? (
                      <Link href={`/station/${other.slug}`} className="hover:underline">
                        {other.name}
                      </Link>
                    ) : (
                      <span className="text-muted">End of the line</span>
                    )}
                  </div>
                ))}
              </div>
              {!isInService(m) && (
                <p className="mt-3 text-xs text-muted">
                  These platforms are still being built{m.expected ? `, with opening expected in ${m.expected}` : ""}.
                  That date is BMRCL&apos;s target, not a confirmed opening day.
                </p>
              )}
            </div>
          );
        })}
      </section>

      {station.interchange && (
        <p className="mt-3 text-sm text-muted">
          Interchange: allow about {Math.round((station.interchangeWalkSeconds ?? 150) / 60)} minutes to walk
          between lines.
        </p>
      )}

      {routable && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm tracking-wide text-muted">First and last trains</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface text-sm">
            {station.lines.filter(isInService).flatMap((m) =>
              timetables
                .filter((t) => t.line === m.line && t.dayType === "weekday")
                .map((t) => (
                  <div
                    key={`${m.line}-${t.direction}`}
                    className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                  >
                    <LineBadge line={m.line} label={t.direction} />
                    <span className="text-muted tabular-nums">
                      {formatClock(t.firstTrainMinute)} – {formatClock(t.lastTrainMinute)}
                    </span>
                  </div>
                )),
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            Weekday times at the starting terminal; trains reach this station a little later. First
            train is 07:00 on Sundays. Modelled from published service hours, not a live feed.
          </p>
        </section>
      )}

      {hubs.length > 0 && reach && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm tracking-wide text-muted">From here to the interchanges</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface text-sm">
            {hubs.map((hub) => {
              const r = reach.get(hub.id)!;
              return (
                <Link
                  key={hub.id}
                  href={`/route/${buildRouteSlug(station, hub)}`}
                  className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-background"
                >
                  <span>{hub.name}</span>
                  <span className="flex-shrink-0 text-muted tabular-nums">
                    {formatDuration(r.seconds)} · {formatCurrency(tokenFareForDistance(r.meters, fareRules))}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            Riding and interchange walking time, without the wait for a train. Token fare, estimated.
          </p>
        </section>
      )}

      {feeders.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm tracking-wide text-muted">Feeder buses nearby</h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface text-sm">
            {feeders.map((f) => (
              <li key={f.busStopName} className="border-b border-border px-4 py-2.5 last:border-b-0">
                <div>
                  {f.busStopName} <span className="text-muted">· about {f.walkMeters} m walk</span>
                </div>
                <div className="text-xs text-muted">Routes {f.routes.join(", ")}</div>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-muted">
            A hand-collected list, not a live BMTC feed. Check the stop before relying on it.
          </p>
        </section>
      )}

      {routable && (
        <Link
          href="/"
          className="mt-8 inline-block rounded-lg border border-border bg-surface px-4 py-2 text-sm transition-colors hover:border-muted"
        >
          Plan a trip
        </Link>
      )}
    </div>
  );
}

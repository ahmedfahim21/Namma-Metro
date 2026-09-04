import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { stationBySlug, routableStations, lineById, timetables } from "@/lib/network";
import { LineBadge } from "@/components/LineBadge";
import { formatClock } from "@/packages/routing/src/departures";
import feederData from "@/data/generated/feeders.json";
import type { FeederStop } from "@/packages/lastmile/src/index";

const feederSeed = feederData as FeederStop[];

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
  const lineNames = station.lines.map((m) => lineById.get(m.line)?.name).filter(Boolean).join(" / ");
  return {
    title: `${station.name} Metro Station — ${lineNames}`,
    description: `${station.name} metro station: timings, fares, interchanges${station.interchange ? "" : ""} and nearby feeder buses on the Namma Metro network.`,
    alternates: { canonical: `/station/${slug}` },
  };
}

export default async function StationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const station = stationBySlug.get(slug);
  if (!station) notFound();

  const feeders = feederSeed.filter((f) => f.stationId === station.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{station.name}</h1>
      {station.nameKn && <p className="text-muted">{station.nameKn}</p>}

      <div className="mt-3 flex flex-wrap gap-3">
        {station.lines.map((m) => (
          <LineBadge key={m.line} line={m.line} />
        ))}
      </div>

      {station.interchange && (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-muted">
          Interchange station — allow ~{Math.round((station.interchangeWalkSeconds ?? 150) / 60)} min to
          change lines.
        </p>
      )}

      <section className="mt-6">
        <h2 className="mb-2 font-semibold">First / last train (weekday)</h2>
        <div className="space-y-1 text-sm">
          {station.lines.map((m) => {
            const entries = timetables.filter((t) => t.line === m.line && t.dayType === "weekday");
            return entries.map((t) => (
              <div key={`${m.line}-${t.direction}`} className="flex justify-between rounded-lg bg-surface px-3 py-2">
                <span>
                  <LineBadge line={m.line} label={t.direction} />
                </span>
                <span className="text-muted">
                  {formatClock(t.firstTrainMinute)} – {formatClock(t.lastTrainMinute)}
                </span>
              </div>
            ));
          })}
        </div>
        <p className="mt-1 text-[11px] text-muted">
          Modelled from published first/last train times — not a live feed.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-semibold">Accessibility &amp; parking</h2>
        <ul className="text-sm text-muted">
          <li>{station.hasLift ? "✓ Lift available" : "No lift on record"}</li>
          <li>{station.hasEscalator ? "✓ Escalator available" : "No escalator on record"}</li>
          <li>{station.hasParking ? "✓ Parking available" : "No dedicated parking on record"}</li>
        </ul>
      </section>

      {feeders.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold">Feeder buses nearby</h2>
          <ul className="space-y-1 text-sm">
            {feeders.map((f) => (
              <li key={f.busStopName} className="rounded-lg bg-surface px-3 py-2">
                <div>{f.busStopName} · ~{f.walkMeters}m walk</div>
                <div className="text-xs text-muted">Routes: {f.routes.join(", ")}</div>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted">
            Seed data, not derived from a live BMTC feed — verify locally.
          </p>
        </section>
      )}

      <Link href="/" className="mt-8 inline-block text-sm text-accent underline">
        Plan a trip from {station.name} →
      </Link>
    </div>
  );
}

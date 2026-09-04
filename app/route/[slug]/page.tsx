import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { TripPlanner } from "@/components/TripPlanner";
import { parseRouteSlug, popularRoutePairs, buildRouteSlug } from "@/lib/routeSlug";
import { getRouter, fareRules, displayName, displayNameById } from "@/lib/network";
import { formatDuration, formatCurrency } from "@/lib/format";
import { quoteFare } from "@/packages/fares/src/index";

export const dynamicParams = true;

export function generateStaticParams() {
  return popularRoutePairs().map(([from, to]) => ({ slug: buildRouteSlug(from, to) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseRouteSlug(slug);
  if (!parsed) return {};
  const { from, to } = parsed;
  const title = `${from.name} to ${to.name} — metro route, fare & time`;
  const description = `Namma Metro from ${from.name} to ${to.name}: travel time, interchanges, next-train estimate and the fare by token, mobile QR and Smart Card.`;
  return {
    title,
    description,
    alternates: { canonical: `/route/${slug}` },
    openGraph: { title, description },
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="tnum mt-0.5 text-[0.9375rem] font-semibold text-ink">{value}</div>
    </div>
  );
}

export default async function RoutePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = parseRouteSlug(slug);
  if (!parsed) notFound();
  const { from, to } = parsed;

  const [best] = getRouter().planTrip(from.id, to.id);
  const fare = best ? quoteFare(best.totalStops, fareRules) : null;
  const reverseSlug = buildRouteSlug(to, from);

  const jsonLd = best && {
    "@context": "https://schema.org",
    "@type": "TravelAction",
    name: `${from.name} to ${to.name} metro route`,
    agent: { "@type": "Organization", name: "Namma Metro" },
    fromLocation: {
      "@type": "Place",
      name: from.name,
      geo: { "@type": "GeoCoordinates", latitude: from.lat, longitude: from.lng },
    },
    toLocation: {
      "@type": "Place",
      name: to.name,
      geo: { "@type": "GeoCoordinates", latitude: to.lat, longitude: to.lng },
    },
  };

  return (
    <div className="pb-10">
      {jsonLd && (
        <Script id="route-jsonld" type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </Script>
      )}

      <section className="mx-auto max-w-2xl px-5 pt-10 pb-7">
        <nav className="mb-4 text-[0.8125rem] text-ink-muted">
          <Link href="/" className="transition-colors hover:text-ink">
            Planner
          </Link>
          <span className="mx-1.5 text-ink-faint">/</span>
          <span>Route</span>
        </nav>

        <h1 className="display text-[1.875rem] font-semibold sm:text-[2.25rem]">
          {displayName(from)}
          <span className="mx-2 font-normal text-ink-faint">to</span>
          {displayName(to)}
        </h1>

        {best && fare ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-hairline py-4 sm:grid-cols-4">
              <Stat label="Time" value={formatDuration(best.totalDurationSeconds)} />
              <Stat label="Stops" value={String(best.totalStops)} />
              <Stat
                label="Changes"
                value={best.interchanges.length === 0 ? "Direct" : String(best.interchanges.length)}
              />
              <Stat label="Cheapest fare" value={formatCurrency(fare.cheapest.fare)} />
            </div>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-secondary">
              {best.interchanges.length === 0
                ? "A direct trip — no changes needed."
                : `Change at ${best.interchanges
                    .map((ic) => displayNameById(ic.station))
                    .join(", then ")}.`}{" "}
              <Link
                href={`/route/${reverseSlug}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                See the return trip
              </Link>
              .
            </p>
          </>
        ) : (
          <p className="mt-4 text-[0.9375rem] text-ink-muted">
            No route found between these stations on the operational network.
          </p>
        )}
      </section>

      <TripPlanner defaultOrigin={from} defaultDestination={to} />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { TripPlanner } from "@/components/TripPlanner";
import { parseRouteSlug, popularRoutePairs, buildRouteSlug } from "@/lib/routeSlug";
import { getRouter, fareRules } from "@/lib/network";
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
  const title = `${from.name} to ${to.name} Metro Route, Fare & Time`;
  const description = `Namma Metro route from ${from.name} to ${to.name}: interchanges, travel time, next-train estimate, and fare by token, QR and Smart Card.`;
  return {
    title,
    description,
    alternates: { canonical: `/route/${slug}` },
    openGraph: { title, description },
  };
}

export default async function RoutePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = parseRouteSlug(slug);
  if (!parsed) notFound();
  const { from, to } = parsed;

  const itineraries = getRouter().planTrip(from.id, to.id);
  const best = itineraries[0];
  const fare = best ? quoteFare(best.totalStops, fareRules) : null;

  const jsonLd = best
    ? {
        "@context": "https://schema.org",
        "@type": "TravelAction",
        name: `${from.name} to ${to.name} Metro Route`,
        agent: { "@type": "Organization", name: "Namma Metro" },
        fromLocation: { "@type": "Place", name: from.name, geo: { "@type": "GeoCoordinates", latitude: from.lat, longitude: from.lng } },
        toLocation: { "@type": "Place", name: to.name, geo: { "@type": "GeoCoordinates", latitude: to.lat, longitude: to.lng } },
      }
    : null;

  return (
    <div>
      {jsonLd && (
        <Script id="route-jsonld" type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </Script>
      )}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-2xl px-4 pt-8 pb-2">
          <h1 className="text-2xl font-bold">
            {from.name} → {to.name}
          </h1>
          {best && fare ? (
            <p className="mt-1 text-sm text-muted">
              {formatDuration(best.totalDurationSeconds)} · {best.totalStops} stops ·{" "}
              {best.interchanges.length} interchange{best.interchanges.length === 1 ? "" : "s"} · from{" "}
              {formatCurrency(fare.cheapest.fare)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">No route found between these stations yet.</p>
          )}
        </div>
      </div>
      <TripPlanner defaultOrigin={from} defaultDestination={to} />
    </div>
  );
}

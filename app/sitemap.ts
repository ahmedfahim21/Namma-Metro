import type { MetadataRoute } from "next";
import network from "@/data/network.json";
import { stations } from "@/lib/network";
import { buildRouteSlug, popularRoutePairs } from "@/lib/routeSlug";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(network.generatedAt);
  return [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/map`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    ...stations.map((station) => ({
      url: `${SITE_URL}/station/${station.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...popularRoutePairs().map(([from, to]) => ({
      url: `${SITE_URL}/route/${buildRouteSlug(from, to)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}

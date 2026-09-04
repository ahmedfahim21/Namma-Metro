import { TripPlanner } from "@/components/TripPlanner";
import { stationBySlug, lines, displayName } from "@/lib/network";
import { buildRouteSlug } from "@/lib/routeSlug";

const POPULAR_PAIRS: [string, string][] = [
  ["nadaprabhu-kempegowda-station-majestic", "whitefield-kadugodi"],
  ["mahatma-gandhi-road", "electronic-city"],
  ["indiranagar", "jayanagar"],
  ["krishnarajapura", "nadaprabhu-kempegowda-station-majestic"],
  ["banashankari", "mahatma-gandhi-road"],
  ["yeshwanthpur", "silk-institute"],
];

function popularRoutes() {
  return POPULAR_PAIRS.flatMap(([fromSlug, toSlug]) => {
    const from = stationBySlug.get(fromSlug);
    const to = stationBySlug.get(toSlug);
    if (!from || !to) return [];
    return [{ slug: buildRouteSlug(from, to), from: displayName(from), to: displayName(to) }];
  });
}

export default function HomePage() {
  const operational = lines.filter((l) => l.status === "operational");

  return (
    <div className="pb-10">
      <section className="mx-auto max-w-2xl px-5 pt-12 pb-8">
        <h1 className="display text-[2.125rem] font-semibold sm:text-[2.5rem]">
          Where are you going?
        </h1>
        <p className="mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-ink-secondary">
          Bengaluru metro routes with the fare you&apos;ll actually pay — token, QR and Smart Card
          compared side by side. Works with no signal once loaded.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8125rem] text-ink-muted">
          {operational.map((line) => (
            <span key={line.id} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-[3px] w-5 rounded-full"
                style={{ background: `var(--${line.id}-swatch)` }}
              />
              {line.name}
            </span>
          ))}
        </div>
      </section>

      <TripPlanner popular={popularRoutes()} />
    </div>
  );
}

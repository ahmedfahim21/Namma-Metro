import type { Metadata } from "next";
import { stations, lines, segments } from "@/lib/network";

export const metadata: Metadata = {
  title: "Offline",
  description: "What Namma Metro Planner keeps on your device for use without a connection.",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-hairline py-3 last:border-0">
      <span className="text-sm text-ink-secondary">{label}</span>
      <span className="tnum text-right text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

export default function OfflinePage() {
  const operational = lines.filter((l) => l.status === "operational");

  return (
    <div className="mx-auto max-w-2xl px-5 pt-10 pb-10">
      <h1 className="display text-[1.875rem] font-semibold sm:text-[2.25rem]">Works offline</h1>
      <p className="mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-ink-secondary">
        Most of the Purple and Pink corridors run underground, which is exactly where a planner
        that needs a connection stops being useful. So this one doesn&apos;t need one: the entire
        network ships with the app, and routing, fares and timetables are all computed on your
        device.
      </p>

      <div className="mt-7 rounded-lg border border-hairline bg-surface px-4 py-1">
        <Row label="Stations" value={String(stations.length)} />
        <Row label="Track segments" value={String(segments.length)} />
        <Row label="Lines in service" value={operational.map((l) => l.name).join(", ")} />
        <Row label="App shell" value="Cached on first visit" />
      </div>

      <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-muted">
        A service worker caches the app and its dataset the first time you open it. If BMRCL
        changes fares or timings, reload once with a connection to pick up the updated data.
      </p>
    </div>
  );
}

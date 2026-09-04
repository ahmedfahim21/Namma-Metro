import type { Metadata } from "next";
import { stations, lines } from "@/lib/network";

export const metadata: Metadata = {
  title: "Offline data",
  description: "What Namma Metro Planner has cached for offline use.",
};

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Offline</h1>
      <p className="mt-2 text-sm text-muted">
        Once you&apos;ve opened this app with a connection, the planner, fare engine and timetables
        all run entirely on your device — no network needed underground.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm">
        <div className="flex justify-between border-b border-border py-2">
          <span>Stations cached</span>
          <span className="font-medium">{stations.length}</span>
        </div>
        <div className="flex justify-between border-b border-border py-2">
          <span>Lines</span>
          <span className="font-medium">{lines.map((l) => l.name).join(", ")}</span>
        </div>
        <div className="flex justify-between py-2">
          <span>App shell</span>
          <span className="font-medium">Cached on first visit</span>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        This page and the underlying network data are cached by a service worker. If BMRCL changes
        fares or timings, reload with a connection to pick up the latest bundled dataset.
      </p>
    </div>
  );
}

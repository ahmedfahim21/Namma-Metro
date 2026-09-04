import type { Metadata } from "next";
import { MetroMap } from "@/components/MetroMap";
import { routableStations, lines } from "@/lib/network";

export const metadata: Metadata = {
  title: "Network map",
  description:
    "Schematic map of the Namma Metro network — Purple, Green and Yellow lines in service, Pink under construction.",
};

export default function MapPage() {
  const operationalCount = lines.filter((l) => l.status === "operational").length;

  return (
    <div className="mx-auto max-w-3xl px-5 pt-10 pb-10">
      <h1 className="display text-[1.875rem] font-semibold sm:text-[2.25rem]">Network map</h1>
      <p className="mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-ink-secondary">
        {routableStations.length} stations across {operationalCount} lines in service. Tap any
        station for timings, facilities and feeder buses. Positions are geographic estimates, not
        survey data.
      </p>
      <div className="mt-7">
        <MetroMap />
      </div>
    </div>
  );
}

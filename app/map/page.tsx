import type { Metadata } from "next";
import { MetroMapPage } from "@/components/MetroMapPage";

export const metadata: Metadata = {
  title: "Metro Map",
  description: "Interactive Bengaluru metro map: Purple, Green, Yellow and Pink lines, simulated live trains, travel-time rings from any station, and how the network grew since 2011.",
  alternates: { canonical: "/map" },
};

export default function MapPage() {
  return (
    <div className="mx-auto w-full max-w-[110rem] px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-xl tracking-tight">Metro Map</h1>
      <p className="mb-4 text-sm text-muted">
        Four ways to look at the network: the diagram, trains moving on the timetable, journey
        time from any station, and every opening since 2011. Drag to pan; zoom with the buttons or the scroll wheel.
      </p>
      <MetroMapPage />
    </div>
  );
}

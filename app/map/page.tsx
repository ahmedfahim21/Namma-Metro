import type { Metadata } from "next";
import { MetroMapPage } from "@/components/MetroMapPage";

export const metadata: Metadata = {
  title: "Metro Map",
  description: "Interactive Namma Metro line map — Purple, Green, Yellow, and Pink (opening soon).",
};

export default function MapPage() {
  return (
    <div className="mx-auto w-full max-w-[110rem] px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-xl tracking-tight">Metro Map</h1>
      <p className="mb-4 text-sm text-muted">
        Schematic network map. Tap a station to plan a trip from it, drag to pan, scroll to zoom.
        Dashed grey lines are still under construction.
      </p>
      <MetroMapPage />
    </div>
  );
}

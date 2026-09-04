import type { Metadata } from "next";
import { MetroMap } from "@/components/MetroMap";

export const metadata: Metadata = {
  title: "Metro Map",
  description: "Interactive Namma Metro line map — Purple, Green, Yellow, and Pink (opening soon).",
};

export default function MapPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold">Metro Map</h1>
      <p className="mb-4 text-sm text-muted">
        Tap a station to plan a trip from it. Grey stations are under construction.
      </p>
      <MetroMap />
    </div>
  );
}

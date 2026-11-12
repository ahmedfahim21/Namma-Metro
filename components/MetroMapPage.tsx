"use client";

import { useRouter } from "next/navigation";
import { MetroMap } from "./MetroMap";

export function MetroMapPage() {
  const router = useRouter();
  return (
    <MetroMap
      className="h-[calc(100vh-12rem)] min-h-[30rem]"
      onStationClick={(station) => router.push(`/station/${station.slug}`)}
    />
  );
}

"use client";

import { useRouter } from "next/navigation";
import { MetroMap } from "./MetroMap";

export function MetroMapPage() {
  const router = useRouter();
  return (
    <MetroMap
      explore
      className="h-[calc(100dvh-11rem)] min-h-[34rem]"
      onStationClick={(station) => router.push(`/station/${station.slug}`)}
    />
  );
}

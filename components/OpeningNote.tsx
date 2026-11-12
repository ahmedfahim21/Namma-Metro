"use client";

import { useSyncExternalStore } from "react";
import {
  dateInIST,
  formatOpenDate,
  isNewlyOpened,
  openState,
  type Opening,
} from "@/packages/network/src/status";

const subscribeNever = () => () => {};

/** Today's date in Bengaluru once running in the browser; null while server-rendering. */
export function useToday(): string | null {
  return useSyncExternalStore(
    subscribeNever,
    () => dateInIST(new Date()),
    () => null,
  );
}

/**
 * Small marker for anything with an opening day: "Opens 14 Nov" before it,
 * "New" for the first weeks after, the target month while it is being built,
 * and nothing once it is simply part of the network.
 */
export function OpeningChip({ opening, color }: { opening: Opening; color: string }) {
  const today = useToday();
  if (!today) return null;
  const state = openState(opening, today);
  let text: string | null = null;
  if (state === "planned") text = opening.expected ? `Expected ${opening.expected}` : "Under construction";
  else if (state === "opens_soon") text = opening.openDate ? `Opens ${formatOpenDate(opening.openDate, false)}` : "Opening soon";
  else if (isNewlyOpened(opening, today)) text = "New";
  if (!text) return null;
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[11px] tracking-wide"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
    >
      {text}
    </span>
  );
}

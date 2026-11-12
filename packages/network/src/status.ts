import type { LineStatus } from "./schema";

/** Anything with a status and, optionally, the day it opens: a membership or a segment. */
export interface Opening {
  status: LineStatus;
  openDate?: string;
  expected?: string;
}

export type OpenState = "open" | "opens_soon" | "planned";

/** Today's date in Bengaluru as YYYY-MM-DD, whatever timezone the device is in. */
export function dateInIST(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * Trips can be planned over anything that is open or has an announced opening
 * day; sections still being built are drawn but never routed through.
 */
export function isInService(opening: Opening): boolean {
  return opening.status !== "under_construction";
}

/**
 * What to tell a rider on `today` (YYYY-MM-DD, IST). An "opening_soon" section
 * becomes "open" by itself once its opening day arrives.
 */
export function openState(opening: Opening, today: string): OpenState {
  if (opening.status === "under_construction") return "planned";
  if (opening.status === "operational") return "open";
  if (!opening.openDate) return "opens_soon";
  return today >= opening.openDate ? "open" : "opens_soon";
}

/** True for the first `days` days of service — drives the "New" marker. */
export function isNewlyOpened(opening: Opening, today: string, days = 90): boolean {
  if (!opening.openDate || openState(opening, today) !== "open") return false;
  const elapsed = (Date.parse(today) - Date.parse(opening.openDate)) / 86_400_000;
  return elapsed >= 0 && elapsed < days;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-14" -> "14 Nov 2026". Parsed by hand so it never shifts across timezones. */
export function formatOpenDate(iso: string, withYear = true): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}${withYear ? ` ${year}` : ""}`;
}

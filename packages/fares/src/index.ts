import type { FareRules } from "../../network/src/schema";

export type PaymentMode = "token" | "qr" | "smart_card";

export interface FareQuote {
  mode: PaymentMode;
  label: string;
  fare: number;
  savingsVsToken: number;
  note?: string;
}

export interface PassSuggestion {
  id: string;
  label: string;
  price: number;
  validDays: number;
  /** How many one-way trips at this fare it takes for the pass to break even. */
  breakEvenTrips: number;
}

export interface FareResult {
  baseFare: number;
  stopCount: number;
  isPeak: boolean;
  isFullDiscountDay: boolean;
  quotes: FareQuote[];
  cheapest: FareQuote;
  passes: PassSuggestion[];
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function isWithinWindow(minute: number, windows: FareRules["peakWindows"]): boolean {
  return windows.some((w) => minute >= w.startMinute && minute < w.endMinute);
}

function isFullDiscountDate(date: Date, fullDiscountDates: string[]): boolean {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const isSunday = date.getDay() === 0;
  return isSunday || fullDiscountDates.includes(mmdd);
}

function tokenFareForStops(stopCount: number, rules: FareRules): number {
  if (stopCount <= 0) return rules.sameStationFare;
  const slab = rules.slabs.find((s) => stopCount >= s.minStops && stopCount <= s.maxStops);
  return slab ? slab.tokenFare : rules.slabs[rules.slabs.length - 1].tokenFare;
}

/**
 * Prices a trip under every BMRCL payment mode and returns the cheapest,
 * plus pass break-even guidance. `at` defaults to now; pass a fixed date in
 * tests for determinism. See data/source/fares.ts for the rule sources —
 * this is a planning estimate, not the official fare chart.
 */
export function quoteFare(stopCount: number, rules: FareRules, at: Date = new Date()): FareResult {
  const baseFare = tokenFareForStops(stopCount, rules);
  const minute = minutesSinceMidnight(at);
  const isFullDiscountDay = isFullDiscountDate(at, rules.fullDiscountDates);
  const isPeak = !isFullDiscountDay && isWithinWindow(minute, rules.peakWindows);

  const qrFare = Math.round(baseFare * (1 - rules.qrDiscountPct / 100));
  const smartCardDiscountPct = isFullDiscountDay
    ? rules.smartCardOffPeakDiscountPct
    : isPeak
      ? rules.smartCardPeakDiscountPct
      : rules.smartCardOffPeakDiscountPct;
  const smartCardFare = Math.round(baseFare * (1 - smartCardDiscountPct / 100));

  const quotes: FareQuote[] = [
    { mode: "token", label: "Token (counter)", fare: baseFare, savingsVsToken: 0 },
    {
      mode: "qr",
      label: "Mobile QR ticket",
      fare: qrFare,
      savingsVsToken: baseFare - qrFare,
      note: `${rules.qrDiscountPct}% off token fare`,
    },
    {
      mode: "smart_card",
      label: "Smart Card / NCMC",
      fare: smartCardFare,
      savingsVsToken: baseFare - smartCardFare,
      note: isFullDiscountDay
        ? "All-day off-peak discount (Sunday / national holiday)"
        : isPeak
          ? "Peak-hours discount"
          : "Off-peak discount (Mon-Sat)",
    },
  ];

  const cheapest = quotes.reduce((min, q) => (q.fare < min.fare ? q : min), quotes[0]);

  const passes: PassSuggestion[] = rules.passes.map((p) => ({
    id: p.id,
    label: p.label,
    price: p.price,
    validDays: p.validDays,
    breakEvenTrips: Math.ceil(p.price / Math.max(1, cheapest.fare)),
  }));

  return { baseFare, stopCount, isPeak, isFullDiscountDay, quotes, cheapest, passes };
}

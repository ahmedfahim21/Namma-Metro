import { describe, it, expect } from "vitest";
import { quoteFare } from "@/packages/fares/src/index";
import fares from "@/data/fares.json";
import type { FareRules } from "@/packages/network/src/schema";

const rules = fares as FareRules;

// A Tuesday, well inside the morning peak window (07:00-10:00).
const peakWeekday = new Date(2026, 8, 8, 8, 30, 0);
// A Tuesday, mid-morning off-peak (10:00-17:00).
const offPeakWeekday = new Date(2026, 8, 8, 13, 0, 0);
// A Sunday: gets the all-day off-peak discount regardless of clock time.
const sunday = new Date(2026, 8, 6, 8, 30, 0);

describe("quoteFare", () => {
  it("charges the same-station fare for a zero-stop trip", () => {
    const result = quoteFare(0, rules, offPeakWeekday);
    expect(result.baseFare).toBe(rules.sameStationFare);
  });

  it("picks the correct slab for a known stop count", () => {
    expect(quoteFare(1, rules, offPeakWeekday).baseFare).toBe(10);
    expect(quoteFare(5, rules, offPeakWeekday).baseFare).toBe(30);
    expect(quoteFare(30, rules, offPeakWeekday).baseFare).toBe(90);
  });

  it("applies the mobile QR discount uniformly regardless of time", () => {
    const peak = quoteFare(9, rules, peakWeekday);
    const offPeak = quoteFare(9, rules, offPeakWeekday);
    const qrPeak = peak.quotes.find((q) => q.mode === "qr")!;
    const qrOffPeak = offPeak.quotes.find((q) => q.mode === "qr")!;
    expect(qrPeak.fare).toBe(Math.round(50 * 0.95));
    expect(qrOffPeak.fare).toBe(Math.round(50 * 0.95));
  });

  it("gives smart card only a 5% discount during peak hours on a weekday", () => {
    const result = quoteFare(9, rules, peakWeekday);
    expect(result.isPeak).toBe(true);
    const smartCard = result.quotes.find((q) => q.mode === "smart_card")!;
    expect(smartCard.fare).toBe(Math.round(50 * 0.95));
  });

  it("gives smart card a 10% discount during off-peak hours on a weekday", () => {
    const result = quoteFare(9, rules, offPeakWeekday);
    expect(result.isPeak).toBe(false);
    const smartCard = result.quotes.find((q) => q.mode === "smart_card")!;
    expect(smartCard.fare).toBe(Math.round(50 * 0.9));
  });

  it("gives smart card the all-day off-peak discount on Sundays even in the peak window", () => {
    const result = quoteFare(9, rules, sunday);
    expect(result.isFullDiscountDay).toBe(true);
    expect(result.isPeak).toBe(false);
    const smartCard = result.quotes.find((q) => q.mode === "smart_card")!;
    expect(smartCard.fare).toBe(Math.round(50 * 0.9));
  });

  it("ranks the cheapest quote correctly", () => {
    const result = quoteFare(9, rules, offPeakWeekday);
    expect(result.cheapest.mode).toBe("smart_card");
    expect(result.cheapest.fare).toBeLessThanOrEqual(result.baseFare);
  });

  it("computes a sane pass break-even trip count", () => {
    const result = quoteFare(9, rules, offPeakWeekday);
    for (const pass of result.passes) {
      expect(pass.breakEvenTrips).toBeGreaterThan(0);
      expect(pass.price / pass.breakEvenTrips).toBeLessThanOrEqual(result.cheapest.fare);
    }
  });
});

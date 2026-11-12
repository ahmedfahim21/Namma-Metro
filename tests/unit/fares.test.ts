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

const km = (n: number) => n * 1000;

describe("quoteFare", () => {
  it("charges the minimum fare for a zero-distance trip", () => {
    expect(quoteFare(0, rules, offPeakWeekday).baseFare).toBe(10);
  });

  it("puts each distance in the right band, including both edges", () => {
    const cases: [number, number][] = [
      [0.4, 10],
      [2, 10],
      [2.001, 20],
      [4, 20],
      [4.001, 30],
      [6, 30],
      [6.001, 40],
      [8, 40],
      [8.001, 50],
      [10, 50],
      [10.001, 60],
      [15, 60],
      [15.001, 70],
      [20, 70],
      [20.001, 80],
      [25, 80],
      [25.001, 90],
      [43.5, 90],
      [120, 90],
    ];
    for (const [distanceKm, fare] of cases) {
      expect(quoteFare(km(distanceKm), rules, offPeakWeekday).baseFare, `${distanceKm} km`).toBe(fare);
    }
  });

  it("refuses to price a nonsensical distance", () => {
    expect(() => quoteFare(-1, rules, offPeakWeekday)).toThrow();
    expect(() => quoteFare(Number.NaN, rules, offPeakWeekday)).toThrow();
  });

  it("returns every field of a quote for a known off-peak trip", () => {
    const result = quoteFare(km(9), rules, offPeakWeekday);
    expect(result).toEqual({
      baseFare: 50,
      distanceMeters: 9000,
      isPeak: false,
      isFullDiscountDay: false,
      quotes: [
        { mode: "token", label: "Token (counter)", fare: 50, savingsVsToken: 0 },
        { mode: "qr", label: "Mobile QR ticket", fare: 48, savingsVsToken: 2, note: "5% off token fare" },
        {
          mode: "smart_card",
          label: "Smart Card / NCMC",
          fare: 45,
          savingsVsToken: 5,
          note: "Off-peak discount (Mon-Sat)",
        },
      ],
      cheapest: {
        mode: "smart_card",
        label: "Smart Card / NCMC",
        fare: 45,
        savingsVsToken: 5,
        note: "Off-peak discount (Mon-Sat)",
      },
      passes: [
        { id: "day_qr", label: "1-Day QR Pass", price: 250, validDays: 1, breakEvenTrips: 6 },
        { id: "three_day_qr", label: "3-Day QR Pass", price: 600, validDays: 3, breakEvenTrips: 14 },
      ],
    });
  });

  it("applies the mobile QR discount uniformly regardless of time", () => {
    const peak = quoteFare(km(9), rules, peakWeekday);
    const offPeak = quoteFare(km(9), rules, offPeakWeekday);
    const qrPeak = peak.quotes.find((q) => q.mode === "qr")!;
    const qrOffPeak = offPeak.quotes.find((q) => q.mode === "qr")!;
    expect(qrPeak.fare).toBe(Math.round(50 * 0.95));
    expect(qrOffPeak.fare).toBe(Math.round(50 * 0.95));
  });

  it("gives smart card only a 5% discount during peak hours on a weekday", () => {
    const result = quoteFare(km(9), rules, peakWeekday);
    expect(result.isPeak).toBe(true);
    const smartCard = result.quotes.find((q) => q.mode === "smart_card")!;
    expect(smartCard.fare).toBe(Math.round(50 * 0.95));
  });

  it("gives smart card a 10% discount during off-peak hours on a weekday", () => {
    const result = quoteFare(km(9), rules, offPeakWeekday);
    expect(result.isPeak).toBe(false);
    const smartCard = result.quotes.find((q) => q.mode === "smart_card")!;
    expect(smartCard.fare).toBe(Math.round(50 * 0.9));
  });

  it("gives smart card the all-day off-peak discount on Sundays even in the peak window", () => {
    const result = quoteFare(km(9), rules, sunday);
    expect(result.isFullDiscountDay).toBe(true);
    expect(result.isPeak).toBe(false);
    const smartCard = result.quotes.find((q) => q.mode === "smart_card")!;
    expect(smartCard.fare).toBe(Math.round(50 * 0.9));
  });

  it("ranks the cheapest quote correctly", () => {
    const result = quoteFare(km(9), rules, offPeakWeekday);
    expect(result.cheapest.mode).toBe("smart_card");
    expect(result.cheapest.fare).toBeLessThanOrEqual(result.baseFare);
  });

  it("computes a sane pass break-even trip count", () => {
    const result = quoteFare(km(9), rules, offPeakWeekday);
    for (const pass of result.passes) {
      expect(pass.breakEvenTrips).toBeGreaterThan(0);
      expect(pass.price / pass.breakEvenTrips).toBeLessThanOrEqual(result.cheapest.fare);
    }
  });
});

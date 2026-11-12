/**
 * BMRCL fare rules.
 *
 * Token fares are charged by distance band. The bands below are the chart in
 * force since the February 2025 revision; the 5% annual revision announced
 * for 9 February 2026 was put on hold the day before and has not been applied
 * (see SOURCES.md). The mobile-QR and Smart Card/NCMC discounts come from the
 * same notification.
 *
 * The bands are official; the distance fed into them is not. BMRCL measures
 * along the track from its own chainage, while we use OpenStreetMap station
 * spacing scaled to each line's published length, so a trip that sits right
 * on a band edge can land one band out. The UI says "estimate" for that
 * reason.
 */

export const fareRules = {
  bands: [
    { maxKm: 2, tokenFare: 10 },
    { maxKm: 4, tokenFare: 20 },
    { maxKm: 6, tokenFare: 30 },
    { maxKm: 8, tokenFare: 40 },
    { maxKm: 10, tokenFare: 50 },
    { maxKm: 15, tokenFare: 60 },
    { maxKm: 20, tokenFare: 70 },
    { maxKm: 25, tokenFare: 80 },
    { maxKm: null, tokenFare: 90 },
  ],
  qrDiscountPct: 5,
  smartCardPeakDiscountPct: 5,
  smartCardOffPeakDiscountPct: 10,
  // Peak windows, Mon-Sat (Sunday and holidays get the off-peak discount all day).
  peakWindows: [
    { startMinute: 7 * 60, endMinute: 10 * 60 },
    { startMinute: 17 * 60, endMinute: 20 * 60 + 30 },
  ],
  // National holidays that get the all-day off-peak discount, MM-DD.
  fullDiscountDates: ["01-26", "08-15", "10-02"],
  passes: [
    { id: "day_qr", label: "1-Day QR Pass", validDays: 1, price: 250 },
    { id: "three_day_qr", label: "3-Day QR Pass", validDays: 3, price: 600 },
  ],
  source:
    "BMRCL February 2025 fare notification (distance bands, still in force after the February 2026 revision was put on hold) + Deccan Herald 'QR-code based passes' coverage, checked November 2026. Distances are estimated, so verify against bmrc.co.in before relying on a fare for payment.",
};

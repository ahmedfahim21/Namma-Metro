/**
 * BMRCL fare rules, v1.
 *
 * Slab fares, the mobile-QR discount, and the Smart Card/NCMC peak/off-peak
 * discount structure are taken from BMRCL's public fare notifications and
 * press coverage current to September 2026 — see SOURCES.md. Distance-based
 * slabs are approximated as stop-count slabs (BMRCL's actual chart is by
 * distance band; for a given line the two correlate closely enough for a
 * planning estimate, but this is explicitly NOT the official fare chart and
 * the UI must say so).
 */

export const fareRules = {
  // Approximate stop-count -> token fare slabs, ₹10-₹90 range.
  slabs: [
    { minStops: 1, maxStops: 2, tokenFare: 10 },
    { minStops: 3, maxStops: 4, tokenFare: 20 },
    { minStops: 5, maxStops: 6, tokenFare: 30 },
    { minStops: 7, maxStops: 8, tokenFare: 40 },
    { minStops: 9, maxStops: 11, tokenFare: 50 },
    { minStops: 12, maxStops: 15, tokenFare: 60 },
    { minStops: 16, maxStops: 19, tokenFare: 70 },
    { minStops: 20, maxStops: 24, tokenFare: 80 },
    { minStops: 25, maxStops: 999, tokenFare: 90 },
  ],
  sameStationFare: 10,
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
    "BMRCL fare notification + Deccan Herald 'QR-code based passes' coverage, checked September 2026. Not the official fare chart — verify against bmrc.co.in before relying on it for payment.",
};

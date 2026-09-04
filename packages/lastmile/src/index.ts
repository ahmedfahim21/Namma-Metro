export interface FeederStop {
  stationId: string;
  busStopName: string;
  routes: string[];
  walkMeters: number;
}

export interface AutoEstimate {
  distanceMeters: number;
  fareRupees: number;
  etaMinutes: number;
}

// Bengaluru auto-rickshaw tariff (published slabs, approximate): ₹30 for
// the first 2 km, ₹15/km after. Clearly presented as an estimate, not a
// live quote — there is no public ride-hail pricing API to build on.
const AUTO_BASE_FARE = 30;
const AUTO_BASE_KM = 2;
const AUTO_PER_KM = 15;
const AUTO_AVG_SPEED_KMH = 18; // city traffic, conservative

export function estimateAutoFare(distanceMeters: number): AutoEstimate {
  const km = distanceMeters / 1000;
  const fare =
    km <= AUTO_BASE_KM
      ? AUTO_BASE_FARE
      : AUTO_BASE_FARE + Math.ceil(km - AUTO_BASE_KM) * AUTO_PER_KM;
  const etaMinutes = Math.max(3, Math.round((km / AUTO_AVG_SPEED_KMH) * 60));
  return { distanceMeters, fareRupees: fare, etaMinutes };
}

export function feedersForStation(feeders: FeederStop[], stationId: string): FeederStop[] {
  return feeders.filter((f) => f.stationId === stationId);
}

export function googleMapsWalkingUrl(lat: number, lng: number, label: string): string {
  const dest = encodeURIComponent(`${label} (${lat},${lng})`);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
}

export function nammaYatriUrl(): string {
  return "https://nammayatri.in/";
}

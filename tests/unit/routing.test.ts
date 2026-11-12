import { describe, it, expect } from "vitest";
import { createRouter } from "@/packages/routing/src/itinerary";
import network from "@/data/network.json";
import type { Station, Segment } from "@/packages/network/src/schema";
import { isInService } from "@/packages/network/src/status";

const stations = network.stations as Station[];
const segments = network.segments as Segment[];
// The same filter the app applies: nothing still under construction is rideable.
const router = createRouter(stations, segments.filter(isInService));

function idFor(name: string): string {
  const s = stations.find((st) => st.name === name);
  if (!s) throw new Error(`fixture station not found: ${name}`);
  return s.id;
}

describe("createRouter.planTrip", () => {
  it("finds a direct, single-line trip with no interchanges", () => {
    const origin = idFor("Nadaprabhu Kempegowda Station, Majestic");
    const destination = idFor("Indiranagar");
    const [itinerary] = router.planTrip(origin, destination);
    expect(itinerary).toBeDefined();
    expect(itinerary.interchanges).toHaveLength(0);
    expect(itinerary.legs).toHaveLength(1);
    expect(itinerary.legs[0].line).toBe("purple");
    expect(itinerary.originStation).toBe(origin);
    expect(itinerary.destinationStation).toBe(destination);
    expect(itinerary.totalStops).toBeGreaterThan(0);
  });

  it("finds a one-interchange trip via Majestic between Green and Purple lines", () => {
    const origin = idFor("Yelachenahalli");
    const destination = idFor("Whitefield (Kadugodi)");
    const [itinerary] = router.planTrip(origin, destination);
    expect(itinerary).toBeDefined();
    expect(itinerary.interchanges).toHaveLength(1);
    expect(itinerary.interchanges[0].station).toBe(idFor("Nadaprabhu Kempegowda Station, Majestic"));
    expect(itinerary.legs.map((l) => l.line)).toEqual(["green", "purple"]);
  });

  it("finds a one-interchange trip via RV Road between Yellow and Green lines", () => {
    const origin = idFor("Electronic City");
    const destination = idFor("Jayanagar");
    const [itinerary] = router.planTrip(origin, destination);
    expect(itinerary).toBeDefined();
    expect(itinerary.interchanges).toHaveLength(1);
    expect(itinerary.interchanges[0].station).toBe(idFor("Rashtreeya Vidyalaya Road"));
  });

  it("returns a same-station itinerary with zero stops for identical origin/destination", () => {
    const station = idFor("Baiyappanahalli");
    const itineraries = router.planTrip(station, station);
    expect(itineraries.length).toBeGreaterThan(0);
    expect(itineraries[0].totalStops).toBe(0);
    expect(itineraries[0].totalDurationSeconds).toBe(0);
  });

  it("returns itineraries sorted by total duration ascending", () => {
    const origin = idFor("Challaghatta");
    const destination = idFor("Whitefield (Kadugodi)");
    const itineraries = router.planTrip(origin, destination);
    for (let i = 1; i < itineraries.length; i++) {
      expect(itineraries[i].totalDurationSeconds).toBeGreaterThanOrEqual(
        itineraries[i - 1].totalDurationSeconds,
      );
    }
  });

  it("deduplicates itineraries when multiple criteria agree on the same path", () => {
    const origin = idFor("Mysuru Road");
    const destination = idFor("Mahatma Gandhi Road");
    const itineraries = router.planTrip(origin, destination);
    // A near-linear line with a single sensible path should collapse to one
    // itinerary carrying multiple labels, not four near-identical entries.
    expect(itineraries.length).toBeLessThanOrEqual(2);
    expect(itineraries[0].labels.length).toBeGreaterThanOrEqual(1);
  });

  it("joins the Pink Line to the Yellow Line at Jayadeva Hospital", () => {
    const origin = idFor("Hulimavu");
    const destination = idFor("Electronic City");
    const [itinerary] = router.planTrip(origin, destination);
    expect(itinerary).toBeDefined();
    expect(itinerary.legs.map((l) => l.line)).toEqual(["pink", "yellow"]);
    expect(itinerary.legs[0].stations).toEqual([
      "hulimavu",
      "iimb",
      "jp-nagar-4th-phase",
      "jayadeva-hospital",
    ]);
    expect(itinerary.interchanges).toEqual([
      { station: idFor("Jayadeva Hospital"), fromLine: "pink", toLine: "yellow", walkSeconds: 240 },
    ]);
    expect(itinerary.totalStops).toBe(12);
    expect(itinerary.totalWalkSeconds).toBe(240);
    expect(itinerary.totalDurationSeconds).toBe(itinerary.totalRideSeconds + 240);
    expect(itinerary.totalDistanceMeters).toBe(
      itinerary.legs[0].distanceMeters + itinerary.legs[1].distanceMeters,
    );
  });

  it("rides the whole open Pink section end to end", () => {
    const [itinerary] = router.planTrip(idFor("Kalena Agrahara"), idFor("Tavarekere"));
    expect(itinerary.legs).toHaveLength(1);
    expect(itinerary.legs[0].line).toBe("pink");
    expect(itinerary.totalStops).toBe(5);
    expect(itinerary.interchanges).toHaveLength(0);
    // ~7 km at the modelled 32 km/h: about a quarter of an hour.
    expect(itinerary.totalDurationSeconds).toBeGreaterThan(11 * 60);
    expect(itinerary.totalDurationSeconds).toBeLessThan(17 * 60);
  });

  it("finds no route into the Pink tunnel that has not opened", () => {
    expect(router.planTrip(idFor("Tavarekere"), idFor("Dairy Circle"))).toEqual([]);
    expect(router.planTrip(idFor("Indiranagar"), idFor("Shivajinagar"))).toEqual([]);
  });

  it("does not use MG Road as a Purple–Pink shortcut before the tunnel opens", () => {
    const [itinerary] = router.planTrip(idFor("Mahatma Gandhi Road"), idFor("Tavarekere"));
    expect(itinerary).toBeDefined();
    // Purple to Majestic, Green to RV Road, Yellow to Jayadeva, Pink one stop.
    expect(itinerary.legs.map((l) => l.line)).toEqual(["purple", "green", "yellow", "pink"]);
    expect(itinerary.interchanges.map((i) => i.station)).toEqual([
      idFor("Nadaprabhu Kempegowda Station, Majestic"),
      idFor("Rashtreeya Vidyalaya Road"),
      idFor("Jayadeva Hospital"),
    ]);
  });
});

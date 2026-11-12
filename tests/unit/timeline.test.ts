import { describe, it, expect } from "vitest";
import { stations, segments } from "@/lib/network";
import {
  expectedToDate,
  monthEnd,
  monthRange,
  networkAt,
  openingEvents,
  stationFirstDates,
} from "@/lib/timeline";

const events = openingEvents(segments);
const firstDates = stationFirstDates(stations);

describe("openingEvents", () => {
  it("lists every opening in date order, first to last", () => {
    expect(events.map((e) => `${e.date} ${e.line} ${e.from}>${e.to}`)).toEqual([
      "2011-10-20 purple mahatma-gandhi-road>baiyappanahalli",
      "2014-03-01 green peenya-industry>mantri-square-sampige-road",
      "2015-05-01 green nagasandra>peenya-industry",
      "2015-11-16 purple mysuru-road>magadi-road",
      "2016-04-30 purple magadi-road>mahatma-gandhi-road",
      "2017-06-18 green mantri-square-sampige-road>yelachenahalli",
      "2021-01-15 green yelachenahalli>silk-institute",
      "2021-08-30 purple kengeri>mysuru-road",
      "2023-03-26 purple krishnarajapura>whitefield-kadugodi",
      "2023-10-09 purple challaghatta>kengeri",
      "2023-10-09 purple baiyappanahalli>krishnarajapura",
      "2024-11-07 green madavara>nagasandra",
      "2025-08-11 yellow rashtreeya-vidyalaya-road>delta-electronics-bommasandra",
      "2026-11-14 pink kalena-agrahara>tavarekere",
      "2027-03-01 pink tavarekere>nagawara",
    ]);
  });

  it("marks only the unbuilt Pink tunnel as planned", () => {
    expect(events.filter((e) => e.planned).map((e) => e.id)).toEqual(["pink:tavarekere:2027-03-01"]);
  });

  it("accounts for every metre of track exactly once", () => {
    const total = segments.reduce((sum, s) => sum + s.distanceMeters, 0);
    expect(events.reduce((sum, e) => sum + e.meters, 0)).toBe(total);
  });
});

describe("networkAt", () => {
  it("is empty before the first train", () => {
    expect(networkAt(events, firstDates, "2011-10-19")).toEqual({
      meters: 0, stations: 0, lines: 0, plannedMeters: 0, plannedStations: 0,
    });
  });

  it("starts as six Purple stations in October 2011", () => {
    const first = networkAt(events, firstDates, "2011-10-20");
    expect(first.stations).toBe(6);
    expect(first.lines).toBe(1);
    expect(first.meters).toBe(events[0].meters);
    expect(first.plannedMeters).toBe(0);
  });

  it("only ever grows", () => {
    let previous = 0;
    for (const month of monthRange(events)) {
      const size = networkAt(events, firstDates, monthEnd(month));
      expect(size.meters + size.plannedMeters).toBeGreaterThanOrEqual(previous);
      previous = size.meters + size.plannedMeters;
    }
  });

  it("reaches 88 stations on four lines once the Pink Line opens, with the tunnel still to come", () => {
    const opened = networkAt(events, firstDates, "2026-11-14");
    expect(opened.stations).toBe(88);
    expect(opened.lines).toBe(4);
    expect(opened.plannedStations).toBe(0);

    const end = networkAt(events, firstDates, "2027-03-31");
    expect(end.stations).toBe(88);
    expect(end.plannedStations).toBe(11);
    expect(end.meters + end.plannedMeters).toBe(segments.reduce((sum, s) => sum + s.distanceMeters, 0));
  });
});

describe("month helpers", () => {
  it("spans October 2011 to March 2027 without gaps", () => {
    const months = monthRange(events);
    expect(months[0]).toBe("2011-10");
    expect(months[months.length - 1]).toBe("2027-03");
    expect(months).toHaveLength(186);
    expect(months[3]).toBe("2012-01");
  });

  it("turns a target month into a date, and refuses anything vaguer", () => {
    expect(expectedToDate("March 2027")).toBe("2027-03-01");
    expect(() => expectedToDate("early 2027")).toThrow();
  });
});

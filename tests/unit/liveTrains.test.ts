import { describe, it, expect } from "vitest";
import { stations, segments, timetables } from "@/lib/network";
import {
  DWELL_SECONDS,
  atSecondsOfDay,
  istClock,
  lineServices,
  terminalDepartures,
  trainsAt,
} from "@/lib/liveTrains";

const BEFORE_PINK = "2026-11-13";
const PINK_OPEN = "2026-11-14";
const at = (h: number, m = 0, s = 0) => h * 3600 + m * 60 + s;

describe("lineServices", () => {
  it("runs both directions of every open line, and Pink only from its opening day", () => {
    const before = lineServices(stations, segments, BEFORE_PINK);
    expect(before.map((s) => `${s.line}${s.directionIndex}`).sort()).toEqual([
      "green0", "green1", "purple0", "purple1", "yellow0", "yellow1",
    ]);
    const after = lineServices(stations, segments, PINK_OPEN);
    expect(after.map((s) => `${s.line}${s.directionIndex}`).sort()).toEqual([
      "green0", "green1", "pink0", "pink1", "purple0", "purple1", "yellow0", "yellow1",
    ]);
  });

  it("stops Pink trains at Tavarekere, where the open section ends", () => {
    const [north, south] = lineServices(stations, segments, PINK_OPEN).filter((s) => s.line === "pink");
    expect(north.stationIds).toEqual([
      "kalena-agrahara", "hulimavu", "iimb", "jp-nagar-4th-phase", "jayadeva-hospital", "tavarekere",
    ]);
    expect(south.stationIds).toEqual([...north.stationIds].reverse());
    expect(north.departAfter[0]).toBe(0);
    expect(north.tripSeconds).toBe(south.tripSeconds);
    expect(north.tripSeconds).toBe(
      segments.filter((s) => s.line === "pink").slice(0, 5).reduce((sum, s) => sum + s.runSeconds, 0),
    );
  });
});

describe("terminalDepartures", () => {
  it("sends a Pink train every 8 minutes from 06:00 to 23:00 on a weekday", () => {
    const entry = timetables.find((t) => t.line === "pink" && t.directionIndex === 0 && t.dayType === "weekday")!;
    const departures = terminalDepartures(entry);
    expect(departures[0]).toBe(at(6));
    expect(departures[1] - departures[0]).toBe(480);
    expect(departures[departures.length - 1]).toBeLessThanOrEqual(at(23));
    expect(departures[departures.length - 1]).toBeGreaterThan(at(23) - 480);
    expect(departures).toHaveLength(128);
  });

  it("starts at 07:00 on Sundays", () => {
    for (const line of ["purple", "green", "yellow", "pink"]) {
      const entry = timetables.find((t) => t.line === line && t.directionIndex === 0 && t.dayType === "sunday_holiday")!;
      expect(terminalDepartures(entry)[0], line).toBe(at(7));
    }
  });
});

describe("trainsAt", () => {
  const services = lineServices(stations, segments, PINK_OPEN);

  it("has nothing running in the small hours", () => {
    expect(trainsAt(services, timetables, "weekday", at(3))).toEqual([]);
  });

  it("puts exactly one train on each line at the moment of its first departure", () => {
    const pinkOnly = services.filter((s) => s.line === "pink" && s.directionIndex === 0);
    const trains = trainsAt(pinkOnly, timetables, "weekday", at(6));
    expect(trains).toEqual([
      {
        id: `pink-0-${at(6)}`,
        line: "pink",
        directionIndex: 0,
        fromStation: "kalena-agrahara",
        toStation: "hulimavu",
        progress: 0,
      },
    ]);
  });

  it("holds a train at the platform for the dwell time, then moves it", () => {
    const pinkOnly = services.filter((s) => s.line === "pink" && s.directionIndex === 0);
    const waiting = trainsAt(pinkOnly, timetables, "weekday", at(6, 0, DWELL_SECONDS - 1));
    expect(waiting[0].progress).toBe(0);
    const moving = trainsAt(pinkOnly, timetables, "weekday", at(6, 1, 30));
    expect(moving[0].progress).toBeGreaterThan(0);
    expect(moving[0].progress).toBeLessThan(1);
  });

  it("keeps about trip-time ÷ headway Pink trains out in each direction", () => {
    // ~13 min end to end on an 8 minute headway: one or two trains a direction.
    const noon = trainsAt(services, timetables, "weekday", at(12)).filter((t) => t.line === "pink");
    for (const direction of [0, 1]) {
      const count = noon.filter((t) => t.directionIndex === direction).length;
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it("runs more trains in the peak than off-peak", () => {
    const peak = trainsAt(services, timetables, "weekday", at(8, 30)).length;
    const offPeak = trainsAt(services, timetables, "weekday", at(13)).length;
    expect(peak).toBeGreaterThan(offPeak);
    expect(offPeak).toBeGreaterThan(0);
  });

  it("only ever places a train between two neighbouring stations of its own line", () => {
    for (const train of trainsAt(services, timetables, "weekday", at(18, 17))) {
      const service = services.find((s) => s.line === train.line && s.directionIndex === train.directionIndex)!;
      const index = service.stationIds.indexOf(train.fromStation);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(service.stationIds[index + 1]).toBe(train.toStation);
      expect(train.progress).toBeGreaterThanOrEqual(0);
      expect(train.progress).toBeLessThanOrEqual(1);
    }
  });

  it("lets the last trains finish their run after midnight", () => {
    // The 23:00 Purple departure takes over an hour to cross the city.
    const late = trainsAt(services, timetables, "weekday", at(0, 10));
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((t) => t.line === "purple")).toBe(true);
    expect(late.every((t) => t.id.includes("-y"))).toBe(true);
  });
});

describe("IST clock", () => {
  it("reads Bengaluru time from an instant", () => {
    // Saturday 14 Nov 2026, 06:00 IST.
    expect(istClock(Date.parse("2026-11-14T00:30:00Z"))).toEqual({
      today: "2026-11-14",
      dayType: "saturday",
      secondsSinceMidnight: at(6),
    });
    expect(istClock(Date.parse("2026-11-15T12:00:00Z")).dayType).toBe("sunday_holiday");
    expect(istClock(Date.parse("2026-11-16T12:00:00Z")).dayType).toBe("weekday");
  });

  it("moves to another time on the same Bengaluru day", () => {
    const morning = Date.parse("2026-11-14T00:30:00Z");
    const evening = atSecondsOfDay(morning, at(18, 15));
    expect(istClock(evening)).toEqual({ today: "2026-11-14", dayType: "saturday", secondsSinceMidnight: at(18, 15) });
  });
});

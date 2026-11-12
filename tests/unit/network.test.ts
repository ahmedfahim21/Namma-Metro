import { describe, it, expect } from "vitest";
import network from "@/data/network.json";
import { NetworkSchema, type Station, type Segment } from "@/packages/network/src/schema";
import {
  dateInIST,
  formatOpenDate,
  isInService,
  isNewlyOpened,
  openState,
} from "@/packages/network/src/status";
import { searchStations, routableStations, routableSegments } from "@/lib/network";
import { buildRouteSlug, parseRouteSlug, popularRoutePairs } from "@/lib/routeSlug";

const stations = network.stations as Station[];
const segments = network.segments as Segment[];

function onLine(line: string): Station[] {
  const sequence = (s: Station) => s.lines.find((m) => m.line === line)!.sequence;
  return stations.filter((s) => s.lines.some((m) => m.line === line)).sort((a, b) => sequence(a) - sequence(b));
}

describe("built network", () => {
  it("passes the schema", () => {
    expect(NetworkSchema.safeParse(network).success).toBe(true);
  });

  it("has the published number of stations on each line", () => {
    expect(onLine("purple")).toHaveLength(37);
    expect(onLine("green")).toHaveLength(32);
    expect(onLine("yellow")).toHaveLength(16);
    expect(onLine("pink")).toHaveLength(18);
    // 103 line memberships, four of them shared interchanges.
    expect(stations).toHaveLength(99);
  });

  it("gives every station a surveyed position inside Bengaluru and a Kannada name", () => {
    for (const s of stations) {
      expect(s.coordConfidence, s.name).toBe("surveyed");
      expect(s.lat, s.name).toBeGreaterThan(12.75);
      expect(s.lat, s.name).toBeLessThan(13.25);
      expect(s.lng, s.name).toBeGreaterThan(77.4);
      expect(s.lng, s.name).toBeLessThan(77.85);
      expect(s.nameKn, s.name).toMatch(/[ಀ-೿]/);
    }
  });

  it("keeps consecutive stations a plausible distance apart", () => {
    for (const seg of segments) {
      expect(seg.distanceMeters, `${seg.from} → ${seg.to}`).toBeGreaterThan(400);
      expect(seg.distanceMeters, `${seg.from} → ${seg.to}`).toBeLessThan(3200);
    }
  });

  it("adds each line's segments up to its published length", () => {
    for (const line of network.lines) {
      const total = segments.filter((s) => s.line === line.id).reduce((sum, s) => sum + s.distanceMeters, 0);
      expect(Math.abs(total - line.lengthKm * 1000), line.id).toBeLessThan(50);
    }
  });

  it("lists the Pink Line in its real order, south to north", () => {
    expect(onLine("pink").map((s) => s.name)).toEqual([
      "Kalena Agrahara",
      "Hulimavu",
      "IIMB",
      "JP Nagar 4th Phase",
      "Jayadeva Hospital",
      "Tavarekere",
      "Dairy Circle",
      "Lakkasandra",
      "Langford Town",
      "National Military School",
      "Mahatma Gandhi Road",
      "Shivajinagar",
      "Cantonment Railway Station",
      "Pottery Town",
      "Tannery Road",
      "Venkateshpura",
      "Kadugundanahalli",
      "Nagawara",
    ]);
  });

  it("opens only the elevated Pink section: six stations, five segments", () => {
    const pink = onLine("pink").map((s) => s.lines.find((m) => m.line === "pink")!);
    expect(pink.slice(0, 6).map((m) => m.status)).toEqual(Array(6).fill("opening_soon"));
    expect(pink.slice(0, 6).map((m) => m.openDate)).toEqual(Array(6).fill("2026-11-14"));
    expect(pink.slice(0, 6).map((m) => m.layout)).toEqual(Array(6).fill("elevated"));
    expect(pink.slice(6).map((m) => m.status)).toEqual(Array(12).fill("under_construction"));
    expect(pink.slice(6).map((m) => m.layout)).toEqual(Array(12).fill("underground"));
    expect(pink.slice(6).every((m) => m.openDate === undefined && m.expected === "March 2027")).toBe(true);

    const pinkSegments = segments.filter((s) => s.line === "pink");
    expect(pinkSegments).toHaveLength(17);
    expect(routableSegments.filter((s) => s.line === "pink").map((s) => `${s.from}>${s.to}`)).toEqual([
      "kalena-agrahara>hulimavu",
      "hulimavu>iimb",
      "iimb>jp-nagar-4th-phase",
      "jp-nagar-4th-phase>jayadeva-hospital",
      "jayadeva-hospital>tavarekere",
    ]);
  });

  it("marks only usable interchanges as interchanges", () => {
    expect(stations.filter((s) => s.interchange).map((s) => s.name).sort()).toEqual([
      "Jayadeva Hospital",
      "Nadaprabhu Kempegowda Station, Majestic",
      "Rashtreeya Vidyalaya Road",
    ]);
    // MG Road will join the Pink Line, but you cannot change there yet.
    const mgRoad = stations.find((s) => s.name === "Mahatma Gandhi Road")!;
    expect(mgRoad.lines.map((m) => [m.line, m.status])).toEqual([
      ["purple", "operational"],
      ["pink", "under_construction"],
    ]);
    expect(mgRoad.interchange).toBe(false);
    expect(mgRoad.status).toBe("operational");
  });

  it("offers 88 stations for trip planning and none of the unbuilt ones", () => {
    expect(routableStations).toHaveLength(88);
    expect(routableStations.some((s) => s.name === "Dairy Circle")).toBe(false);
    expect(routableStations.some((s) => s.name === "Tavarekere")).toBe(true);
  });

  it("includes the Purple Line station that used to be missing", () => {
    const names = onLine("purple").map((s) => s.name);
    expect(names.slice(31, 34)).toEqual(["Nallurhalli", "Sri Sathya Sai Hospital", "Pattandur Agrahara"]);
  });
});

describe("searchStations", () => {
  it("finds stations by the names people actually use", () => {
    expect(searchStations("Majestic")[0].name).toBe("Nadaprabhu Kempegowda Station, Majestic");
    expect(searchStations("MG Road")[0].name).toBe("Mahatma Gandhi Road");
    expect(searchStations("kr puram")[0].name).toBe("Krishnarajapura");
    expect(searchStations("Suddaguntepalya")[0].name).toBe("Tavarekere");
    expect(searchStations("ಹುಳಿಮಾವು")[0].name).toBe("Hulimavu");
  });

  it("never suggests a station that is still under construction", () => {
    expect(searchStations("Nagawara")).toEqual([]);
    expect(searchStations("Shivajinagar")).toEqual([]);
  });
});

describe("opening status", () => {
  const firstSection = { status: "opening_soon" as const, openDate: "2026-11-14" };
  const tunnel = { status: "under_construction" as const, expected: "March 2027" };
  const old = { status: "operational" as const, openDate: "2011-10-20" };

  it("flips an announced section to open on its opening day", () => {
    expect(openState(firstSection, "2026-11-13")).toBe("opens_soon");
    expect(openState(firstSection, "2026-11-14")).toBe("open");
    expect(openState(firstSection, "2027-01-01")).toBe("open");
    expect(openState(tunnel, "2030-01-01")).toBe("planned");
    expect(openState(old, "2026-11-12")).toBe("open");
  });

  it("routes over open and announced sections but not unbuilt ones", () => {
    expect(isInService(firstSection)).toBe(true);
    expect(isInService(old)).toBe(true);
    expect(isInService(tunnel)).toBe(false);
  });

  it("calls a section new for its first 90 days only", () => {
    expect(isNewlyOpened(firstSection, "2026-11-13")).toBe(false);
    expect(isNewlyOpened(firstSection, "2026-11-14")).toBe(true);
    expect(isNewlyOpened(firstSection, "2027-02-11")).toBe(true);
    expect(isNewlyOpened(firstSection, "2027-02-12")).toBe(false);
    expect(isNewlyOpened(old, "2026-11-14")).toBe(false);
    expect(isNewlyOpened(tunnel, "2026-11-14")).toBe(false);
  });

  it("reads the calendar day in Bengaluru, not on the device", () => {
    // 19:00 UTC on the 13th is 00:30 on the 14th in IST.
    expect(dateInIST(new Date("2026-11-13T19:00:00Z"))).toBe("2026-11-14");
    expect(dateInIST(new Date("2026-11-13T18:00:00Z"))).toBe("2026-11-13");
  });

  it("formats opening dates", () => {
    expect(formatOpenDate("2026-11-14")).toBe("14 Nov 2026");
    expect(formatOpenDate("2026-11-14", false)).toBe("14 Nov");
  });
});

describe("route pages", () => {
  it("pre-renders trips between the interchanges and the ends of the open track", () => {
    const featured = [...new Set(popularRoutePairs().flatMap(([a, b]) => [a.name, b.name]))].sort();
    expect(featured).toEqual([
      "Challaghatta",
      "Delta Electronics Bommasandra",
      "Jayadeva Hospital",
      "Kalena Agrahara",
      "Madavara",
      "Nadaprabhu Kempegowda Station, Majestic",
      "Rashtreeya Vidyalaya Road",
      "Silk Institute",
      "Tavarekere",
      "Whitefield (Kadugodi)",
    ]);
    expect(popularRoutePairs()).toHaveLength(90);
  });

  it("round-trips every station pair through its URL slug", () => {
    for (const [from, to] of popularRoutePairs()) {
      const parsed = parseRouteSlug(buildRouteSlug(from, to));
      expect(parsed?.from.id).toBe(from.id);
      expect(parsed?.to.id).toBe(to.id);
    }
    expect(parseRouteSlug("nowhere-to-nothing")).toBeNull();
  });
});

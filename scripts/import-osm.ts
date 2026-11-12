/**
 * Imports station coordinates and Kannada names from OpenStreetMap into
 * data/source/coords.ts.
 *
 * Run by hand when stations change: pnpm run import:osm
 * It is deliberately NOT part of predev/prebuild — the build must not depend
 * on a public API being up. The output file is committed.
 *
 * Every station in data/source/stations.ts must resolve to exactly one OSM
 * object. Anything unmatched or ambiguous fails the import; there is no
 * fallback to guessed positions.
 *
 * Data © OpenStreetMap contributors, ODbL.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { lines, nameKnOverrides } from "../data/source/stations";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const BBOX = "12.75,77.40,13.25,77.85";
const QUERY = `[out:json][timeout:90];
(
  nwr["network"="Namma Metro"]["railway"="station"](${BBOX});
  nwr["network"="Namma Metro"]["construction:railway"="station"](${BBOX});
);
out center tags;`;

/** Our station name -> the name OpenStreetMap uses, where they differ. */
const OSM_NAME: Record<string, string> = {
  "Mysuru Road": "Mysore Road",
  Seetharamapalya: "Seetharampalya",
  Nallurhalli: "Nallurahalli",
  "Sir M. Visvesvaraya Station, Central College": "Sir M. Visvesvaraya Stn., Central College",
  "Dr. B.R. Ambedkar Station, Vidhana Soudha": "Dr. B. R. Ambedkar Station, Vidhana Soudha",
  Yeshwanthpur: "Yeshwantpur",
  IIMB: "Bilekahalli IIM-B",
  "JP Nagar 4th Phase": "N S Palya",
  Tavarekere: "Suddaguntepalya",
  "National Military School": "Rashtriya Military School",
  "Cantonment Railway Station": "Cantonment",
  Venkateshpura: "Venkateshapura",
};

/** Stations with more than one candidate in OSM, pinned to a specific object. */
const OSM_ID: Record<string, string> = {
  // Two under-construction nodes exist: this is the Pink Line box, the other is the Blue Line station.
  Nagawara: "node/4975616695",
  // The open Purple Line station, not the separate under-construction Pink Line box.
  "Mahatma Gandhi Road": "node/6400857554",
  // The open Yellow Line station, not the under-construction Blue Line one.
  "Central Silk Board": "node/5760198212",
};

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
}

function normalise(name: string): string {
  return name
    .replace(/\s*\((u\/c|Proposed)\)\s*$/i, "")
    .replace(/\s+Metro Station$/i, "")
    .trim()
    .toLowerCase();
}

function cleanKannada(name: string): string {
  return name.replace(/\s*ಮೆಟ್ರ[ೋೊ](\s*ನಿಲ್ದಾಣ)?\s*$/u, "").trim();
}

async function fetchOverpass(): Promise<OsmElement[]> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 5000 * 2 ** (attempt - 1)));
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "metro-data-import/1.0" },
      body: `data=${encodeURIComponent(QUERY)}`,
    });
    lastStatus = response.status;
    // Overpass sheds load with 429/502/504; those are worth waiting out.
    if ([429, 502, 504].includes(response.status)) continue;
    if (!response.ok) throw new Error(`Overpass returned HTTP ${response.status}`);
    return ((await response.json()) as { elements: OsmElement[] }).elements;
  }
  throw new Error(`Overpass still busy after 5 attempts (last HTTP ${lastStatus})`);
}

async function main() {
  const elements = await fetchOverpass();
  const byName = new Map<string, OsmElement[]>();
  const byRef = new Map<string, OsmElement>();
  for (const element of elements) {
    byRef.set(`${element.type}/${element.id}`, element);
    if (!element.tags?.name) continue;
    const key = normalise(element.tags.name);
    byName.set(key, [...(byName.get(key) ?? []), element]);
  }

  const names = [...new Set(lines.flatMap((line) => line.stations))];
  const problems: string[] = [];
  const out: Record<string, { lat: number; lng: number; nameKn?: string; osm: string }> = {};

  for (const name of names) {
    let match: OsmElement | undefined;
    if (OSM_ID[name]) {
      match = byRef.get(OSM_ID[name]);
      if (!match) problems.push(`${name}: pinned ${OSM_ID[name]} not in the Overpass result`);
    } else {
      const candidates = byName.get(normalise(OSM_NAME[name] ?? name)) ?? [];
      if (candidates.length === 1) match = candidates[0];
      else if (candidates.length === 0) problems.push(`${name}: no OSM station named "${OSM_NAME[name] ?? name}"`);
      else
        problems.push(
          `${name}: ${candidates.length} candidates (${candidates.map((c) => `${c.type}/${c.id}`).join(", ")}) — pin one in OSM_ID`,
        );
    }
    if (!match) continue;
    const lat = match.lat ?? match.center?.lat;
    const lng = match.lon ?? match.center?.lon;
    if (lat === undefined || lng === undefined) {
      problems.push(`${name}: ${match.type}/${match.id} has no position`);
      continue;
    }
    const nameKn = nameKnOverrides[name] ?? (match.tags["name:kn"] ? cleanKannada(match.tags["name:kn"]) : undefined);
    out[name] = {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      ...(nameKn ? { nameKn } : {}),
      osm: `${match.type}/${match.id}`,
    };
  }

  if (problems.length > 0) {
    console.error(`OSM import failed for ${problems.length} station(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }

  const body = `/**
 * GENERATED by scripts/import-osm.ts — do not edit by hand.
 * Station positions and Kannada names from OpenStreetMap.
 * Data © OpenStreetMap contributors, available under the Open Database License.
 * Imported ${new Date().toISOString().slice(0, 10)}.
 */
export interface StationCoord {
  lat: number;
  lng: number;
  nameKn?: string;
  /** OpenStreetMap object this position came from. */
  osm: string;
}

export const coords: Record<string, StationCoord> = ${JSON.stringify(out, null, 2)};
`;
  writeFileSync(resolve(__dirname, "../data/source/coords.ts"), body);
  console.log(`Wrote data/source/coords.ts: ${Object.keys(out).length} stations.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

# Data sources & known gaps

This project has no official BMRCL data API to build against. Everything in
`data/` is assembled from public sources and hand-authored — see
`data/source/*.ts` for the structured input and `scripts/build-network.ts`
for how it's compiled into `data/*.json`. **Verify anything fare- or
timing-critical against the official Namma Metro app before travelling.**
Every record in the built JSON also carries a `source` field with this same
information inline.

Last checked: **September 2026**.

## Lines & stations

| Line | Source | Confidence |
|---|---|---|
| Purple | BMRCL announcements + Wikipedia "Purple Line (Namma Metro)" and per-station articles | 36 stations modelled here vs. 37 commonly cited elsewhere — **one station is unaccounted for**, likely a short-segment infill station near the western or eastern extension. Needs a pass against the official BMRCL station list. |
| Green | Wikipedia "Green Line (Namma Metro)" and per-station articles | High — 32 stations, matches multiple independent sources. |
| Yellow | Deccan Herald opening-day coverage (10 Aug 2025) + Wikipedia per-station articles | High — 16 stations, matches the announced opening list. |
| Pink | BMRCL Phase 2 status updates (partial/staggered station openings through 2026) | **Low.** Station order for the northern half (Corporation Circle → Nagawara) is not confirmed against an authoritative source. Marked `status: "under_construction"` and **excluded from the routing graph** for this reason — see `lib/network.ts`. Shown on `/map` only, greyed out. |

## Coordinates

All station `lat`/`lng` are `coordConfidence: "approximate"` — placed by
linear interpolation between a handful of hand-placed anchor points per
line (see the `anchors` arrays in `data/source/stations.ts`), not survey
data or an official GIS export. Good enough for "nearest station" search
and the schematic map; **not** good enough for turn-by-turn walking
directions. A real fix is importing station coordinates from OpenStreetMap
or BMRCL's own GIS data, keyed by the same station `id`s.

## Segment run times

Modelled from distance (via the interpolated coordinates above) divided by
an assumed average commercial speed of 32 km/h including dwell time — not
measured per-segment timings. See `AVG_SPEED_MPS` in
`scripts/build-network.ts`. Reasonable for trip-time estimates; will drift
from reality on segments with unusual speed restrictions.

## Timetables

First/last train times and peak/off-peak headway bands are modelled from
BMRCL's published service hours and commonly reported frequency figures
(4–6 min peak, 7–10 min off-peak on Purple/Green; wider on Yellow), not
scraped from a live or official per-station timetable — **BMRCL does not
publish one publicly**. Presented in the UI as "estimated from typical
frequency, not a live feed." See `data/source/timetables.ts`.

## Fares

Slab fares, the 5% mobile-QR discount, and the Smart Card/NCMC peak (5%) /
off-peak (10%, all day Sunday and on 26 Jan / 15 Aug / 2 Oct) discount
structure are taken from BMRCL's public fare notification and press
coverage (Deccan Herald, "Namma Metro's QR-code based passes"). The
stop-count slabs in `data/source/fares.ts` **approximate** BMRCL's actual
distance-band chart — they are close enough for a planning estimate but
are explicitly not the authoritative fare chart. QR/multi-day pass prices
are best-effort and should be reconfirmed before relying on them for an
actual purchase.

## First/last mile (feeder buses)

`data/source/feeders-seed.ts` is a small **hand-curated seed** for the
busiest interchange/terminal stations — it is *not* derived from the
Vonter/bmtc-gtfs feed the project plan calls for. `scripts/build-feeders.ts`
is a placeholder that emits this seed as `data/generated/feeders.json`;
swapping it for a real GTFS-snap importer is a documented follow-up (see
the file's own header comment) and doesn't require changing anything that
consumes `FeederStop` records.

## How to fix a data issue

1. Edit the relevant file under `data/source/`.
2. Run `pnpm run build:data` to regenerate `data/*.json` and
   `public/data/network.json`.
3. Update this file's "last checked" date and the specific row/section you
   touched.
4. `pnpm test` — the fare and routing suites will catch a station rename
   that breaks a fixture.

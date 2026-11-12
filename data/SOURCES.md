# Data sources & known gaps

This project has no official BMRCL data API to build against. Everything in
`data/` is assembled from public sources and hand-authored — see
`data/source/*.ts` for the structured input and `scripts/build-network.ts`
for how it's compiled into `data/*.json`. **Verify anything fare- or
timing-critical against the official Namma Metro app before travelling.**
Every record in the built JSON also carries a `source` field with this same
information inline.

Last checked: **12 November 2026**.

## Lines & stations

| Line | Stations | Source | Confidence |
|---|---|---|---|
| Purple | 37 | Wikipedia "Purple Line (Namma Metro)" and "List of Namma Metro stations" | High. Count and order match the published list (the previously missing Sri Sathya Sai Hospital is in). |
| Green | 32 | Wikipedia "Green Line (Namma Metro)" and "List of Namma Metro stations" | High. |
| Yellow | 16 | Deccan Herald opening coverage (Aug 2025) + Wikipedia station list | High. |
| Pink | 18 (6 opening, 12 under construction) | Wikipedia "Pink Line (Namma Metro)" for order, layout and length; Oneindia and Urban Acres for the November 2026 opening | Order and layout: high. Opening day: **medium**, see below. |

### Pink Line opening

- Kalena Agrahara → Tavarekere (6 elevated stations, 7.5 km) is inaugurated on 13 Nov 2026. Passenger service is modelled from **14 Nov 2026**; one outlet reported 15 Nov. The date is the single constant `PINK_OPENING_DATE` in `data/source/stations.ts`.
- Until that day the section is routable but every trip on it is marked "Not possible yet", and the live-train view runs no Pink trains. On the day it flips by itself; no rebuild is needed.
- Dairy Circle → Nagawara (12 underground stations) is `under_construction` with a target of March 2027. That target is unconfirmed, and these stations are never routed through.
- Mahatma Gandhi Road is listed on both Purple and Pink, but is not an interchange until the Pink platforms open.
- Three open stations have more than one name in circulation. The app uses the names from opening-week press coverage and accepts the others in search: IIMB (Bilekahalli IIM-B), JP Nagar 4th Phase (N S Palya), Tavarekere (Suddaguntepalya). **Not verified against station signage.**

### Section opening dates

The per-section `openDate` values in `data/source/stations.ts` drive the growth timeline on `/map`. They are from the Wikipedia line articles and were not re-checked one by one against BMRCL press releases. Yellow is dated 11 Aug 2025 (first day of public service; inauguration was 10 Aug).

## Coordinates

Station positions and Kannada names are imported from **OpenStreetMap** (© OpenStreetMap contributors, ODbL) by `scripts/import-osm.ts` into `data/source/coords.ts`, which is committed. All 99 stations resolve to a named OSM object; the object id is kept on every record. Under-construction stations use OSM's construction-site nodes, so expect those to move slightly when the stations open.

Spot check, 12 Nov 2026: ten stations (Majestic, MG Road, RV Road, Jayadeva Hospital, Whitefield, Challaghatta, Madavara, Silk Institute, Delta Electronics Bommasandra, Kalena Agrahara) were compared between the import and a second Overpass query, and match. **Not verified against the official Namma Metro app.**

To refresh: `pnpm run import:osm`, then `pnpm run build:data`. The import fails if any station is missing or ambiguous in OSM; it never guesses a position.

## Segment distances and run times

- Distance: straight-line spacing between OSM station positions, scaled per line so the segments add up to the published route length (Purple 43.49 km, Green 33.46 km, Yellow 19.15 km, Pink 21.25 km). The build fails if that scale factor falls outside 0.97–1.25.
- Run time: distance ÷ an assumed 32 km/h average including dwell (`AVG_SPEED_MPS` in `scripts/build-network.ts`). This gives 82 min end to end on Purple, in line with the timetable, but individual segments will be off.

## Timetables

First/last trains and headway bands are modelled from published service hours and commonly reported frequencies, not from a per-station timetable (BMRCL does not publish one).

- Purple, Green: 05:00–23:00, 4 min peak / 7 min off-peak. Yellow: wider headways. **Not re-verified in November 2026.**
- Pink: 06:00–23:00, every 8 minutes all day with five trains (Urban Acres, November 2026).
- All lines: first train 07:00 on Sundays.

The "Live" map view is a simulation built from these numbers. It is labelled as such in the UI.

## Fares

Token fares use BMRCL's distance bands from the February 2025 revision: ₹10 up to 2 km, then ₹20, ₹30, ₹40, ₹50 for each further 2 km up to 10 km, ₹60 to 15 km, ₹70 to 20 km, ₹80 to 25 km, ₹90 beyond. The 5% revision announced for 9 February 2026 was put on hold on 8 February (Trayaan, Oneindia) and is not applied.

- The bands are the official chart; the distance fed into them is our estimate (see above), so a trip close to a band edge can be one band out.
- Discounts: 5% mobile QR; Smart Card/NCMC 5% peak, 10% off-peak and all day on Sundays and 26 Jan / 15 Aug / 2 Oct.
- Spot check, 12 Nov 2026: five trips priced by the app land in the band their estimated distance implies — Majestic→Indiranagar 8.2 km ₹50, Majestic→Whitefield 25.7 km ₹90, Hulimavu→Electronic City 15.7 km ₹70, Kalena Agrahara→Tavarekere 7.0 km ₹40, Challaghatta→Whitefield 43.5 km ₹90. Majestic→Whitefield sits 0.7 km over the 25 km edge, exactly the case where the official fare may be one band lower (₹80). **None of these were verified against the official fare chart or app**; do this before launch.
- QR pass prices are carried over from the earlier dataset and **not re-verified**.

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
   `public/data/network.json`. If you added or renamed a station, run
   `pnpm run import:osm` first.
3. Update this file's "last checked" date and the specific row/section you
   touched.
4. `pnpm test` — the fare and routing suites will catch a station rename
   that breaks a fixture.

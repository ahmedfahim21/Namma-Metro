# Namma Metro Planner

An offline-first route planner for Bengaluru's Namma Metro — built to do a
few things the typical metro-planner app doesn't:

- **Real fares, not one number.** Token, mobile QR (5% off), and Smart
  Card/NCMC (5% peak / 10% off-peak, all day Sunday and on national
  holidays) — priced side by side, cheapest highlighted, with day/multi-day
  pass break-even math.
- **Works with zero signal.** The whole network — stations, segments,
  timetables, fares — ships in the client bundle and is cached by a service
  worker. Route planning, fare quotes and next-train estimates all run
  on-device; nothing needs a round trip once the app has loaded once.
- **Multiple itineraries, not just one path.** Fastest / fewest
  interchanges / least walking / cheapest, deduplicated when they collapse
  to the same physical route.
- **A map worth looking at.** `/map` has four views of the same network:
  the diagram, trains moving on the timetable (with a slider over the day),
  journey-time rings from any station, and every opening since 2011. Each
  one can switch between the tidy diagram and real geography.
- **SEO'd, shareable route pages** at `/route/<from>-to-<to>`, statically
  generated for the busiest station pairs and rendered on demand for the
  rest.

See [`data/SOURCES.md`](data/SOURCES.md) for exactly where the network
data comes from and its known gaps — **this is not an official BMRCL
product; verify fares and timings before you travel.**

## Stack

Next.js (App Router) + TypeScript + Tailwind. No backend/database — the
network dataset is a versioned, validated build artifact (`data/*.json`),
authored as structured TypeScript under `data/source/` and compiled by
`pnpm run build:data`.

```
app/                    Next.js routes (planner, route pages, station pages, map, offline)
components/             UI
packages/network/       Zod schema + typed loader for the built dataset
packages/routing/       line-expanded graph, Dijkstra, itinerary + departure estimation
packages/fares/         BMRCL fare + discount + pass engine
packages/lastmile/      feeder bus / auto-fare estimate / deep links
data/source/            hand-curated network topology, timetables, fares (source of truth)
data/*.json             built, validated output (regenerate with `pnpm run build:data`)
data/SOURCES.md         citations, confidence levels, known gaps
scripts/                build-network.ts, build-feeders.ts, import-osm.ts
lib/                    map layout, live-train simulation, travel-time layout, timeline
tests/unit/             Vitest
```

## Getting started

```bash
pnpm install
pnpm run build:data   # compiles data/source/*.ts -> data/*.json (also runs automatically before dev/build/test)
pnpm dev
```

- `pnpm test` — Vitest unit tests: dataset, fares, routing, map layout,
  live-train simulation, travel-time layout and timeline.
- `pnpm run import:osm` — re-imports station positions and Kannada names
  from OpenStreetMap into `data/source/coords.ts` (run by hand, needs
  network; not part of the build).
- `pnpm run build` — production build; statically generates the popular
  route/station pages (99 stations and 90 routes as of the current dataset).
- `pnpm run validate:data` — re-validates `data/source/*.ts` against the
  Zod schema (same command as `build:data`; fails loudly on a broken
  reference, e.g. a segment pointing at a station that doesn't exist).

## Scope

Purple, Green and Yellow are fully modelled. The Pink Line's first section
(Kalena Agrahara to Tavarekere) is routable and dated 14 Nov 2026: before
that day trips on it are marked as not yet possible, afterwards it behaves
like any other line with no rebuild. The Pink tunnel to Nagawara is drawn
dotted and never routed through. Blue line isn't started.

Out of scope: ticket purchase, user accounts, and real live train positions
(BMRCL has no public feed; the "Live" view is a timetable simulation and
says so).

## Launching

- Set `NEXT_PUBLIC_SITE_URL` to the public origin (for example
  `https://example.com`). Canonical URLs, the sitemap and the social card
  use it, and a production build fails without it. On Vercel the production
  domain is picked up automatically.
- Before going live, recheck the items marked "not verified" in
  [`data/SOURCES.md`](data/SOURCES.md): the Pink opening day and the fare
  spot check in particular.

## Contributing to the data

Almost everything worth improving here is the dataset, not the code. If
you spot a wrong fare, a missing station, or a stale timing: edit the
relevant file under `data/source/`, run `pnpm run build:data`, run
`pnpm test`, and update `data/SOURCES.md`. Station positions come from
OpenStreetMap, so a misplaced station is best fixed there and re-imported.

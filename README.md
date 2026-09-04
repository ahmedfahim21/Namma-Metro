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
scripts/                build-network.ts, build-feeders.ts
tests/unit/             Vitest — fare engine + routing engine
```

## Getting started

```bash
pnpm install
pnpm run build:data   # compiles data/source/*.ts -> data/*.json (also runs automatically before dev/build/test)
pnpm dev
```

- `pnpm test` — Vitest unit tests for the fare and routing engines.
- `pnpm run build` — production build; statically generates the popular
  route/station pages (144 pages as of the current dataset).
- `pnpm run validate:data` — re-validates `data/source/*.ts` against the
  Zod schema (same command as `build:data`; fails loudly on a broken
  reference, e.g. a segment pointing at a station that doesn't exist).

## Scope (v1)

Purple, Green and Yellow lines are fully modelled and routable. Pink is
shown on `/map` as "opening soon" but deliberately excluded from the
routing graph — its station order isn't confirmed against an authoritative
source yet (see `data/SOURCES.md`). Blue line isn't started.

Explicitly out of scope for v1: ticket purchase (deep-links to the
official BMRCL app / WhatsApp bot instead), user accounts, and live train
positions (BMRCL has no public real-time feed to build one on).

## Contributing to the data

Almost everything worth improving here is the dataset, not the code. If
you spot a wrong fare, a missing station, or a stale timing: edit the
relevant file under `data/source/`, run `pnpm run build:data`, run
`pnpm test`, and update `data/SOURCES.md`.

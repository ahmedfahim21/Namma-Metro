/**
 * Emits data/generated/feeders.json from the hand-curated seed.
 *
 * This is a placeholder for the real importer described in the project
 * plan: fetch the Vonter/bmtc-gtfs feed, snap stops within ~400m of each
 * metro station, and emit the same shape. Swapping the seed import below
 * for a real GTFS parse is the only change `packages/lastmile` needs.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { feederSeed } from "../data/source/feeders-seed";

const OUT_DIR = resolve(__dirname, "../data/generated");
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, "feeders.json"), JSON.stringify(feederSeed, null, 2));
console.log(`Wrote ${feederSeed.length} feeder stop records (seed data, not GTFS-derived).`);

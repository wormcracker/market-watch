/**
 * source-a.fetcher.ts
 *
 * Placeholder for a third-party live-market data source.
 *
 * This project originally used a third-party API for real-time NEPSE data.
 * That integration has been intentionally removed to keep the codebase
 * open-sourceable and dependency-free from unofficial services.
 *
 * ─── HOW TO ADD YOUR OWN DATA SOURCE ────────────────────────────────────────
 *
 * 1. Register for an API key / session cookie with your chosen provider.
 * 2. Implement the async function below to hit that endpoint.
 * 3. Transform the raw response into the `MarketSnapshot` shape:
 *
 *    {
 *      fetchedAt: number;          // Date.now()
 *      source: DataSource;         // add your label to shared/types.ts
 *      stocks: Record<string, StockEntry>;
 *    }
 *
 * 4. Export it from fetchers/index.ts and wire it into the orchestrator.
 *
 * See `csv.fetcher.ts` (the built-in CSV path) for a working reference.
 */

import { FetcherError } from ".";
import { MarketSnapshot } from "@shared/types";

export async function fetchFromSourceA(): Promise<MarketSnapshot> {
  throw new FetcherError(
    "source-a fetcher not implemented — see comments in this file",
    null,
    false
  );
}

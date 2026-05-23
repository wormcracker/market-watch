/**
 * source-b.fetcher.ts
 *
 * Placeholder for a second third-party data source (HTML scraping variant).
 *
 * Same guidance as source-a.fetcher.ts applies here.
 * This slot is intended for a scraping-based fetcher (e.g. cheerio/axios).
 *
 * ─── OFFICIAL ALTERNATIVE ───────────────────────────────────────────────────
 *
 * For the most reliable price data, download the official end-of-day CSV from:
 *   https://www.nepalstock.com/today-price
 *
 * Then POST it to:
 *   POST /api/stocks/ltp/csv
 *   Body: { rows: [{ symbol, ltp, chgPct?, open?, high?, low? }] }
 *
 * The built-in `csv.fetcher.ts` + `injectCsvLtp()` already handle this path.
 */

import { FetcherError } from ".";
import { MarketSnapshot } from "@shared/types";

export async function fetchFromSourceB(): Promise<MarketSnapshot> {
  throw new FetcherError(
    "source-b fetcher not implemented — see comments in this file",
    null,
    false
  );
}

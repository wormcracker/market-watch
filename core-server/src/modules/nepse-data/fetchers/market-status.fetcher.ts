/**
 * market-status.fetcher.ts
 *
 * Placeholder for a market-open/close status check.
 *
 * This file previously queried a third-party status endpoint.
 * That URL has been removed.
 *
 * ─── HOW TO IMPLEMENT ───────────────────────────────────────────────────────
 *
 * Option A — Time-based (no external call needed):
 *   Derive market status purely from the scheduler window defined in
 *   config/nepse/settings.json  (market_start / market_end / market_days).
 *   The scheduler already does this via `isInsideMarketWindow()` in utils/time.ts.
 *   Set `status_check: false` in settings to rely on this alone.
 *
 * Option B — API-based:
 *   1. Find or build an endpoint that returns `{ is_open: boolean }`.
 *   2. Set the URL in .env as MARKET_STATUS_API.
 *   3. Implement the fetch below following the same axios + FetcherError pattern
 *      used in source-a.fetcher.ts.
 *   4. Set `status_check: true` in settings to activate it.
 */

import { MarketStatus } from "../types";

export async function fetchFromMarketStatusAPI(): Promise<MarketStatus> {
  // Default: derive from current time only.
  // Replace with a real API call if you have one.
  return { isOpen: true, updatedAt: Date.now() };
}

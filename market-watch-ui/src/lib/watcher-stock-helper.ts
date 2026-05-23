/**
 * watcher-stock-helper.ts
 *
 * Single source of truth for creating / deleting the two standard watchers
 * that are tied to a stock:
 *
 *   SYMBOL [ltp]    — fires when LTP drops below entry zone (+2% above entry price)
 *   SYMBOL [sl/tp]  — fires when LTP goes outside the SL / TP band
 *
 * This is a plain async module — no React, no hooks.
 * Call from anywhere: stocks page batch buttons, trades page post-buy, etc.
 */

import { apiFetch, apiPost, apiDelete } from "@/lib/api";
import { parseRemark, parseSlTp } from "@/lib/utils";
import type { Watch, WatchlistEntry, Position } from "@/lib/types";

// ─── Watcher name conventions (must match StockWatchlistPanel) ────────────────
export const LTP_WATCHER_NAME = (symbol: string) => `${symbol} [ltp]`;
export const SLTP_WATCHER_NAME = (symbol: string) => `${symbol} [sl/tp]`;

// ─── Tags (must match StockWatchlistPanel) ────────────────────────────────────
const LTP_TAGS = ["stocks", "watchlist"];
const SLTP_TAGS = ["stocks", "portfolio"];
const LTP_SOUND = "double-bell.mp3";
const SLTP_SOUND = "buzzer.mp3";

// ─── Low-level POST body builder ──────────────────────────────────────────────
// Mirrors buildWatcherBody() inside StockWatchlistPanel exactly.
function buildBody(
  symbol: string,
  name: string,
  conditions: object[],
  tags: string[],
  macSound: null = null,
  customSound: string,
) {
  return {
    name,
    engine: "nepse",
    symbol,
    field: "ltp",
    conditions,
    tags,
    macSound,
    customSound,
  };
}

// ─── Fetch a watcher by name (returns null if not found) ─────────────────────
export async function fetchWatcherByName(name: string): Promise<Watch | null> {
  try {
    const result = await apiFetch<Watch>(
      `watchers/watches/byName/${encodeURIComponent(name)}`,
    );
    return result ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LTP WATCHER
//
// Logic extracted from WatchCard + EntryPriceQuickUpdate in StockWatchlistPanel:
//   - Parse remark → get entryPrices[0] (the "main" entry price)
//   - Threshold = Math.floor(entryPrice * 1.02)  ← the "+2% above" rule
//   - If threshold === 0 → skip (nothing useful to watch)
// ─────────────────────────────────────────────────────────────────────────────

/** Compute the LTP watcher threshold for a symbol from its remark string. */
export function computeLtpThreshold(remark: string): number {
  const parsed = parseRemark(remark);
  const entryPrice = parsed?.entryPrices?.[0] ?? 0;
  if (entryPrice <= 0) return 0;
  return Math.floor(entryPrice * 1.02);
}

/**
 * Ensure the LTP watcher exists for a symbol.
 * - Checks if it already exists via byName endpoint.
 * - If exists → skips (no overwrite).
 * - If not exists AND threshold > 0 → creates it.
 * - Returns "created" | "skipped" | "no_threshold"
 */
export async function ensureLtpWatcher(
  symbol: string,
  remark: string,
): Promise<"created" | "skipped" | "no_threshold"> {
  const name = LTP_WATCHER_NAME(symbol);
  const threshold = computeLtpThreshold(remark);

  if (threshold <= 0) return "no_threshold";

  const existing = await fetchWatcherByName(name);
  if (existing) return "skipped";

  await apiPost(
    "watchers/watches",
    buildBody(
      symbol,
      name,
      [{ type: "below", threshold }],
      LTP_TAGS,
      null,
      LTP_SOUND,
    ),
  );
  return "created";
}

/**
 * Delete the LTP watcher for a symbol if it exists.
 * - Returns "deleted" | "not_found"
 */
export async function deleteLtpWatcher(
  symbol: string,
): Promise<"deleted" | "not_found"> {
  const name = LTP_WATCHER_NAME(symbol);
  const existing = await fetchWatcherByName(name);
  if (!existing) return "not_found";

  await apiDelete(`watchers/watches/${existing.id}`);
  return "deleted";
}

// ─────────────────────────────────────────────────────────────────────────────
// SL/TP WATCHER
//
// Logic extracted from SlTpCard in StockWatchlistPanel:
//   1. Try parseSlTp(watchlist.slTp) → use those exact SL and TP values
//   2. Fallback if no stored SL/TP → Math.round(wacc * 0.98) / Math.round(wacc * 1.08)
//   - If wacc is 0 and no stored SL/TP → skip
// ─────────────────────────────────────────────────────────────────────────────

export type SlTpValues = { sl: number; tp: number };

/** Compute SL and TP values using the same priority as SlTpCard. */
export function computeSlTpValues(
  watchlistSlTp: string,
  wacc: number,
): SlTpValues | null {
  // Priority 1: stored slTp field on the watchlist entry
  const parsed = parseSlTp(watchlistSlTp);
  if (parsed) return { sl: parsed.sl, tp: parsed.tp };

  // Priority 2: derive from WACC (same defaults as SlTpCard)
  if (wacc > 0) {
    return {
      sl: Math.round(wacc * 0.98),
      tp: Math.round(wacc * 1.08),
    };
  }

  return null; // nothing useful → skip
}

/**
 * Ensure the SL/TP watcher exists for a symbol.
 * - Checks if it already exists → skips (no overwrite, preserves user edits).
 * - If not exists → computes SL/TP → creates it.
 * - Returns "created" | "skipped" | "no_values"
 */
export async function ensureSlTpWatcher(
  symbol: string,
  watchlistSlTp: string,
  wacc: number,
): Promise<"created" | "skipped" | "no_values"> {
  const name = SLTP_WATCHER_NAME(symbol);

  const values = computeSlTpValues(watchlistSlTp, wacc);
  if (!values) return "no_values";

  const existing = await fetchWatcherByName(name);
  if (existing) return "skipped";

  await apiPost(
    "watchers/watches",
    buildBody(
      symbol,
      name,
      [{ type: "outside", lo: values.sl, hi: values.tp }],
      SLTP_TAGS,
      null,
      SLTP_SOUND,
    ),
  );
  return "created";
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH HELPERS
//
// Used by the stocks page buttons.
// Run calls concurrently but cap parallelism to avoid hammering the server.
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_CONCURRENCY = 4;

async function runBatch<T>(
  tasks: (() => Promise<T>)[],
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < tasks.length; i += BATCH_CONCURRENCY) {
    const chunk = tasks.slice(i, i + BATCH_CONCURRENCY);
    const chunkResults = await Promise.allSettled(chunk.map((fn) => fn()));
    results.push(...chunkResults);
  }
  return results;
}

export interface BatchSyncResult {
  created: string[];
  skipped: string[];
  deleted: string[];
  failed: string[];
  no_threshold: string[];
}

/**
 * Button A — Sync watchlist watchers in batch.
 *
 * For each watched stock:   ensureLtpWatcher (create if missing)
 * For each unwatched stock: deleteLtpWatcher (delete if exists)
 *
 * Pass ALL stocks from the watchlist endpoint — the function sorts watched/unwatched.
 */
export async function batchSyncWatchlistWatchers(
  stocks: WatchlistEntry[],
  onProgress?: (done: number, total: number) => void,
): Promise<BatchSyncResult> {
  const result: BatchSyncResult = {
    created: [],
    skipped: [],
    deleted: [],
    failed: [],
    no_threshold: [],
  };

  const watched = stocks.filter((s) => s.watch);
  const unwatched = stocks.filter((s) => !s.watch);
  const total = watched.length + unwatched.length;
  let done = 0;

  const watchedTasks = watched.map((s) => async () => {
    const outcome = await ensureLtpWatcher(s.symbol, s.remark);
    done++;
    onProgress?.(done, total);
    return { symbol: s.symbol, outcome };
  });

  const unwatchedTasks = unwatched.map((s) => async () => {
    const outcome = await deleteLtpWatcher(s.symbol);
    done++;
    onProgress?.(done, total);
    return { symbol: s.symbol, outcome };
  });

  const watchedResults = await runBatch(watchedTasks);
  const unwatchedResults = await runBatch(unwatchedTasks);

  for (const r of watchedResults) {
    if (r.status === "rejected") {
      // symbol lost — best effort
      result.failed.push("unknown");
      continue;
    }
    const { symbol, outcome } = r.value;
    if (outcome === "created") result.created.push(symbol);
    else if (outcome === "skipped") result.skipped.push(symbol);
    else if (outcome === "no_threshold") result.no_threshold.push(symbol);
  }

  for (const r of unwatchedResults) {
    if (r.status === "rejected") {
      result.failed.push("unknown");
      continue;
    }
    const { symbol, outcome } = r.value;
    if (outcome === "deleted") result.deleted.push(symbol);
    else if (outcome === "not_found") result.skipped.push(symbol);
  }

  return result;
}

/**
 * Button B — Sync portfolio (SL/TP) watchers in batch.
 *
 * Accepts pairs of [WatchlistEntry, Position] — caller fetches positions fresh.
 * For each position stock: ensureSlTpWatcher (skip if already exists).
 */
export async function batchSyncPortfolioWatchers(
  pairs: { watchlist: WatchlistEntry; position: Position }[],
  onProgress?: (done: number, total: number) => void,
): Promise<BatchSyncResult> {
  const result: BatchSyncResult = {
    created: [],
    skipped: [],
    deleted: [],
    failed: [],
    no_threshold: [],
  };

  const total = pairs.length;
  let done = 0;

  const tasks = pairs.map((p) => async () => {
    const outcome = await ensureSlTpWatcher(
      p.watchlist.symbol,
      p.watchlist.slTp,
      p.position.avgBuy,
    );
    done++;
    onProgress?.(done, total);
    return { symbol: p.watchlist.symbol, outcome };
  });

  const results = await runBatch(tasks);

  for (const r of results) {
    if (r.status === "rejected") {
      result.failed.push("unknown");
      continue;
    }
    const { symbol, outcome } = r.value;
    if (outcome === "created") result.created.push(symbol);
    else if (outcome === "skipped") result.skipped.push(symbol);
    else if (outcome === "no_values") result.no_threshold.push(symbol);
  }

  return result;
}

import { LtpMap, LtpSource } from "../types";
import { systemEvents } from "@shared/events";
import { getSnapshot } from "@shared/cache";
import { logger } from "@shared/logger";

// ─── Cache State ──────────────────────────────────────────────────────────────
let _cache: LtpMap = {};
let _lastFetched: string | null = null;
let _lastSource: LtpSource | null = null;
let _onUpdate: ((map: LtpMap) => void) | null = null;

export function setLtpUpdateHandler(fn: (map: LtpMap) => void): void {
  _onUpdate = fn;
}

// ─── Listen to shared cache events ───────────────────────────────────────────
// No WebSocket needed — nepse-data writes to shared cache, which emits this event
systemEvents.on("nepse:snapshot", () => {
  const snapshot = getSnapshot();
  if (!snapshot) return;

  const incoming: LtpMap = {};
  for (const [symbol, d] of Object.entries(snapshot.stocks)) {
    incoming[symbol] = {
      ltp: d.ltp,
      chgPct: d.percentChange,
      open: d.open,
      high: d.high,
      low: d.low,
      qty: d.volume,
      pointChange: d.pointChange ?? null,
      source: "nepse-ws",
      fetchedAt: new Date().toISOString(),
    };
  }

  _cache = { ..._cache, ...incoming };
  _lastFetched = new Date().toISOString();
  _lastSource = "nepse-ws";
  _onUpdate?.(_cache);

  logger.debug("stocks:ltp", `Updated ${Object.keys(incoming).length} symbols from shared cache`);
});

// ─── CSV Injection ────────────────────────────────────────────────────────────
export function injectCsvLtp(rows: Array<{ symbol: string; ltp: number; chgPct?: number; open?: number; high?: number; low?: number }>): LtpMap {
  const incoming: LtpMap = rows.reduce<LtpMap>((acc, row) => {
    if (!row.symbol || row.ltp <= 0) return acc;
    const prev = _cache[row.symbol];
    acc[row.symbol] = {
      ltp: row.ltp,
      chgPct: row.chgPct ?? prev?.chgPct ?? 0,
      open: row.open ?? prev?.open ?? 0,
      high: row.high ?? prev?.high ?? 0,
      low: row.low ?? prev?.low ?? 0,
      qty: prev?.qty ?? 0,
      pointChange: prev?.pointChange ?? 0,
      source: "csv",
      fetchedAt: new Date().toISOString(),
    };
    return acc;
  }, {});

  _cache = { ..._cache, ...incoming };
  _lastFetched = new Date().toISOString();
  _lastSource = "csv";
  _onUpdate?.(_cache);
  return _cache;
}

// ─── Read Interface ───────────────────────────────────────────────────────────
export function getLtpMap(): LtpMap { return _cache; }

export function getCacheStatus(): { lastFetched: string | null; lastSource: LtpSource | null; symbolCount: number; isStale: boolean } {
  return { lastFetched: _lastFetched, isStale: _lastSource !== "nepse-ws", symbolCount: Object.keys(_cache).length, lastSource: _lastSource };
}

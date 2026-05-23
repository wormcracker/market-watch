/**
 * demo-store.ts
 * All data lives in localStorage. Falls back to seed data on first load.
 */
import type {
  StockEntry, Position, Trade, WatchlistEntry,
  CapitalSummary, SummaryData, Watch, Alert, LtpEntry,
} from "./types";
import {
  SEED_STOCKS, SEED_POSITIONS, SEED_TRADES, SEED_WATCHLIST,
  SEED_CAPITAL, SEED_SUMMARY, SEED_WATCHES, SEED_ALERTS,
} from "./seed";

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

function save<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Keys ────────────────────────────────────────────────────────────────────
const K = {
  stocks:    "mw_demo_stocks",
  positions: "mw_demo_positions",
  trades:    "mw_demo_trades",
  watchlist: "mw_demo_watchlist",
  capital:   "mw_demo_capital",
  summary:   "mw_demo_summary",
  watches:   "mw_demo_watches",
  alerts:    "mw_demo_alerts",
  csvAt:     "mw_demo_csv_at",
} as const;

// ─── Getters ─────────────────────────────────────────────────────────────────
export const db = {
  getStocks():    Record<string, StockEntry> { return load(K.stocks, SEED_STOCKS); },
  getPositions(): Position[]                 { return load(K.positions, SEED_POSITIONS); },
  getTrades():    Trade[]                    { return load(K.trades, SEED_TRADES); },
  getWatchlist(): WatchlistEntry[]           { return load(K.watchlist, SEED_WATCHLIST); },
  getCapital():   CapitalSummary             { return load(K.capital, SEED_CAPITAL); },
  getSummary():   SummaryData                { return load(K.summary, SEED_SUMMARY); },
  getWatches():   Watch[]                    { return load(K.watches, SEED_WATCHES); },
  getAlerts():    Alert[]                    { return load(K.alerts, SEED_ALERTS); },
  getCsvAt():     string | null              { return load(K.csvAt, null); },

  // ─── CSV upload → updates stocks + positions ───────────────────────────────
  ingestCsv(rows: LtpEntry[]) {
    const stocks = this.getStocks();
    for (const r of rows) {
      const sym = r.symbol.toUpperCase().trim();
      if (!sym) continue;
      const prev = stocks[sym] ?? {};
      stocks[sym] = {
        symbol: sym,
        ltp: r.ltp,
        open: r.open ?? (prev as StockEntry).open ?? r.ltp,
        high: r.high ?? (prev as StockEntry).high ?? r.ltp,
        low:  r.low  ?? (prev as StockEntry).low  ?? r.ltp,
        volume: (prev as StockEntry).volume ?? 0,
        pointChange: r.ltp - ((prev as StockEntry).ltp ?? r.ltp),
        percentChange: (prev as StockEntry).ltp
          ? ((r.ltp - (prev as StockEntry).ltp) / (prev as StockEntry).ltp) * 100
          : (r.chgPct ?? 0),
        updatedAt: Date.now(),
      };
    }
    save(K.stocks, stocks);
    save(K.csvAt, new Date().toISOString());

    // Refresh position LTPs
    const positions = this.getPositions().map(p => {
      const s = stocks[p.symbol];
      if (!s) return p;
      const currentVal = s.ltp * p.qty;
      const netPL = currentVal - p.invested;
      const plPct = p.invested > 0 ? (netPL / p.invested) * 100 : 0;
      return { ...p, ltp: s.ltp, chgPct: s.percentChange, currentVal, netPL, plPct };
    });
    save(K.positions, positions);
  },

  markAlertRead(id: string) {
    const alerts = this.getAlerts().map(a => a.id === id ? { ...a, read: true } : a);
    save(K.alerts, alerts);
  },

  markAllAlertsRead() {
    const alerts = this.getAlerts().map(a => ({ ...a, read: true }));
    save(K.alerts, alerts);
  },

  reset() {
    Object.values(K).forEach(k => localStorage.removeItem(k));
  },
};

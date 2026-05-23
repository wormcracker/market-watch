"use client";
import { create } from "zustand";
import type { StockEntry, Position, Trade, WatchlistEntry, CapitalSummary, SummaryData, Watch, Alert } from "@/lib/types";

interface AppStore {
  // Market prices (updated by CSV upload)
  prices: Record<string, StockEntry>;
  csvUploadedAt: string | null;
  setPrices: (p: Record<string, StockEntry>, csvAt: string | null) => void;

  // Cached data
  positions: Position[];
  setPositions: (p: Position[]) => void;

  capital: CapitalSummary | null;
  setCapital: (c: CapitalSummary) => void;

  trades: Trade[];
  setTrades: (t: Trade[]) => void;

  watchlist: WatchlistEntry[];
  setWatchlist: (w: WatchlistEntry[]) => void;

  summary: SummaryData | null;
  setSummary: (s: SummaryData) => void;

  watches: Watch[];
  setWatches: (w: Watch[]) => void;

  alerts: Alert[];
  setAlerts: (a: Alert[]) => void;

  // UI
  unreadAlerts: number;
  refreshAll: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  prices: {},
  csvUploadedAt: null,
  setPrices: (prices, csvUploadedAt) => set({ prices, csvUploadedAt }),

  positions: [],
  setPositions: (positions) => set({ positions }),

  capital: null,
  setCapital: (capital) => set({ capital }),

  trades: [],
  setTrades: (trades) => set({ trades }),

  watchlist: [],
  setWatchlist: (watchlist) => set({ watchlist }),

  summary: null,
  setSummary: (summary) => set({ summary }),

  watches: [],
  setWatches: (watches) => set({ watches }),

  alerts: [],
  setAlerts: (alerts) => set({ alerts }),

  unreadAlerts: 0,

  refreshAll: () => {
    // Re-hydrate from localStorage (called after CSV upload or on mount)
    if (typeof window === "undefined") return;
    const { db } = require("@/lib/demo-store");
    const stocks    = db.getStocks();
    const positions = db.getPositions();
    const trades    = db.getTrades();
    const watchlist = db.getWatchlist();
    const capital   = db.getCapital();
    const summary   = db.getSummary();
    const watches   = db.getWatches();
    const alerts    = db.getAlerts();
    const csvAt     = db.getCsvAt();

    set({
      prices: stocks,
      csvUploadedAt: csvAt,
      positions,
      trades,
      watchlist,
      capital,
      summary,
      watches,
      alerts,
      unreadAlerts: alerts.filter((a: Alert) => !a.read).length,
    });
  },
}));

import { create } from "zustand";
import type {
  StockEntry,
  AlertFiredPayload,
  Position,
  CapitalSummary,
  WatchlistEntry,
  Trade,
  SummaryData,
} from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────
export type WsStatus = "connecting" | "connected" | "disconnected";
export type LiveAlert = AlertFiredPayload & { id: string; read: boolean };

interface AppStore {
  // ── WebSocket / Market ──────────────────────────────────────
  wsStatus: WsStatus;
  prices: Record<string, StockEntry>;
  pricesSource: string;
  pricesUpdatedAt: string | null;
  setWsStatus: (s: WsStatus) => void;
  setPrices: (prices: Record<string, StockEntry>, source: string) => void;

  // ── Live alerts (from WS) ───────────────────────────────────
  liveAlerts: LiveAlert[];
  liveUnreadCount: number;
  addLiveAlert: (payload: AlertFiredPayload) => void;
  markLiveRead: (id: string) => void;
  markAllLiveRead: () => void;
  clearLiveAlerts: () => void;

  // ── Cached REST data ─────────────────────────────────────────
  // Positions (only tradable — qty > 0)
  positions: Position[] | null;
  positionsAt: number;
  setPositions: (positions: Position[]) => void;

  // Capital
  capital: CapitalSummary | null;
  capitalAt: number;
  setCapital: (c: CapitalSummary) => void;

  // Watchlist
  watchlist: WatchlistEntry[] | null;
  watchlistAt: number;
  setWatchlist: (w: WatchlistEntry[]) => void;

  // Trades
  trades: Trade[];
  tradesAt: number;
  setTrades: (trades: Trade[]) => void;

  // Summary all-time
  summaryAll: SummaryData | null;
  setSummaryAll: (s: SummaryData) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  // ── WS ───────────────────────────────────────────────────────
  wsStatus: "connecting",
  prices: {},
  pricesSource: "",
  pricesUpdatedAt: null,
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setPrices: (prices, pricesSource) =>
    set({ prices, pricesSource, pricesUpdatedAt: new Date().toISOString() }),

  // ── Live alerts ──────────────────────────────────────────────
  liveAlerts: [],
  liveUnreadCount: 0,
  addLiveAlert: (payload) =>
    set((s) => ({
      liveAlerts: [
        ...s.liveAlerts,
        { ...payload, id: crypto.randomUUID(), read: false },
      ],
      liveUnreadCount: s.liveUnreadCount + 1,
    })),
  markLiveRead: (id) =>
    set((s) => {
      const target = s.liveAlerts.find((a) => a.id === id);
      return {
        liveAlerts: s.liveAlerts.map((a) =>
          a.id === id ? { ...a, read: true } : a,
        ),
        liveUnreadCount:
          target && !target.read ? s.liveUnreadCount - 1 : s.liveUnreadCount,
      };
    }),
  markAllLiveRead: () =>
    set((s) => ({
      liveAlerts: s.liveAlerts.map((a) => ({ ...a, read: true })),
      liveUnreadCount: 0,
    })),
  clearLiveAlerts: () => set({ liveAlerts: [], liveUnreadCount: 0 }),

  // ── REST cache ───────────────────────────────────────────────
  positions: null,
  positionsAt: 0,
  setPositions: (positions) =>
    set({
      positions: positions.filter((p) => p.qty > 0),
      positionsAt: Date.now(),
    }),

  capital: null,
  capitalAt: 0,
  setCapital: (capital) => set({ capital, capitalAt: Date.now() }),

  watchlist: null,
  watchlistAt: 0,
  setWatchlist: (watchlist) => set({ watchlist, watchlistAt: Date.now() }),

  trades: [],
  tradesAt: 0,
  setTrades: (trades) => set({ trades, tradesAt: Date.now() }),

  summaryAll: null,
  setSummaryAll: (summaryAll) => set({ summaryAll }),
}));

// ─── Backward-compat shims (some files still import old stores) ─
// We export matching hooks so old imports just work
export const useMarketStore = useAppStore;
export const useAlertStore = useAppStore;

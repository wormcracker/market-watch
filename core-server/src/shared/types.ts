export type StockEntry = {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  pointChange: number | null;
  percentChange: number;
  updatedAt: number;
};

export type MarketSnapshot = {
  fetchedAt: number;
  source: DataSource;
  stocks: Record<string, StockEntry>;
};

export type DataSource =
  | "source-a"       // plug in your own live-market API
  | "source-b"       // plug in your own scraping fetcher
  | "csv"            // manual upload from nepalstock.com/today-price
  | "nepse-ws"       // pushed from nepse-data WebSocket
  | "memory_cache"
  | "disk_cache";

// Shared API response envelope
export type ApiResponse<T> =
  | { ok: true; data: T; timestamp: string }
  | { ok: false; error: string; timestamp: string };

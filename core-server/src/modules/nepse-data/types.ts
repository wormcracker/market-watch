export type { StockEntry, MarketSnapshot, DataSource } from "@shared/types";

export interface MarketStatus {
  isOpen: boolean;
  updatedAt: number;
}

export interface ServerStatus {
  isRunning: boolean;
  lastFetchedAt: number | null;
  nextFetchIn: number | null;
  currentSource: import("@shared/types").DataSource | null;
  totalFetches: number;
  uptime: number;
}

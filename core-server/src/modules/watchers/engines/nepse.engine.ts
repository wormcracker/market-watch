import type { FetchResult, Watch } from "../types";
import { getSnapshot } from "@shared/cache";
import { systemEvents } from "@shared/events";
import { logger } from "@shared/logger";

type NepseWatch = Extract<Watch, { engine: "nepse" }>;

// ── Cache update handler ──────────────────────────────────────────────────────
// Called by scheduler when it wants to know about new snapshots
type CacheUpdateHandler = () => void;
let _onCacheUpdate: CacheUpdateHandler | null = null;

export function setNepseCacheUpdateHandler(handler: CacheUpdateHandler): void {
  _onCacheUpdate = handler;
}

// ── Subscribe to shared market events ────────────────────────────────────────
let _engineStarted = false;

export function startNepseEngine(): void {
  if (_engineStarted) return;
  _engineStarted = true;
  // When nepse-data writes to shared cache it emits "nepse:snapshot"
  // We call the scheduler's handler so it can run nepse watches
  systemEvents.on("nepse:snapshot", () => {
    _onCacheUpdate?.();
  });
  logger.info("watchers:nepse-engine", "Started — listening to shared cache events");
}

export function stopNepseEngine(): void {
  _engineStarted = false;
  logger.info("watchers:nepse-engine", "Stopped");
}

export async function fetchWithNepse(watch: NepseWatch): Promise<FetchResult> {
  const snapshot = getSnapshot();
  if (snapshot === null) {
    throw new Error("No market data yet — waiting for first snapshot");
  }
  const stock = snapshot.stocks[watch.symbol.toUpperCase()];
  if (!stock) {
    throw new Error(`Symbol "${watch.symbol}" not found in snapshot`);
  }
  const value = stock[watch.field as keyof typeof stock];
  if (value === undefined || value === null) {
    throw new Error(`Field "${watch.field}" not found on "${watch.symbol}"`);
  }
  return { value: String(value), source: "nepse", fetchedAt: new Date().toISOString() };
}

export function getNepseStatus() {
  const snapshot = getSnapshot();
  return {
    connected: true,
    cacheAge: snapshot ? Date.now() - snapshot.fetchedAt : null,
    symbols: snapshot ? Object.keys(snapshot.stocks).length : 0,
  };
}

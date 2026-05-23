import { systemEvents } from "./events";
import { MarketSnapshot } from "./types";
import fs from "fs";

let _cache: MarketSnapshot | null = null;
let _lastUpdated: Date | null = null;

export function setSnapshot(snapshot: MarketSnapshot): void {
  _cache = snapshot;
  _lastUpdated = new Date();
  systemEvents.emit("nepse:snapshot", {
    data: snapshot.stocks,
    source: snapshot.source,
    fetchedAt: snapshot.fetchedAt,
  });
}

export function getSnapshot(): MarketSnapshot | null {
  return _cache;
}

export function getLtp(symbol: string): number | null {
  if (!_cache) return null;
  const entry = _cache.stocks[symbol];
  return entry ? entry.ltp : null;
}

export function getAllLtps(): Record<string, number> {
  const data = _cache?.stocks ?? {};
  const result: Record<string, number> = {};
  for (const [s, d] of Object.entries(data)) {
    const ltp = d?.ltp;
    if (typeof ltp === "number") {
      result[s] = ltp;
    }
  }
  return result;
}

export function getLastUpdated(): Date | null {
  return _lastUpdated;
}

export function isSnapshotStale(maxAgeSeconds: number): boolean {
  if (_cache === null) return true;
  const ageSeconds = (Date.now() - _cache.fetchedAt) / 1000;
  return ageSeconds > maxAgeSeconds;
}

export function clearMemoryCache(): void {
  _cache = null;
}

export function getCacheStatus(cacheFilePath: string) {
  const memCache = getSnapshot();
  return {
    hasMemoryCache: memCache !== null,
    hasDiskCache: fs.existsSync(cacheFilePath),
    memoryCacheAgeSeconds: memCache
      ? (Date.now() - memCache.fetchedAt) / 1000
      : null,
    isStale: isSnapshotStale(60),
    lastUpdated: _lastUpdated?.toISOString() ?? null,
  };
}

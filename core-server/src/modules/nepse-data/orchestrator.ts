import { DataSource, MarketSnapshot } from "./types";
import { fetchFromSourceA, fetchFromSourceB } from "./fetchers";
import { getSettings } from "./settings";
import { getActiveSubSlot, isInsideMarketWindow } from "./utils/time";
import { getMarketState } from "./market-state";
import {
  getSnapshot,
  setSnapshot,
} from "@shared/cache";
import { readJson, writeJson } from "@shared/fs";
import { CACHE_FILE } from "./constants";
import { logger } from "@shared/logger";

async function trySourceA(): Promise<MarketSnapshot> {
  logger.info("nepse:orchestrator", "Trying source-a...");
  return await fetchFromSourceA();
}
async function trySourceB(): Promise<MarketSnapshot> {
  logger.info("nepse:orchestrator", "Trying source-b...");
  return await fetchFromSourceB();
}
async function tryMemoryCache(): Promise<MarketSnapshot> {
  logger.info("nepse:orchestrator", "Trying memory cache...");
  const snapshot = getSnapshot();
  if (snapshot === null) throw new Error("Memory cache is empty");
  const ageSeconds = (Date.now() - snapshot.fetchedAt) / 1000;
  logger.info("nepse:orchestrator", `Memory cache age: ${ageSeconds.toFixed(1)}s`);
  return { ...snapshot, source: "memory_cache" };
}
async function tryDiskCache(): Promise<MarketSnapshot> {
  logger.info("nepse:orchestrator", "Trying disk cache...");
  const snapshot = readJson<MarketSnapshot>(CACHE_FILE);
  if (snapshot === null) throw new Error("Disk cache is empty or unreadable");
  setSnapshot(snapshot);
  logger.info("nepse:orchestrator", "Disk cache loaded into memory", {
    fetchedAt: snapshot.fetchedAt,
  });
  const ageSeconds = (Date.now() - snapshot.fetchedAt) / 1000;
  logger.info("nepse:orchestrator", `Disk cache age: ${ageSeconds.toFixed(1)}s`);
  return { ...snapshot, source: "disk_cache" };
}

interface OrchestratorResult {
  snapshot: MarketSnapshot;
  source: string;
  attemptedSources: string[];
  errors: string[];
  order: string[];
}

export function getActiveOrder(): DataSource[] {
  const subSlot = getActiveSubSlot();
  if (subSlot) return subSlot.order;
  const settings = getSettings();
  const state = getMarketState();
  const insideWindow = isInsideMarketWindow();
  if (insideWindow && state.isOpen !== false) return settings.fallback_order;
  return settings.fallback_order_after_market;
}

export async function orchestrate(
  allowLiveFetch = false,
): Promise<OrchestratorResult> {
  const attemptedSources: string[] = [];
  const errors: string[] = [];

  // Add your custom fetchers here as you implement them.
  // Key must match the DataSource label in shared/types.ts.
  const handlers: Partial<Record<DataSource, () => Promise<MarketSnapshot>>> = {
    "source-a": trySourceA,
    "source-b": trySourceB,
    memory_cache: tryMemoryCache,
    disk_cache: tryDiskCache,
  };

  const order = getActiveOrder();
  const SOURCE_PRIORITY = allowLiveFetch
    ? order
    : order.filter((s) => s === "memory_cache" || s === "disk_cache");

  for (const source of SOURCE_PRIORITY) {
    const handler = handlers[source];
    if (!handler) {
      errors.push(`${source}: No handler registered`);
      continue;
    }
    attemptedSources.push(source);
    try {
      const existing = readJson<MarketSnapshot>(CACHE_FILE) ?? {};
      const snapshot = await handler();
      const updated = { ...existing, ...snapshot };
      if (source === "source-a" || source === "source-b") {
        setSnapshot(snapshot);
        writeJson(CACHE_FILE, updated);
        logger.info("nepse:orchestrator", "Live data fetched and cached");
      }
      logger.info("nepse:orchestrator", `✅ Succeeded with: ${source}`);
      return { snapshot, source, attemptedSources, errors, order: SOURCE_PRIORITY };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`${source}: ${message}`);
      logger.warn("nepse:orchestrator", `${source} failed: ${message}`);
    }
  }
  throw new Error(
    `All sources exhausted. Tried: ${attemptedSources.join(" → ")} | Errors: ${errors.join(" | ")}`,
  );
}

interface OrchestratorStatus {
  currentOrder: string[];
  marketStatus: boolean | null;
  isInsideMarketWindow: boolean;
}

export function getOrchestratorStatus(): OrchestratorStatus {
  return {
    currentOrder: getActiveOrder(),
    marketStatus: getMarketState().isOpen,
    isInsideMarketWindow: isInsideMarketWindow(),
  };
}

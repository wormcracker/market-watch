import { Express } from "express";
import { loadSettings } from "./settings";
import { startScheduler, stopScheduler } from "./scheduler";
import { logger } from "@shared/logger";
import { readJson } from "@shared/fs";
import { MarketSnapshot } from "@shared/types";
import { setSnapshot } from "@shared/cache";
import { CACHE_FILE } from "./constants";

export function bootstrapNepseData(app: Express): void {
  loadSettings();
  logger.info("nepse-data", "Settings loaded");
  const cached = readJson<MarketSnapshot>(CACHE_FILE);
  if (cached) {
    setSnapshot(cached);
    logger.info("nepse-data", "Memory cache warmed from disk", {
      fetchedAt: new Date(cached.fetchedAt),
      stocks: Object.keys(cached.stocks).length,
    });
  }
}

export function startNepseScheduler(): void {
  startScheduler();
  logger.info("nepse-data", "Scheduler started");
}

export function stopNepseScheduler(): void {
  stopScheduler();
}

export { default as nepseRoutes } from "./routes";

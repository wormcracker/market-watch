import { logger } from "@shared/logger";
// ─── startup.ts ───────────────────────────────────────────────────────────────
import {
  getCapitalAdditions,
  getCapitalRetentions,
  getJournalRows,
  getPromoterLockIn,
  getStocksSheet,
} from "./sheets/reader";

const MAX_RETRIES = 15;
const BASE_DELAY_MS = 2000;

type SourceStatus = {
  success: boolean;
  attempts: number;
  lastError?: string;
};

let preloadState: {
  lastRun: string | null;
  sources: Record<string, SourceStatus>;
} = {
  lastRun: null,
  sources: {},
};

// Returns result on success, null on final failure (never throws)
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxRetries = MAX_RETRIES,
): Promise<{ data: T | null; attempts: number; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      logger.info("stocks:startup", `✓ ${label} loaded (attempt ${attempt})`);

      return { data: result, attempts: attempt };
    } catch (err: any) {
      const isLast = attempt === maxRetries;
      const delay = Math.min(BASE_DELAY_MS * Math.pow(1.5, attempt - 1), 30000);

      if (isLast) {
        console.error(
          `[startup] ✗ ${label} failed after ${maxRetries} attempts`,
        );
        return {
          data: null,
          attempts: attempt,
          error: err?.message ?? "unknown error",
        };
      }

      console.warn(
        `[startup] ⚠ ${label} attempt ${attempt}/${maxRetries} failed — retrying in ${Math.round(delay / 1000)}s`,
      );

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return { data: null, attempts: maxRetries };
}

export async function preloadAll(): Promise<void> {
  logger.info("stocks:startup", "🔄 Pre-loading all data sources...\n");

  const sources = [
    {
      key: "journal",
      name: "Journal_Log",
      task: () => withRetry("Journal_Log", () => getJournalRows(true)),
    },
    {
      key: "stocks",
      name: "Stocks",
      task: () => withRetry("Stocks", () => getStocksSheet(true)),
    },
    {
      key: "capitalAdds",
      name: "Capital adds",
      task: () => withRetry("Capital adds", () => getCapitalAdditions()),
    },
    {
      key: "capitalRetains",
      name: "Capital retains",
      task: () => withRetry("Capital retains", () => getCapitalRetentions()),
    },
    {
      key: "lockIn",
      name: "LockIn",
      task: () => withRetry("LockIn", () => getPromoterLockIn()),
    },
  ];

  const results = await Promise.all(
    sources.map(async (source) => {
      const res = await source.task();
      return { ...source, result: res };
    }),
  );

  preloadState.lastRun = new Date().toISOString();

  for (const r of results) {
    preloadState.sources[r.key] = {
      success: r.result.data !== null,
      attempts: r.result.attempts,
      lastError: r.result.error,
    };

    if (r.result.data !== null) {
      logger.info("stocks:startup", `✅ ${r.name} ready`);
    } else {
      logger.info("stocks:startup", `❌ ${r.name} unavailable`);
    }
  }

  logger.info("stocks:startup", "📦 Preload complete\n");
}

export function getPreloadState() {
  return preloadState;
}

import { systemEvents } from "@shared/events";
import {
  getMarketState,
  refreshMarketState,
  resetMarketState,
} from "../market-state";
import { orchestrate } from "../orchestrator";
import { getSettings } from "../settings";
import { SchedulerSlot } from "../settings/defaults";
import { getActiveSchedulerSlot, isInsideMarketWindow } from "../utils/time";
import { logger } from "@shared/logger";

let _isRunning = false;
let _intervalSeconds = 0;
let _totalRuns = 0;
let _totalFailures = 0;
let _lastRunAt: number | null = null;
let _nextRunAt: number | null = null;
const _timeoutHandles = new Set<ReturnType<typeof setTimeout>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const handle = setTimeout(() => {
      _timeoutHandles.delete(handle);
      resolve();
    }, ms);
    _timeoutHandles.add(handle);
  });
}

function getIntervalSeconds(): number {
  const currentInterval = getActiveSchedulerSlot();
  _intervalSeconds = currentInterval?.interval ?? getSettings().interval;
  return _intervalSeconds;
}

function msUntilNextWindow(): number {
  const allScheduler: SchedulerSlot[] = getSettings().scheduler;
  const now = Date.now();
  let best = Infinity;
  for (const slot of allScheduler) {
    const [h, m] = slot.market_start.split(":").map(Number);
    for (const d of slot.market_days) {
      const date = new Date();
      const diff = (d - date.getDay() + 7) % 7;
      date.setDate(date.getDate() + diff);
      date.setHours(h, m, 0, 0);
      const ts = date.getTime();
      if (ts <= now) date.setDate(date.getDate() + 7);
      best = Math.min(best, date.getTime());
    }
  }
  const ms = best - now;
  _nextRunAt = Date.now() + ms;
  return ms;
}

function shouldFetchNow(): boolean {
  const settings = getSettings();
  if (settings.shutdown) {
    logger.info("nepse:scheduler", "Shutdown mode — serving cache only");
    return false;
  }
  const insideWindow = isInsideMarketWindow();
  if (!insideWindow) {
    return false;
  }
  if (!settings.status_check) {
    return true;
  }
  const { isOpen } = getMarketState();
  if (isOpen === false) {
    logger.info("nepse:scheduler", "Sleep mode - MarketStatus API closed");
  }
  return isOpen !== false;
}

export function restartScheduler(): void {
  logger.info("nepse:scheduler", "Restarting due to settings change");
  stopScheduler();
  setTimeout(() => startScheduler(), 500);
}

systemEvents.on("system:info", (payload) => {
  if (
    payload.module === "nepse:settings" &&
    payload.message === "settings:changed"
  )
    restartScheduler();
});

async function runFetchCycle(): Promise<void> {
  _lastRunAt = Date.now();
  _totalRuns++;
  logger.info("nepse:scheduler", `Run #${_totalRuns}`);
  try {
    const result = await orchestrate(true);
    logger.info(
      "nepse:scheduler",
      `OK (${result.source}) stocks=${Object.keys(result.snapshot.stocks).length}`,
    );
  } catch (err) {
    _totalFailures++;
    logger.error(
      "nepse:scheduler",
      "Fetch cycle failed",
      err instanceof Error ? err.message : err,
    );
  }
}

async function runMarketWindow(): Promise<void> {
  await refreshMarketState();
  while (_isRunning) {
    if (!shouldFetchNow()) {
      logger.info("nepse:scheduler", "Outside window");
      resetMarketState();
      break;
    }
    await runFetchCycle();
    const interval = getIntervalSeconds() * 1000;
    const jitter = Math.floor(Math.random() * 6000);
    await sleep(interval + jitter);
  }
  if (_isRunning) {
    const wait = msUntilNextWindow();
    await sleep(wait);
    runMarketWindow();
  }
}

export function startScheduler(): void {
  if (_isRunning) return;
  _isRunning = true;
  logger.info("nepse:scheduler", "Started");
  if (shouldFetchNow()) {
    runMarketWindow();
  } else {
    const wait = msUntilNextWindow();
    sleep(wait).then(() => runMarketWindow());
  }
}

export function stopScheduler(): void {
  if (!_isRunning) return;
  _isRunning = false;
  for (const handle of _timeoutHandles) clearTimeout(handle);
  _timeoutHandles.clear();
  logger.info("nepse:scheduler", "Stopped");
}

export interface SchedulerStatus {
  isRunning: boolean;
  intervalSeconds: number;
  totalRuns: number;
  totalFailures: number;
  successRate: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export function getSchedulerStatus(): SchedulerStatus {
  const successRate =
    _totalRuns === 0
      ? "N/A"
      : `${(((_totalRuns - _totalFailures) / _totalRuns) * 100).toFixed(1)}%`;
  return {
    isRunning: _isRunning,
    intervalSeconds: _intervalSeconds,
    totalRuns: _totalRuns,
    totalFailures: _totalFailures,
    successRate,
    lastRunAt: _lastRunAt ? new Date(_lastRunAt).toISOString() : null,
    nextRunAt: _nextRunAt ? new Date(_nextRunAt).toISOString() : null,
  };
}

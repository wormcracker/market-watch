// src/scheduler/index.ts

import crypto from "crypto";
import type {
  Alert,
  ConditionResult,
  DaysNumber,
  Watch,
  WatchSchedule,
  ScheduleWindow,
  WindowRange,
} from "../types";

import {
  getWatch,
  loadWatches,
  upsertWatch,
  pushHistory,
  loadSettings,
} from "../store";

import { fetchValue } from "../engines";
import { evaluate } from "../conditions";
import { notify } from "../notifier";

import { logger } from "@shared/logger";
import { systemEvents } from "@shared/events";

// ═══════════════════════════════════════════════════════════════
// SECTION 1: SEMAPHORE
// ═══════════════════════════════════════════════════════════════

class Semaphore {
  private slots: number;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    this.slots = max;
  }

  acquire(): Promise<void> {
    if (this.slots > 0) {
      this.slots--;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();

    if (next) {
      next();
    } else {
      this.slots++;
    }
  }

  getState() {
    return {
      slots: this.slots,
      queued: this.queue.length,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 2: MODULE STATE
// ═══════════════════════════════════════════════════════════════

let _running = false;

let _timers = new Map<string, ReturnType<typeof setTimeout>>();

let _sem: Semaphore = new Semaphore(1);

const _executing = new Set<string>();

// ═══════════════════════════════════════════════════════════════
// SECTION 3: TIME + WINDOW HELPERS
// ═══════════════════════════════════════════════════════════════

const DAY_MS = 86400000;

function currentHMD(): {
  hm: string;
  dow: DaysNumber;
} {
  const now = new Date();

  const hm =
    `${String(now.getHours()).padStart(2, "0")}:` +
    `${String(now.getMinutes()).padStart(2, "0")}`;

  return {
    hm,
    dow: now.getDay() as DaysNumber,
  };
}

function toMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function isInTimeRange(hm: string, range: WindowRange): boolean {
  const [from, to] = range.split("-");

  if (from < to) {
    return hm >= from && hm < to;
  }

  return hm >= from || hm < to;
}

function isInDayRange(dow: DaysNumber, days: DaysNumber[]): boolean {
  return days.includes(dow);
}

function validateDays(days?: DaysNumber[]): boolean {
  if (!days) return true;
  if (days.length === 0) return false;
  return days.every((d) => d >= 0 && d <= 6);
}

function isWindowActive(window: ScheduleWindow): boolean {
  const { hm, dow } = currentHMD();

  if (!isInTimeRange(hm, window.range)) {
    return false;
  }

  if (window.days && !isInDayRange(dow, window.days)) {
    return false;
  }

  return true;
}

export function getActiveWindow(
  schedule: WatchSchedule,
): ScheduleWindow | null {
  if (!schedule.windows?.length) {
    return null;
  }

  return schedule.windows.find(isWindowActive) ?? null;
}

function getCurrentMsOfDay(now = new Date()): number {
  return (
    now.getHours() * 3600000 +
    now.getMinutes() * 60000 +
    now.getSeconds() * 1000 +
    now.getMilliseconds()
  );
}

function normalizeRange(range: WindowRange): {
  startMin: number;
  endMin: number;
} {
  const [from, to] = range.split("-");
  return {
    startMin: toMinutes(from),
    endMin: toMinutes(to),
  };
}

function isWindowValid(window: ScheduleWindow): boolean {
  const { startMin, endMin } = normalizeRange(window.range);
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) return false;
  if (window.days && !validateDays(window.days)) return false;
  return true;
}

function nextWindowStartForWindow(
  window: ScheduleWindow,
  fromDate = new Date(),
): Date | null {
  if (!isWindowValid(window)) return null;

  const now = fromDate;
  const currentDow = now.getDay() as DaysNumber;
  const nowMsOfDay = getCurrentMsOfDay(now);

  const { startMin } = normalizeRange(window.range);
  const startMsOfDay = startMin * 60000;

  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const futureDow = ((currentDow + daysAhead) % 7) as DaysNumber;

    if (window.days && !isInDayRange(futureDow, window.days)) {
      continue;
    }

    if (daysAhead === 0 && startMsOfDay <= nowMsOfDay) {
      continue;
    }

    const d = new Date(now);
    d.setDate(d.getDate() + daysAhead);
    d.setHours(0, 0, 0, 0);
    d.setMilliseconds(startMsOfDay);
    return d;
  }

  return null;
}

function currentWindowEndForWindow(
  window: ScheduleWindow,
  fromDate = new Date(),
): Date | null {
  if (!isWindowValid(window)) return null;

  const now = fromDate;
  const currentDow = now.getDay() as DaysNumber;
  const nowMsOfDay = getCurrentMsOfDay(now);

  const { startMin, endMin } = normalizeRange(window.range);
  const startMs = startMin * 60000;
  const endMs = endMin * 60000;

  const isOvernight = startMin >= endMin;

  if (!isOvernight) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setMilliseconds(startMs);

    const end = new Date(now);
    end.setHours(0, 0, 0, 0);
    end.setMilliseconds(endMs);

    if (nowMsOfDay >= startMs && nowMsOfDay < endMs) return end;
    return null;
  }

  if (nowMsOfDay >= startMs) {
    const end = new Date(now);
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
    end.setMilliseconds(endMs);
    return end;
  }

  const yesterdayDow = ((currentDow + 6) % 7) as DaysNumber;
  if (window.days && !isInDayRange(yesterdayDow, window.days)) {
    return null;
  }

  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setMilliseconds(endMs);
  if (nowMsOfDay < endMs) return end;

  return null;
}

function nextRunForSchedule(schedule: WatchSchedule): Date | null {
  if (!schedule.windows?.length) return null;

  let best: Date | null = null;

  for (const window of schedule.windows) {
    const candidate = nextWindowStartForWindow(window);
    if (!candidate) continue;
    if (!best || candidate.getTime() < best.getTime()) {
      best = candidate;
    }
  }

  return best;
}

function currentWindowEndForSchedule(schedule: WatchSchedule): Date | null {
  if (!schedule.windows?.length) return null;

  const active = getActiveWindow(schedule);
  if (!active) return null;

  return currentWindowEndForWindow(active);
}

export function msUntilNextWindow(schedule: WatchSchedule): number | null {
  const next = nextRunForSchedule(schedule);
  if (!next) return null;
  return Math.max(0, next.getTime() - Date.now());
}

// ═══════════════════════════════════════════════════════════════
// SECTION 4: OVERLAP VALIDATOR
// ═══════════════════════════════════════════════════════════════

export function findOverlappingWindows(
  windows: ScheduleWindow[],
): [number, number][] {
  const overlaps: [number, number][] = [];

  for (let i = 0; i < windows.length; i++) {
    for (let j = i + 1; j < windows.length; j++) {
      const a = windows[i];
      const b = windows[j];

      const timeOverlap = checkTimeOverlap(a.range, b.range);
      const dayOverlap = checkDayOverlap(a.days, b.days);

      if (timeOverlap && dayOverlap) {
        overlaps.push([i, j]);
      }
    }
  }

  return overlaps;
}

function expandRange(range: WindowRange): Array<[number, number]> {
  const [from, to] = range.split("-");

  const start = toMinutes(from);
  const end = toMinutes(to);

  if (start < end) {
    return [[start, end]];
  }

  return [
    [start, 1440],
    [0, end],
  ];
}

function checkTimeOverlap(a: WindowRange, b: WindowRange): boolean {
  const aRanges = expandRange(a);
  const bRanges = expandRange(b);

  for (const [aStart, aEnd] of aRanges) {
    for (const [bStart, bEnd] of bRanges) {
      if (aStart < bEnd && bStart < aEnd) {
        return true;
      }
    }
  }

  return false;
}

function checkDayOverlap(
  a: DaysNumber[] | undefined,
  b: DaysNumber[] | undefined,
): boolean {
  if (!a || !b) {
    return true;
  }

  return a.some((d) => b.includes(d));
}

// ═══════════════════════════════════════════════════════════════
// SECTION 5: COOLDOWN CHECK
// ═══════════════════════════════════════════════════════════════

function isCoolingDown(watch: Watch): boolean {
  const { alertCooldownSec } = loadSettings();

  const effectiveCooldown = watch.cooldownSec ?? alertCooldownSec;

  if (effectiveCooldown === 0) {
    return false;
  }

  if (!watch.lastAlertAt) {
    return false;
  }

  const elapsed = (Date.now() - new Date(watch.lastAlertAt).getTime()) / 1000;

  return elapsed < effectiveCooldown;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 6: ALERT BUILDER
// ═══════════════════════════════════════════════════════════════

function buildAlert(watch: Watch, result: ConditionResult): Alert {
  return {
    id: crypto.randomUUID(),
    watchId: watch.id,
    watchName: watch.name,
    message: result.message ?? "Condition Fired",
    url: watch.url,
    macSound: watch.macSound ?? null,
    customSound: watch.customSound ?? null,
    condition: result.condition,
    currentValue: result.currentValue,
    prevValue: result.prevValue,
    engine: watch.engine,
    firedAt: new Date().toISOString(),
    readAt: null,
  };
}

// ═══════════════════════════════════════════════════════════════
// SECTION 7: EXECUTE ONE WATCH
// ═══════════════════════════════════════════════════════════════

async function executeWatch(watch: Watch): Promise<void> {
  if (_executing.has(watch.id)) {
    logger.info(
      "watchers:scheduler",
      `"${watch.name}" still running — skipping cycle`,
    );
    return;
  }

  _executing.add(watch.id);

  try {
    const result = await fetchValue(watch);

    const results = evaluate(
      watch.conditions,
      result.value,
      watch.lastValue ?? null,
    );

    const fired = results.filter((r) => r.fired);

    if (result.value !== watch.lastValue) {
      for (const r of fired) {
        if (isCoolingDown(watch)) {
          continue;
        }

        await notify(buildAlert(watch, r));
      }
    }

    upsertWatch({
      ...watch,
      lastValue: result.value,
      lastCheckedAt: result.fetchedAt,
      lastAlertAt: fired.length > 0 ? result.fetchedAt : watch.lastAlertAt,
    });

    systemEvents.emit("system:info", {
      module: "watchers:scheduler",
      message: "watch:updated",
    });

    pushHistory(watch.id, {
      value: result.value,
      checkedAt: result.fetchedAt,
      firedAlert: fired.length > 0,
      elapsedMs: Date.now() - new Date(result.fetchedAt).getTime(),
    });
  } catch (err) {
    console.error(`[Scheduler] "${watch.name}" failed:`, err);
  } finally {
    _executing.delete(watch.id);
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 8: WATCH LOOP
// ═══════════════════════════════════════════════════════════════

async function runWatchLoop(watchId: string): Promise<void> {
  if (!_running) {
    return;
  }

  const watch = getWatch(watchId);

  if (!watch) {
    return;
  }

  const mode = watch.scheduleMode ?? "auto";

  if (!watch.enabled) {
    return;
  }

  if (mode === "disabled") {
    return;
  }

  if (!watch.schedule) {
    if (watch.engine !== "nepse") {
      logger.warn(
        "watchers:scheduler",
        `"${watch.name}" has no schedule — stopping loop`,
      );
    }
    return;
  }

  const hasWindows = !!watch.schedule.windows?.length;
  const activeWindow = getActiveWindow(watch.schedule);

  if (mode === "auto" && hasWindows && activeWindow === null) {
    const waitMs = msUntilNextWindow(watch.schedule) ?? 60000;

    logger.info(
      "watchers:scheduler",
      `"${watch.name}" sleeping ${Math.round(waitMs / 60000)}min until next window`,
    );

    _timers.set(
      watchId,
      setTimeout(() => runWatchLoop(watchId), waitMs),
    );

    return;
  }

  const intervalMs =
    (activeWindow?.intervalSec ??
      watch.schedule.defaultIntervalSec ??
      loadSettings().defaultIntervalSec ??
      60) * 1000;

  if (watch.engine === "nepse") {
    await executeWatch(watch);
  } else {
    await _sem.acquire();

    try {
      await executeWatch(watch);
    } finally {
      _sem.release();
    }
  }

  _timers.set(
    watchId,
    setTimeout(() => runWatchLoop(watchId), Math.max(intervalMs, 1000)),
  );
}

function initNepseWatcher(): void {
  const { setNepseCacheUpdateHandler } = require("../engines/nepse.engine");

  setNepseCacheUpdateHandler(() => {
    const nepseWatches = loadWatches().filter(
      (w) => w.enabled && w.engine === "nepse",
    );

    for (const watch of nepseWatches) {
      executeWatch(watch).catch((err) =>
        logger.error(
          "watchers:scheduler",
          `Nepse watch "${watch.name}" failed`,
          err,
        ),
      );
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// SECTION 9: STATUS HELPERS
// ═══════════════════════════════════════════════════════════════

function describeWatch(watch: Watch) {
  const schedule = watch.schedule ?? null;
  const activeWindow = schedule ? getActiveWindow(schedule) : null;
  const nextRun = schedule ? nextRunForSchedule(schedule) : null;
  const nextWindowInMs = schedule ? msUntilNextWindow(schedule) : null;
  const currentWindowEndsAt = schedule
    ? currentWindowEndForSchedule(schedule)
    : null;
  const effectiveIntervalSec =
    activeWindow?.intervalSec ??
    schedule?.defaultIntervalSec ??
    loadSettings().defaultIntervalSec ??
    60;

  const mode = watch.scheduleMode ?? "auto";
  const state = !watch.enabled
    ? "disabled"
    : mode === "disabled"
      ? "disabled"
      : !schedule
        ? "no-schedule"
        : activeWindow
          ? "active"
          : "waiting";

  return {
    id: watch.id,
    name: watch.name,
    enabled: watch.enabled,
    engine: watch.engine,
    mode,
    state,
    scheduleMode: watch.scheduleMode ?? "auto",

    hasSchedule: !!schedule,
    hasWindows: !!schedule?.windows?.length,
    scheduleWindowCount: schedule?.windows?.length ?? 0,

    activeWindow: activeWindow
      ? {
          range: activeWindow.range,
          days: activeWindow.days ?? null,
          intervalSec: activeWindow.intervalSec ?? null,
        }
      : null,

    effectiveIntervalSec,
    intervalMs: effectiveIntervalSec * 1000,

    timerScheduled: _timers.has(watch.id),
    currentlyExecuting: _executing.has(watch.id),

    lastValue: watch.lastValue ?? null,
    lastCheckedAt: watch.lastCheckedAt ?? null,
    lastAlertAt: watch.lastAlertAt ?? null,

    coolingDown: isCoolingDown(watch),

    nextRunAt: nextRun ? nextRun.toISOString() : null,
    nextRunInMs: nextWindowInMs,
    nextRunInSec:
      nextWindowInMs != null ? Math.ceil(nextWindowInMs / 1000) : null,

    currentWindowEndsAt: currentWindowEndsAt
      ? currentWindowEndsAt.toISOString()
      : null,
    currentWindowEndsInMs: currentWindowEndsAt
      ? Math.max(0, currentWindowEndsAt.getTime() - Date.now())
      : null,

    queuedHistoryCount: 0,
    url: watch.url,
  };
}

function logSchedulerSnapshot(): void {
  const watches = loadWatches();
  const active = watches.filter((w) => w.enabled);
  const disabled = watches.filter((w) => !w.enabled);

  logger.info(
    "watchers:scheduler",
    `Snapshot — active=${active.length}, disabled=${disabled.length}`,
  );

  for (const w of active) {
    const s = describeWatch(w);
    logger.info(
      "watchers:scheduler",
      `ACTIVE ${s.name} | engine=${s.engine} | interval=${s.effectiveIntervalSec}s | nextRun=${s.nextRunAt ?? "n/a"} | state=${s.state}`,
    );
  }

  for (const w of disabled) {
    const s = describeWatch(w);
    logger.info(
      "watchers:scheduler",
      `DISABLED ${s.name} | engine=${s.engine} | interval=${s.effectiveIntervalSec}s | state=${s.state}`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 10: PUBLIC API
// ═══════════════════════════════════════════════════════════════

export function startScheduler(): void {
  if (_running) {
    return;
  }

  _running = true;

  _sem = new Semaphore(loadSettings().maxConcurrent);

  initNepseWatcher();

  const watches = loadWatches().filter((w) => w.enabled);

  let httpIndex = 0;

  for (const watch of watches) {
    if (watch.engine === "nepse") {
      continue;
    }

    setTimeout(() => runWatchLoop(watch.id), httpIndex * 500);

    httpIndex++;
  }

  logger.info("watchers:scheduler", `Started — ${watches.length} watches`);

  logSchedulerSnapshot();
}

export function stopScheduler(): void {
  _running = false;

  for (const timer of _timers.values()) {
    clearTimeout(timer);
  }

  _timers.clear();

  logger.info("watchers:scheduler", `Stopped`);
}

export function restartScheduler(): void {
  stopScheduler();

  setTimeout(startScheduler, 200);
}

export async function triggerWatch(watchId: string): Promise<void> {
  const watch = getWatch(watchId);

  if (!watch) {
    throw new Error(`Watch "${watchId}" not found`);
  }

  if (watch.engine === "nepse") {
    await executeWatch(watch);
  } else {
    await _sem.acquire();

    try {
      await executeWatch(watch);
    } finally {
      _sem.release();
    }
  }
}

export function scheduleWatch(watchId: string): void {
  if (!_running) {
    return;
  }

  if (_timers.has(watchId)) {
    return;
  }

  const watch = getWatch(watchId);

  if (!watch) {
    return;
  }

  if (watch.engine === "nepse") {
    return;
  }

  runWatchLoop(watchId);
}

export function unscheduleWatch(watchId: string): void {
  const timer = _timers.get(watchId);

  if (timer) {
    clearTimeout(timer);
  }

  _timers.delete(watchId);
}

export function getSchedulerStatus() {
  const watches = loadWatches();
  const now = Date.now();

  const active = watches
    .filter((w) => w.enabled)
    .map((w) => {
      const schedule = w.schedule ?? null;
      const activeWindow = schedule ? getActiveWindow(schedule) : null;

      const intervalSec =
        activeWindow?.intervalSec ??
        schedule?.defaultIntervalSec ??
        loadSettings().defaultIntervalSec ??
        60;

      const nextRunAtDate = schedule ? nextRunForSchedule(schedule) : null;
      const nextRunAt = nextRunAtDate ? nextRunAtDate.toISOString() : null;
      const nextRunInSec =
        nextRunAtDate != null
          ? Math.ceil((nextRunAtDate.getTime() - now) / 1000)
          : null;

      const lastCheckedAtMs = w.lastCheckedAt
        ? new Date(w.lastCheckedAt).getTime()
        : null;

      const insideActiveWindow = activeWindow != null;

      const nextRunIntervalDate =
        insideActiveWindow && lastCheckedAtMs != null
          ? new Date(lastCheckedAtMs + intervalSec * 1000)
          : null;

      const nextRunInterval = nextRunIntervalDate
        ? nextRunIntervalDate.toISOString()
        : null;

      const nextRunIntervalSec =
        nextRunIntervalDate != null
          ? Math.ceil((nextRunIntervalDate.getTime() - now) / 1000)
          : null;

      return {
        id: w.id,
        name: w.name,
        enabled: w.enabled,
        engine: w.engine,
        state: !w.enabled
          ? "disabled"
          : !schedule
            ? "no-schedule"
            : insideActiveWindow
              ? "active"
              : "waiting",

        intervalSec,

        activeWindow: activeWindow
          ? {
              range: activeWindow.range,
              days: activeWindow.days ?? null,
              intervalSec: activeWindow.intervalSec ?? null,
            }
          : null,

        nextRunAt,
        nextRunInSec,

        nextRunInterval,
        nextRunIntervalSec,

        lastCheckedAt: w.lastCheckedAt ?? null,
        executing: _executing.has(w.id),
        scheduled: _timers.has(w.id),
        overdueByMs:
          nextRunAtDate && nextRunAtDate.getTime() < now
            ? now - nextRunAtDate.getTime()
            : 0,
      };
    });

  const disabled = watches
    .filter((w) => !w.enabled)
    .map((w) => ({
      id: w.id,
      name: w.name,
      enabled: w.enabled,
      engine: w.engine,
      state: "disabled",
    }));

  return {
    running: _running,
    total: watches.length,
    active: {
      count: active.length,
      watches: active,
    },
    disabled: {
      count: disabled.length,
      watches: disabled,
    },
    concurrency: _sem.getState(),
  };
}

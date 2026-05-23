// src/types.ts

// ── Condition System ──────────────────────────────────────────────────────────

export type ConditionType =
  | "any_change"
  | "above"
  | "below"
  | "above_equal"
  | "below_equal"
  | "between"
  | "outside"
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "increases"
  | "decreases"
  | "count_above"
  | "count_below"
  | "change_pct"
  | "change_abs";

type BaseCondition = { message?: string };

type ConditionMap = {
  any_change: {};
  above: { threshold: number };
  below: { threshold: number };
  above_equal: { threshold: number };
  below_equal: { threshold: number };
  equals: { threshold: number | string };
  not_equals: { threshold: number | string };
  between: { lo: number; hi: number };
  outside: { lo: number; hi: number };
  contains: { threshold: string };
  not_contains: { threshold: string };
  increases: {};
  decreases: {};
  count_above: { threshold: number };
  count_below: { threshold: number };
  change_pct: { threshold: number; direction?: "up" | "down" | "any" };
  change_abs: { threshold: number; direction?: "up" | "down" | "any" };
};

export type Condition = {
  [K in keyof ConditionMap]: { type: K } & ConditionMap[K] & BaseCondition;
}[keyof ConditionMap];

export type ConditionResult = {
  condition: Condition;
  fired: boolean;
  currentValue: string;
  prevValue: string | null;
  message: string | null;
};

// ── Fetch Engines ─────────────────────────────────────────────────────────────

type FetchConfigMap = {
  http: {
    url: string;
    selector: string;
    index?: number;
    attribute?: string;
    jsonPath?: string;
  };
  puppeteer: {
    url: string;
    selector: string;
    index?: number;
    attribute?: string;
    waitFor?: string;
  };
  nepse: {
    symbol: string;
    url?: string;
    field: "ltp" | "percentChange" | "volume" | "high" | "low" | "open";
  };
};

export type Engine = keyof FetchConfigMap;

export type FetchConfig = {
  [K in keyof FetchConfigMap]: { engine: K } & FetchConfigMap[K];
}[keyof FetchConfigMap];

export type FetchResult = {
  value: string;
  source: Engine; // "http" | "puppeteer" | "nepse"
  fetchedAt: string; // ISO timestamp
};

// ── Schedule ──────────────────────────────────────────────────────────────────

export type DaysNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type Time = `${number}:${number}`;
export type WindowRange = `${Time}-${Time}`;

export type ScheduleWindow = {
  range: WindowRange;
  intervalSec: number;
  days: [DaysNumber, DaysNumber];
};

export type WatchSchedule = {
  defaultIntervalSec: number;
  windows?: ScheduleWindow[];
};

// ── Watch ─────────────────────────────────────────────────────────────────────

export type WatchIdentity = {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: string;
};

export type Watch = WatchIdentity &
  FetchConfig & {
    schedule?: WatchSchedule;
    conditions: Condition[];
    tags?: string[];
    customSound?: string | null;
    macSound?: string | null;
    cooldownSec?: number;
    lastValue?: string | null;
    lastCheckedAt?: string | null;
    lastAlertAt?: string | null;
    scheduleMode?: "auto" | "enabled" | "disabled";
  };

// ── Alerts ────────────────────────────────────────────────────────────────────

export type Alert = {
  id: string;
  watchId: string;
  watchName: string;
  condition: Condition;
  url?: string;
  currentValue: string;
  prevValue: string | null;
  message: string;
  firedAt: string;
  readAt: string | null;
  customSound: string | null;
  macSound: string | null;
  engine: Engine;
};

// ── History ────────────────────────────────────────────────────────────────────

export type HistoryEntry = {
  value: string;
  checkedAt: string;
  firedAlert: boolean;
  elapsedMs: number;
};

export type History = Record<string, HistoryEntry[]>;

// ── Settings ────────────────────────────────────────────────────────────────────
export type Settings = {
  defaultIntervalSec: number;
  jitterFraction: number;
  maxConcurrent: number;
  perDomainDelayMs: number;
  requestTimeoutSec: number;
  alertCooldownSec: number;

  maxAlerts: number;
  maxHistory: number;

  notifPersists: boolean;

  macBackend: "osascript" | "node-notifier";

  truncate: boolean;
  truncateLen: number;

  osTemplate: string | null;
  notifTemplate: string | null;

  osNotifications: boolean;

  playSound: boolean;
  macSound: string;
  macVolumeLevel: number;
  customSound: string | null;
  customVolumeLevel: number;

  enabledChannels: {
    webhook: boolean;
    ntfy: boolean;
    discord: boolean;
    slack: boolean;
    telegram: boolean;
  };

  notifications: {
    webhook: string | null;
    discord: string | null;
    slack: string | null;
    ntfy: string | null;
    telegram: {
      token: string;
      chatId: string;
    } | null;
  };
};

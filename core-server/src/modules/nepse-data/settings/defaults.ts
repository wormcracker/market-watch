import { DataSource } from "@shared/types";

export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TimeString = `${number}:${number}`;

export interface SchedulerSlot {
  market_start: TimeString;
  market_end: TimeString;
  market_days: WeekDay[];
  interval: number;
}

export interface SchedulerSubSlot {
  start: TimeString;
  end: TimeString;
  interval: number;
  order: DataSource[];
}

export interface NepseDataSetting {
  interval: number;
  shutdown: boolean;

  fallback_order: DataSource[];
  fallback_order_after_market: DataSource[];

  retry_count: number;
  retry_delay_ms: number;
  timeout_per_req_ms: number;

  status_check: boolean;
  status_recheck_interval_min: number;

  cache_ttl: number;

  scheduler: SchedulerSlot[];
  scheduler_sub_slots: SchedulerSubSlot[];
}

export interface NepseDataConfig {
  "nepse-data-setting": NepseDataSetting;
}

export const DEFAULT_SETTINGS: NepseDataSetting = {
  interval: 30,
  shutdown: false,

  // "source-a" and "source-b" are placeholder labels.
  // Update these once you wire up your own fetcher(s).
  // "memory_cache" and "disk_cache" are built-in and always available.
  fallback_order: ["memory_cache", "disk_cache"],
  fallback_order_after_market: ["memory_cache", "disk_cache"],

  retry_count: 3,
  retry_delay_ms: 1000,
  timeout_per_req_ms: 8000,

  // Set to false to rely on time-window detection only (no external status call)
  status_check: false,
  status_recheck_interval_min: 10,

  cache_ttl: 180,

  scheduler: [
    {
      market_start: "11:00",
      market_end: "15:00",
      market_days: [0, 1, 2, 3, 4], // Sun–Thu (NEPSE trading days)
      interval: 30,
    },
  ],

  scheduler_sub_slots: [],
};

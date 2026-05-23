// ─── REST Envelope ────────────────────────────────────────────
export type ApiResponse<T> =
  | { ok: true; data: T; timestamp: string }
  | { ok: false; error: string; timestamp: string };

// ─── WebSocket Messages ───────────────────────────────────────
export type WsMessage =
  | { type: "connected"; payload: ConnectedPayload; timestamp: string }
  | { type: "market_update"; payload: MarketUpdatePayload; timestamp: string }
  | { type: "alert_fired"; payload: AlertFiredPayload; timestamp: string }
  | { type: "pong"; payload: null; timestamp: string };

// ─── Payloads ─────────────────────────────────────────────────
export interface ConnectedPayload {
  message: string;
  data: Record<string, StockEntry>;
  source: string;
}

export interface MarketUpdatePayload {
  source: string;
  data: Record<string, StockEntry>;
}

export interface AlertFiredPayload {
  watchId: string;
  watchName: string;
  message: string;
  value: string | number;
  firedAt: string;
}

// ─── NEPSE ────────────────────────────────────────────────────
export interface StockEntry {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  pointChange: number;
  percentChange: number;
  updatedAt: number;
}

export interface NepseStatus {
  isOpen: boolean;
  orchestrator: {
    marketStatus: boolean | null;
    [key: string]: unknown;
  };
}

// ─── Portfolio ────────────────────────────────────────────────
export interface Position {
  symbol: string;
  qty: number;
  avgBuy: number;
  invested: number;
  ltp: number;
  chgPct: number;
  high: number;
  low: number;
  currentVal: number;
  netPL: number;
  plPct: number;
  source: string;
  fetchedAt: string;
}

// ─── Watchers ─────────────────────────────────────────────────
export type WatchEngine = "http" | "puppeteer" | "nepse";
export type ScheduleMode = "auto" | "enabled" | "disabled";

export interface Condition {
  type: string;
  [key: string]: unknown;
}

// ScheduleWindow defined below

export interface Watch {
  id: string;
  name: string;
  enabled: boolean;
  engine: WatchEngine;
  conditions: Condition[];
  schedule?: WatchSchedule;
  scheduleMode?: ScheduleMode;
  tags?: string[];
  cooldownSec?: number;
  lastValue?: string | null;
  lastCheckedAt?: string | null;
  lastAlertAt?: string | null;
  createdAt: string;
  macSound: string | null;
  customSound: string | null;
}

export interface WatchResponse {
  ok: boolean;
  data?: Watch[];
  fetchedAt: string;
}

// ─── Summary ──────────────────────────────────────────────────
export interface SummaryData {
  filter: string;
  buyCount: number;
  buyQty: number;
  buyTurnover: number;
  sellCount: number;
  sellQty: number;
  sellTurnover: number;
  profit: number;
  plPct: number;
  commissionPaid: number;
  cgtPaid: number;
  leftAmt: number;
  allTimeProfit: number;
  allTimePLPct: number;
  allTimeLeftover: number;
  avgHoldDays: number;
  caagr: number;
  firstTradeDate: string;
  lastTradeDate: string;
}

// ─── Capital ──────────────────────────────────────────────────
export interface CapitalEntry {
  date: string;
  amount: number;
  notes: string;
}

export interface CapitalSummary {
  totalCapitalAdded: number;
  totalRetained: number;
  deployedCapital: number;
  realizedPL: number;
  actualCapital: number;
  tradingCapital: number;
  reservedCapital: number;
  maxPerStock: number;
  availableCapital: number;
  additions: CapitalEntry[];
  retentions: CapitalEntry[];
}

// ─── Watchlist ─────────────────────────────────────────────────
export interface WatchlistEntry {
  rowIndex: number;
  num: number;
  symbol: string;
  cap: string;
  watch: boolean;
  remark: string;
  targetCap: number;
  slTp: string;
  message: string;
  ltp: number;
  chgPct: number;
  high: number;
  low: number;
  lockInDate: string;
  unlockIn: string;
  isLocked: boolean;
  daysRemaining: number;
  inPortfolio: boolean;
  heldQty: number;
}

// ─── Trades ────────────────────────────────────────────────────
export interface Trade {
  tradeId: string;
  date: string;
  dateStr: string;
  symbol: string;
  type: "buy" | "sell";
  qty: number;
  buyWacc: number;
  totalBuy: number;
  sellPrice: number;
  totalSell: number;
  holdingDays: number;
  commission: number;
  profitTax: number;
  netPl: number;
  plPct: number;
  remarks: string;
}

export interface TradesResponse {
  trades: Trade[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Single Stock (nepse) ──────────────────────────────────────
export interface SingleStockResponse {
  stock: StockEntry;
  fetchedAt: number;
  source: string;
}

export interface TradePreviewResponse {
  preview: (string | number)[];
  currentState: { qty: number; cost: number; avg: number };
}

export interface SellPreview {
  qty: number;
  buyWacc: number;
  totalBuy: number;
  sellPrice: number;
  totalSell: number;
  holdingDays: number;
  commission: number;
  cgt: number;
  netPl: number;
  plPct: number;
}

export interface BuyPreview {
  qty: number;
  newWacc: number;
  totalCost: number;
  commission: number;
  currentState: { qty: number; cost: number; avg: number };
}

export interface ParsedRemark {
  entryPrices: number[];
  alertPrice: number;
  ratings: [number, number, number, number];
  score: number;
  scoreLabel: "Low" | "Medium" | "Strong";
}

export interface ParsedSlTp {
  sl: number;
  tp: number;
}

export type WatcherCondition =
  | { type: "any_change" }
  | { type: "above"; value: number }
  | { type: "below"; value: number }
  | { type: "above_equal"; value: number }
  | { type: "below_equal"; value: number }
  | { type: "equals"; value: number | string }
  | { type: "not_equals"; value: number | string }
  | { type: "between"; min: number; max: number }
  | { type: "outside"; min: number; max: number }
  | { type: "contains"; value: string }
  | { type: "not_contains"; value: string }
  | { type: "increases" }
  | { type: "decreases" }
  | { type: "count_above"; value: number }
  | { type: "count_below"; value: number }
  | { type: "change_pct"; value: number; direction?: "up" | "down" | "any" }
  | { type: "change_abs"; value: number; direction?: "up" | "down" | "any" };

// ─── Alert (from REST) ─────────────────────────────────────────
export interface Alert {
  id: string;
  watchId: string;
  watchName: string;
  engine?: string;
  condition: WatcherCondition | string;
  message?: string;
  currentValue?: string | number | null;
  previousValue?: string | number | null;
  firedAt: string;
  readAt: string | null;
  url?: string;
}

// ─── History Entry ─────────────────────────────────────────────
export interface HistoryEntry {
  checkedAt: string;
  value: string;
  firedAlert: boolean;
  elapsedMs?: number;
  error?: string;
}

// ─── Schedule types ────────────────────────────────────────────
export type DaysNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type TimeStr = `${number}:${number}`;
export type WindowRange = `${TimeStr}-${TimeStr}`;

export interface ScheduleWindow {
  range: WindowRange;
  intervalSec: number;
  days: [DaysNumber, DaysNumber];
}

export interface WatchSchedule {
  defaultIntervalSec: number;
  windows?: ScheduleWindow[];
}

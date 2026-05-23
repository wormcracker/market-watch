import { logger } from "@shared/logger";
import { loadConfig } from "../config";
import {
  CapitalEntry,
  LockInMap,
  StockRow,
  TradeRow,
  TradeType,
} from "../types";
import { readRange } from "./client";

let _journal: TradeRow[] | null = null;
let _stocks: StockRow[] | null = null;

function sid(): string {
  return loadConfig().spreadsheetId;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  let str = String(v).trim();
  // Detect accounting negative: (123), ($1,234.50), etc.
  const isNegative = /^\(.*\)$/.test(str);
  // Remove parentheses first
  str = str.replace(/[()]/g, "");
  // Keep digits, decimal, minus
  str = str.replace(/[^0-9.-]/g, "");
  let n = Number(str);
  if (isNaN(n)) return 0;
  if (isNegative) n = -Math.abs(n);
  return n;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [m, d, y] = s.split("/").map(Number);
    return new Date(y, m - 1, d);
  }

  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

function buildUnlockIn(daysRemaining: number): string {
  const abs = Math.abs(daysRemaining);

  const txt =
    abs > 365
      ? `${Math.floor(abs / 365)}y ${Math.floor((abs % 365) / 30)}m`
      : abs > 30
        ? `${Math.floor(abs / 30)}m`
        : `${abs}d`;

  return daysRemaining > 0 ? `in ${txt}` : `${txt} ago`;
}

export function invalidateJournal(): void {
  _journal = null;
}

export function invalidateStocks(): void {
  _stocks = null;
}

/* ---------------- JOURNAL ---------------- */

export async function getJournalRows(
  forceRefresh = false,
): Promise<TradeRow[]> {
  try {
    if (_journal && !forceRefresh) return _journal;

    const res = await readRange(sid(), "Journal_Log!A:O");
    if (!res || res.length === 0) return [];

    const [, ...rows] = res;

    const trades: TradeRow[] = rows
      .map((row) => {
        const c = (i: number) => row[i] ?? "";

        return {
          tradeId: String(c(0)),
          date: toDate(c(1)),
          dateStr: String(c(1)),
          symbol: String(c(2)),
          type: c(3) as TradeType,
          qty: toNum(c(4)),
          buyWacc: toNum(c(5)),
          totalBuy: toNum(c(6)),
          sellPrice: toNum(c(7)),
          totalSell: toNum(c(8)),
          holdingDays: toNum(c(9)),
          commission: toNum(c(10)),
          profitTax: toNum(c(11)),
          netPl: toNum(c(12)),
          plPct: toNum(c(13)),
          remarks: String(c(14)),
        };
      })
      .filter((r) => r.symbol && r.type && r.date);

    _journal = trades;
    return _journal;
  } catch (error) {
    logger.error("stocks:reader", "[Client JournalRows]", error);
    return [];
  }
}

/* ---------------- STOCKS ---------------- */

export async function getStocksSheet(
  forceRefresh = false,
): Promise<StockRow[]> {
  try {
    if (_stocks && !forceRefresh) return _stocks;

    const res = await readRange(sid(), "Stocks!A:H");
    if (!res || res.length === 0) return [];

    const [, , ...rows] = res;

    const stocks: StockRow[] = rows.map((row, i) => {
      const c = (j: number) => row[j] ?? "";

      return {
        rowIndex: i + 3,
        num: toNum(c(0)),
        symbol: String(c(1)),
        cap: String(c(2)),
        watch: String(c(3)).toLowerCase() === "true",
        remark: String(c(4)),
        targetCap: toNum(c(5)),
        slTp: String(c(6)),
        message: String(c(7)),
      };
    });

    _stocks = stocks;
    return _stocks;
  } catch (error) {
    logger.error("stocks:reader", "[Client StocksSheet]", error);
    return [];
  }
}

/* ---------------- CAPITAL ---------------- */

export async function getCapitalAdditions(): Promise<CapitalEntry[]> {
  try {
    const res = await readRange(sid(), "Capital Summary!B7:D");
    if (!res || res.length === 0) return [];

    const [, ...rows] = res;

    return rows
      .map((row) => ({
        date: String(row[0] ?? ""),
        amount: toNum(row[1]),
        notes: String(row[2] ?? ""),
      }))
      .filter((e) => e.date && e.amount > 0);
  } catch (error) {
    logger.error("stocks:reader", "[Client Capital Summary]", error);
    return [];
  }
}

export async function getCapitalRetentions(): Promise<CapitalEntry[]> {
  try {
    const res = await readRange(sid(), "Capital Retained!B:D");
    if (!res || res.length === 0) return [];

    const [, ...rows] = res;

    return rows
      .map((row) => ({
        date: String(row[0] ?? ""),
        amount: toNum(row[1]),
        notes: String(row[2] ?? ""),
      }))
      .filter((e) => e.date && e.amount > 0);
  } catch (error) {
    logger.error("stocks:reader", "[Client Capital Retention]", error);
    return [];
  }
}

/* ---------------- PROMOTER LOCK-IN ---------------- */

export async function getPromoterLockIn(): Promise<LockInMap> {
  try {
    const res = await readRange(sid(), "Promoter-LockIn!B:C");
    if (!res || res.length === 0) return {};

    const [, ...rows] = res;

    const map: LockInMap = {};
    const now = new Date();

    for (const row of rows) {
      const symbol = String(row[0] ?? "")
        .trim()
        .toUpperCase();
      if (!symbol) continue;

      const lockInDate = toDate(row[1]);
      if (!lockInDate) continue;

      const diffMs = lockInDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      map[symbol] = {
        lockInDate: lockInDate.toISOString().slice(0, 10),
        daysRemaining,
        isLocked: daysRemaining > 0,
        unlockIn: buildUnlockIn(daysRemaining),
      };
    }

    return map;
  } catch (error) {
    logger.error("stocks:reader", "[Client PromoterLockIn]", error);
    return {};
  }
}

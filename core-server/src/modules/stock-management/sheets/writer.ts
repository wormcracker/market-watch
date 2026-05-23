import { logger } from "@shared/logger";
import { loadConfig } from "../config";
import { appendRows, deleteRow, readRange, writeRange } from "./client";
import { invalidateJournal, invalidateStocks } from "./reader";

function sid(): string {
  return loadConfig().spreadsheetId;
}

export async function appendTrade(row: unknown[]): Promise<void> {
  try {
    await appendRows(sid(), "Journal_Log!A:O", [row]);
    invalidateJournal();
  } catch (err) {
    logger.error("stocks:writer", "[appendTrade] failed:", err);
    throw err;
  }
}

export async function updateTradeRow(
  rowNum: number,
  row: unknown[],
): Promise<void> {
  try {
    await writeRange(sid(), `Journal_Log!A${rowNum}:O${rowNum}`, [row]);
    invalidateJournal();
  } catch (err) {
    logger.error("stocks:writer", "[updateTradeRow] failed:", err);
    throw err;
  }
}

export async function deleteTradeRow(rowNum: number): Promise<void> {
  try {
    await deleteRow("Journal_Log", sid(), rowNum);
    invalidateJournal();
  } catch (err) {
    logger.error("stocks:writer", "[deleteTradeRow] failed:", err);
    throw err;
  }
}

export async function findTradeRowById(
  tradeId: string,
): Promise<number | null> {
  try {
    const res = await readRange(sid(), "Journal_Log!A:A");
    if (!res || res.length === 0) return null;
    for (let i = 1; i < res.length; i++) {
      if (String(res[i][0]) === tradeId) {
        return i + 1;
      }
    }
    return null;
  } catch (err) {
    logger.error("stocks:writer", "[findTradeRowById] failed:", err);
    throw err;
  }
}

export async function setWatchFlag(
  rowNum: number,
  value: boolean,
): Promise<void> {
  try {
    await writeRange(sid(), `Stocks!D${rowNum}`, [[value]]);
    invalidateStocks();
  } catch (err) {
    logger.error("stocks:writer", "[setWatchFlag] failed:", err);
    throw err;
  }
}

export async function setStockRemark(
  rowNum: number,
  value: string,
): Promise<void> {
  try {
    await writeRange(sid(), `Stocks!E${rowNum}`, [[value]]);
    invalidateStocks();
  } catch (err) {
    logger.error("stocks:writer", "[setStockRemark] failed:", err);
    throw err;
  }
}

export async function setStockTargetCap(
  rowNum: number,
  value: number,
): Promise<void> {
  try {
    await writeRange(sid(), `Stocks!F${rowNum}`, [[value]]);
    invalidateStocks();
  } catch (err) {
    logger.error("stocks:writer", "[setStockTargetCap] failed:", err);
    throw err;
  }
}

export async function setStockSlTp(
  rowNum: number,
  value: string,
): Promise<void> {
  try {
    await writeRange(sid(), `Stocks!G${rowNum}`, [[value]]);
    invalidateStocks();
  } catch (err) {
    logger.error("stocks:writer", "[setStockSlTp] failed:", err);
    throw err;
  }
}

export async function setStockMessage(
  rowNum: number,
  value: string,
): Promise<void> {
  try {
    await writeRange(sid(), `Stocks!H${rowNum}`, [[value]]);
    invalidateStocks();
  } catch (err) {
    logger.error("stocks:writer", "[setStockMessage] failed:", err);
    throw err;
  }
}

export async function appendCapitalAddition(
  date: string,
  amount: number,
  notes: string,
): Promise<void> {
  try {
    await appendRows(sid(), "Capital Summary!B:D", [[date, amount, notes]]);
  } catch (err) {
    logger.error("stocks:writer", "[appendCapitalAddition] failed:", err);
    throw err;
  }
}

export async function appendCapitalRetained(
  date: string,
  amount: number,
  notes: string,
): Promise<void> {
  try {
    await appendRows(sid(), "Capital Retained!B:D", [[date, amount, notes]]);
  } catch (err) {
    logger.error("stocks:writer", "[appendCapitalRetained] failed:", err);
    throw err;
  }
}

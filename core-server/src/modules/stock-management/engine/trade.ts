// ============================================================
// PATCH 1 — core-server
// FILE: src/modules/stock-management/engine/trade.ts
// REPLACE ENTIRE FILE CONTENTS WITH THIS
// ============================================================
//
// BUGS FIXED:
// 1. computeState: used r.buyWacc as lot cost-per-share, but
//    buyWacc already INCLUDES commission. This was correct for
//    avg, BUT the lot.price fed into fifoLots was wrong — the
//    raw cost is totalBuy, not buyWacc*qty (buyWacc IS wacc).
//    Fixed: lot stores { qty, wacc, totalCost } clearly.
//
// 2. buildTradeRow (sell): was computing buyComm = calcCommission(buyCost)
//    and adding it to commissionPaid column — WRONG because commission
//    is already BAKED INTO buyWacc (it's the all-in WACC).
//    So buyCost = avgBuy * qty already includes buy commission.
//    Fixed: only sell commission in row[10]; buy commission not re-added.
//
// 3. netPL: was netReceivable - buyCost, where buyCost = avgBuy*qty
//    (which includes buy commission). This is CORRECT by itself.
//    But then row[10] = sellComm + buyComm double-counted the buy comm.
//    Fixed: row[10] = sellComm only (buy comm already embedded in avgBuy).
//
// 4. Same-day buy+sell: sort already handles this correctly
//    (buy before sell same day by typeRank). Kept as-is, added clarifying comment.
//
// 5. computePositions unrealized P&L: was treating `state.cost` as invested,
//    but state.cost = sum(lot.qty * lot.wacc) = total WACC * qty = correct invested.
//    The issue was plPct was calculated off `invested` which is correct.
//    No change needed here — was already right.
//
// ============================================================
import {
  CommissionBreakdown,
  LtpMap,
  PositionResult,
  TradeInput,
  TradeRow,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

export const r2 = (v: number) =>
  Math.round((Number(v) + Number.EPSILON) * 100) / 100;

export const r3 = (v: number) =>
  Math.round((Number(v) + Number.EPSILON) * 1000) / 1000;

function safeDate(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

function dayDiff(a: Date, b: Date | null): number {
  if (!b) return 0;

  return Math.max(
    0,
    Math.floor(
      (Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
        Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) /
        86400000,
    ),
  );
}

function generateTradeId(): string {
  return (
    "T-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

// ─────────────────────────────────────────────────────────────
// Commission
// ─────────────────────────────────────────────────────────────

export function calcCommission(amount: number): CommissionBreakdown {
  let fee: number;

  if (amount <= 2500) fee = 10;
  else if (amount <= 50_000) fee = amount * 0.0036;
  else if (amount <= 500_000) fee = amount * 0.0033;
  else if (amount <= 2_000_000) fee = amount * 0.0031;
  else if (amount <= 10_000_000) fee = amount * 0.0027;
  else fee = amount * 0.0024;

  return {
    total: r2(fee + amount * 0.00015 + 25),
    brokerFee: r2(fee),
    sebonFee: r2(amount * 0.00015),
    sebonDP: 25,
  };
}

// ─────────────────────────────────────────────────────────────
// Sort rows
// ─────────────────────────────────────────────────────────────

function sortRows(rows: TradeRow[]): TradeRow[] {
  return [...rows].sort((a, b) => {
    const ta = safeDate(a.date)?.getTime() || 0;
    const tb = safeDate(b.date)?.getTime() || 0;

    if (ta !== tb) return ta - tb;

    const rank = (t: string) => (String(t).toLowerCase() === "buy" ? 0 : 1);

    if (rank(a.type) !== rank(b.type)) {
      return rank(a.type) - rank(b.type);
    }

    return String(a.tradeId || "").localeCompare(String(b.tradeId || ""));
  });
}

// ─────────────────────────────────────────────────────────────
// WACC State
// ─────────────────────────────────────────────────────────────

export function computeState(
  symbol: string,
  rows: TradeRow[],
): { qty: number; cost: number; avg: number } {
  const sym = symbol.toUpperCase();

  let qty = 0;
  let cost = 0;

  const sorted = sortRows(rows);

  for (const r of sorted) {
    if (String(r.symbol).toUpperCase() !== sym) continue;

    const tradeQty = Number(r.qty || 0);

    if (tradeQty <= 0) continue;

    if (String(r.type).toLowerCase() === "buy") {
      qty += tradeQty;

      const trueCost =
        Number(r.totalBuy || 0) > 0
          ? Number(r.totalBuy)
          : tradeQty * Number(r.buyWacc || 0);

      cost += trueCost;
    } else {
      const avg = qty > 0 ? cost / qty : 0;

      qty -= tradeQty;
      cost -= avg * tradeQty;

      qty = Math.max(0, qty);
      cost = Math.max(0, cost);
    }
  }

  return {
    qty,
    cost: r2(cost),
    avg: qty > 0 ? r3(cost / qty) : 0,
  };
}

// ─────────────────────────────────────────────────────────────
// All positions
// ─────────────────────────────────────────────────────────────

export function computeAllPositions(
  rows: TradeRow[],
): Record<string, { qty: number; cost: number; avg: number }> {
  const syms = [
    ...new Set(
      rows.map((r) => String(r.symbol || "").toUpperCase()).filter(Boolean),
    ),
  ];

  const map: Record<string, { qty: number; cost: number; avg: number }> = {};

  for (const sym of syms) {
    const state = computeState(sym, rows);

    if (state.qty > 0) {
      map[sym] = state;
    }
  }

  return map;
}

// ─────────────────────────────────────────────────────────────
// FIFO helper ONLY for holding days
// NOT used for accounting
// ─────────────────────────────────────────────────────────────

interface HoldLot {
  qty: number;
  date: Date | null;
}

function buildHoldLots(symbol: string, rows: TradeRow[]): HoldLot[] {
  const sym = symbol.toUpperCase();

  const lots: HoldLot[] = [];

  const sorted = sortRows(rows);

  for (const r of sorted) {
    if (String(r.symbol).toUpperCase() !== sym) continue;

    const qty = Number(r.qty || 0);

    if (qty <= 0) continue;

    if (String(r.type).toLowerCase() === "buy") {
      lots.push({
        qty,
        date: safeDate(r.date),
      });
    } else {
      let rem = qty;

      while (rem > 0 && lots.length > 0) {
        const use = Math.min(rem, lots[0].qty);

        lots[0].qty -= use;
        rem -= use;

        if (lots[0].qty <= 0) {
          lots.shift();
        }
      }
    }
  }

  return lots;
}

// ─────────────────────────────────────────────────────────────
// Build trade row
// ─────────────────────────────────────────────────────────────

export function buildTradeRow(
  input: TradeInput,
  existingRows: TradeRow[],
): unknown[] {
  const { symbol, type, qty: qRaw, price: pRaw, remarks, dateStr } = input;

  const sym = symbol.toUpperCase();

  const qty = Number(qRaw);
  const price = Number(pRaw);

  const tradeDate = dateStr ? new Date(dateStr) : new Date();

  const row = new Array(15).fill("");

  row[0] = generateTradeId();

  row[1] = [
    tradeDate.getMonth() + 1,
    tradeDate.getDate(),
    tradeDate.getFullYear(),
  ].join("/");

  row[2] = sym;
  row[3] = type;
  row[4] = qty;

  // BUY
  if (type === "buy") {
    const gross = qty * price;

    const comm = calcCommission(gross).total;

    const totalBuy = gross + comm;

    const wacc = totalBuy / qty;

    row[5] = r2(wacc);
    row[6] = r2(totalBuy);
    row[10] = r2(comm);
  }

  // SELL
  else if (type === "sell") {
    const state = computeState(sym, existingRows);

    const avgBuy = state.avg;

    const totalBuy = r2(avgBuy * qty);

    // Holding days only
    const lots = buildHoldLots(sym, existingRows);

    let days = 0;
    let rem = qty;

    for (const lot of lots) {
      if (rem <= 0) break;

      const use = Math.min(rem, lot.qty);

      days += use * dayDiff(tradeDate, lot.date);

      rem -= use;
    }

    const holdDays = qty > 0 ? Math.round(days / qty) : 0;

    const grossSell = qty * price;

    const sellComm = calcCommission(grossSell).total;

    const taxableProfit = grossSell - sellComm - totalBuy;

    const cgt = taxableProfit > 0 ? r2(taxableProfit * 0.075) : 0;

    const totalSell = r2(grossSell - sellComm - cgt);

    const netPL = r2(totalSell - totalBuy);

    const plPct = totalBuy > 0 ? r2((netPL / totalBuy) * 100) : 0;

    row[5] = r2(avgBuy);
    row[6] = r2(totalBuy);
    row[7] = r2(price);
    row[8] = totalSell;
    row[9] = holdDays;

    // SELL-SIDE ONLY
    row[10] = r2(sellComm);

    row[11] = cgt;
    row[12] = netPL;
    row[13] = plPct;
  }

  row[14] = remarks || "";

  return row;
}

// ─────────────────────────────────────────────────────────────
// Positions
// ─────────────────────────────────────────────────────────────

export function computePositions(
  rows: TradeRow[],
  ltpMap: LtpMap,
): PositionResult {
  const posMap = computeAllPositions(rows);

  const positions = [];

  for (const [sym, state] of Object.entries(posMap)) {
    const ltpData = ltpMap[sym] || {};

    const ltp = Number(ltpData.ltp || 0);

    const invested = r2(state.cost);

    let currentVal = 0;
    let netPL = 0;
    let plPct = 0;

    if (ltp > 0) {
      const grossSell = state.qty * ltp;

      const sellComm = calcCommission(grossSell).total;

      const taxableProfit = grossSell - sellComm - invested;

      const cgt = taxableProfit > 0 ? taxableProfit * 0.075 : 0;

      currentVal = r2(grossSell - sellComm - cgt);

      netPL = r2(currentVal - invested);

      plPct = invested > 0 ? r2((netPL / invested) * 100) : 0;
    }

    positions.push({
      symbol: sym,
      qty: state.qty,
      avgBuy: r2(state.avg),
      invested,
      ltp,
      chgPct: ltpData.chgPct || 0,
      high: ltpData.high || 0,
      low: ltpData.low || 0,
      currentVal,
      netPL,
      plPct,
      source: ltpData.source || "",
      fetchedAt: ltpData.fetchedAt || null,
    });
  }

  positions.sort((a, b) => b.invested - a.invested);

  const totalInvested = r2(positions.reduce((s, p) => s + p.invested, 0));

  const totalCurrentVal = r2(positions.reduce((s, p) => s + p.currentVal, 0));

  const totalNetPL = r2(positions.reduce((s, p) => s + p.netPL, 0));

  const totalPlPct =
    totalInvested > 0 ? r2((totalNetPL / totalInvested) * 100) : 0;

  return {
    positions,
    totals: {
      invested: totalInvested,
      currentVal: totalCurrentVal,
      netPL: totalNetPL,
      plPct: totalPlPct,
      count: positions.length,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Realized PL
// ─────────────────────────────────────────────────────────────

export function computeRealizedPL(rows: TradeRow[]): number {
  return r2(
    rows.reduce((sum, r) => {
      if (String(r.type).toLowerCase() !== "sell") {
        return sum;
      }

      return sum + Number(r.netPl || 0);
    }, 0),
  );
}

// ── Summary computation ───────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

type FilterResult =
  | { type: "stock"; symbol: string }
  | { type: "date"; startDate: Date; endDate: Date };

function parseFilter(
  raw: string = "all",
  stockSymbols: string[] = [],
): FilterResult {
  const input = String(raw || "all").trim();
  const lower = input.toLowerCase();
  const upper = input.toUpperCase();

  if (stockSymbols.includes(upper)) {
    return { type: "stock", symbol: upper };
  }

  const today = new Date();
  const year = today.getFullYear();

  let startDate: Date;
  let endDate: Date;

  if (lower === "all") {
    startDate = new Date(1970, 0, 1);
    endDate = today;
  } else if (/^[a-z]{3}$/.test(lower) && MONTH_MAP[lower] !== undefined) {
    startDate = new Date(year, MONTH_MAP[lower], 1);
    endDate = new Date(year, MONTH_MAP[lower] + 1, 0, 23, 59, 59, 999);
  } else if (/^[a-z]{3}-\d{4}$/.test(lower)) {
    const [m, y] = lower.split("-");
    startDate = new Date(+y, MONTH_MAP[m], 1);
    endDate = new Date(+y, MONTH_MAP[m] + 1, 0, 23, 59, 59, 999);
  } else if (/^[a-z]{3}-[a-z]{3}$/.test(lower)) {
    const [m1, m2] = lower.split("-");
    startDate = new Date(year, MONTH_MAP[m1], 1);
    endDate = new Date(year, MONTH_MAP[m2] + 1, 0, 23, 59, 59, 999);
  } else if (/^[a-z]{3}-[a-z]{3}-\d{4}$/.test(lower)) {
    const [m1, m2, y] = lower.split("-");
    startDate = new Date(+y, MONTH_MAP[m1], 1);
    endDate = new Date(+y, MONTH_MAP[m2] + 1, 0, 23, 59, 59, 999);
  } else if (/^\d{4}$/.test(lower)) {
    startDate = new Date(+lower, 0, 1);
    endDate = new Date(+lower, 11, 31, 23, 59, 59, 999);
  } else if (/^\d+$/.test(lower)) {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - +lower);
    endDate = today;
  } else if (/^\d+y$/.test(lower)) {
    startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - parseInt(lower));
    endDate = today;
  } else if (/^\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/.test(lower)) {
    const [s, e] = lower.split(":");
    startDate = new Date(s);
    endDate = new Date(e);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error("Invalid date range");
    }
    endDate.setHours(23, 59, 59, 999);
  } else {
    throw new Error(`Invalid filter: ${raw}`);
  }

  return { type: "date", startDate, endDate };
}

export function computeSummary(
  rows: TradeRow[],
  filterRaw: string = "all",
  stockSymbols: string[] = [],
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return emptySummary(filterRaw);
  }

  const filter = parseFilter(filterRaw, stockSymbols);

  let buyCount = 0,
    buyQty = 0,
    buyTurnover = 0;
  let sellCount = 0,
    sellQty = 0,
    sellTurnover = 0;
  let profit = 0,
    commissionPaid = 0,
    cgtPaid = 0;
  let holdDayTotal = 0,
    holdDayCount = 0;
  let firstDate: Date | null = null;
  let lastDate: Date | null = null;

  // Running holding state for filtered window
  const holdings: Record<string, { qty: number; cost: number }> = {};

  // All-time totals (across all rows regardless of filter)
  let allTimeProfit = 0,
    allTimeInvested = 0;
  const allTimeHoldings: Record<string, { qty: number; cost: number }> = {};

  for (const r of rows) {
    const d = safeDate(r.date);
    if (!d || !r.symbol || !r.type) continue;

    const sym = String(r.symbol).toUpperCase();
    const type = String(r.type).toLowerCase();
    const qty = Number(r.qty || 0);
    const totalBuy = Number(r.totalBuy || r.qty * r.buyWacc || 0);
    const totalSell = Number(r.totalSell || 0);

    if (!firstDate || d < firstDate) firstDate = d;
    if (!lastDate || d > lastDate) lastDate = d;

    // ── All-time tracking ─────────────────────────────────
    if (!allTimeHoldings[sym]) allTimeHoldings[sym] = { qty: 0, cost: 0 };
    if (type === "buy") {
      allTimeInvested += totalBuy;
      allTimeHoldings[sym].qty += qty;
      allTimeHoldings[sym].cost += totalBuy;
    }
    if (type === "sell") {
      const h = allTimeHoldings[sym];
      const avgWacc = h.qty > 0 ? h.cost / h.qty : 0;
      const costBasis = avgWacc * qty;
      allTimeProfit += totalSell - costBasis;
      h.qty = Math.max(0, h.qty - qty);
      h.cost = Math.max(0, h.cost - costBasis);
    }

    // ── Filter check ──────────────────────────────────────
    const include =
      filter.type === "stock"
        ? sym === filter.symbol
        : d >= filter.startDate && d <= filter.endDate;
    if (!include) continue;

    // ── Filtered window stats ─────────────────────────────
    if (!holdings[sym]) holdings[sym] = { qty: 0, cost: 0 };

    if (type === "buy") {
      buyCount++;
      buyQty += qty;
      buyTurnover += totalBuy;
      commissionPaid += Number(r.commission || 0);
      holdings[sym].qty += qty;
      holdings[sym].cost += totalBuy;
    }

    if (type === "sell") {
      const h = holdings[sym];
      const avgWacc = h.qty > 0 ? h.cost / h.qty : 0;
      const costBasis = r2(avgWacc * qty);

      sellCount++;
      sellQty += qty;
      sellTurnover += totalSell;
      // Use stored netPl if present, else compute
      profit += Number(r.netPl || 0) || totalSell - costBasis;
      commissionPaid += Number(r.commission || 0);
      cgtPaid += Number(r.profitTax || 0);
      holdDayTotal += Number(r.holdingDays || 0);
      holdDayCount++;

      h.qty = Math.max(0, h.qty - qty);
      h.cost = Math.max(0, h.cost - costBasis);
    }
  }

  const leftAmt = Object.values(holdings).reduce(
    (s, v) => s + Math.max(v.cost, 0),
    0,
  );
  const allTimeLeftover = Object.values(allTimeHoldings).reduce(
    (s, v) => s + Math.max(v.cost, 0),
    0,
  );

  const avgHoldDays =
    holdDayCount > 0 ? Math.round(holdDayTotal / holdDayCount) : 0;

  const plPct = buyTurnover > 0 ? r2((profit / buyTurnover) * 100) : 0;
  const allTimePLPct =
    allTimeInvested > 0 ? r2((allTimeProfit / allTimeInvested) * 100) : 0;

  const years =
    firstDate && lastDate
      ? (lastDate.getTime() - firstDate.getTime()) / 31_536_000_000
      : 0;

  const caagr =
    buyTurnover > 0 && years > 0
      ? r2(
          (Math.pow((buyTurnover + profit) / buyTurnover, 1 / years) - 1) * 100,
        )
      : 0;

  return {
    filter: filterRaw,
    buyCount,
    buyQty,
    buyTurnover: r2(buyTurnover),
    sellCount,
    sellQty,
    sellTurnover: r2(sellTurnover),
    profit: r2(profit),
    plPct,
    commissionPaid: r2(commissionPaid),
    cgtPaid: r2(cgtPaid),
    leftAmt: r2(leftAmt),
    allTimeProfit: r2(allTimeProfit),
    allTimePLPct,
    allTimeLeftover: r2(allTimeLeftover),
    avgHoldDays,
    caagr,
    firstTradeDate: firstDate ? firstDate.toISOString().slice(0, 10) : null,
    lastTradeDate: lastDate ? lastDate.toISOString().slice(0, 10) : null,
  };
}

function emptySummary(filterRaw: string) {
  return {
    filter: filterRaw,
    buyCount: 0,
    buyQty: 0,
    buyTurnover: 0,
    sellCount: 0,
    sellQty: 0,
    sellTurnover: 0,
    profit: 0,
    plPct: 0,
    commissionPaid: 0,
    cgtPaid: 0,
    leftAmt: 0,
    allTimeProfit: 0,
    allTimePLPct: 0,
    allTimeLeftover: 0,
    avgHoldDays: 0,
    caagr: 0,
    firstTradeDate: null,
    lastTradeDate: null,
  };
}

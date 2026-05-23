// ─── routes/watchlist.ts ──────────────────────────────────────────────────────
// GET  /api/watchlist          → all stocks merged with live LTP + portfolio info
// PATCH /api/watchlist/:symbol → update one field (watch, remark, targetCap, slTp, message)
import { Request, Response } from "express";
import { computeAllPositions } from "../engine/trade";
import { getLtpMap } from "../ltp";
import {
  getJournalRows,
  getPromoterLockIn,
  getStocksSheet,
} from "../sheets/reader";
import {
  setStockMessage,
  setStockRemark,
  setStockSlTp,
  setStockTargetCap,
  setWatchFlag,
} from "../sheets/writer";
import { fail, ok, stockmanagement } from "./helpers";

stockmanagement.get("/watchlist", async (req: Request, res: Response) => {
  try {
    const [stocks, ltpMap, lockInMap, journalRows] = await Promise.all([
      getStocksSheet(),
      getLtpMap(),
      getPromoterLockIn(),
      getJournalRows(),
    ]);

    const posMap = computeAllPositions(journalRows);

    let list = stocks.map((s: any) => {
      const ltp = ltpMap[s.symbol] || {};
      const lock = lockInMap[s.symbol] || {};
      const pos = posMap[s.symbol];
      const rawQty = pos?.qty ?? 0;
      const heldQty = Number.isFinite(Number(rawQty))
        ? Math.max(0, Math.round(Number(rawQty)))
        : 0;

      return {
        ...s,
        ltp: ltp.ltp ?? 0,
        chgPct: ltp.chgPct ?? 0,
        high: ltp.high ?? 0,
        low: ltp.low ?? 0,

        lockInDate: lock.lockInDate ?? "",
        unlockIn: lock.unlockIn ?? "",
        isLocked: lock.isLocked ?? false,
        daysRemaining: lock.daysRemaining ?? 0,

        inPortfolio: heldQty > 0,
        heldQty,
      };
    });

    // filter by watch query param
    const watch = String(req.query.watch ?? "").toLowerCase();

    if (watch === "true") {
      list = list.filter((x: any) => x.watch === true);
    } else if (watch === "false") {
      list = list.filter((x: any) => x.watch === false);
    }

    ok(res, { stocks: list, total: list.length });
  } catch (error: any) {
    fail(res, error?.message || "Failed to fetch watchlist");
  }
});

stockmanagement.get(
  "/watchlist/:symbol",
  async (req: Request, res: Response) => {
    try {
      const sym = String(req.params.symbol ?? "").toUpperCase();
      const [stocks, ltpMap, lockInMap, journalRows] = await Promise.all([
        getStocksSheet(),
        getLtpMap(),
        getPromoterLockIn(),
        getJournalRows(),
      ]);
      const stock = stocks.find((x: any) => x.symbol === sym);
      if (!stock) return fail(res, `${sym} not found`, 404);
      const posMap = computeAllPositions(journalRows);
      const ltp = ltpMap[stock.symbol] || {};
      const lock = lockInMap[stock.symbol] || {};
      const pos = posMap[stock.symbol];
      const rawQty = pos?.qty ?? 0;
      const heldQty = Number.isFinite(Number(rawQty))
        ? Math.max(0, Math.round(Number(rawQty)))
        : 0;
      const list = {
        ...stock,
        ltp: ltp.ltp ?? 0,
        chgPct: ltp.chgPct ?? 0,
        high: ltp.high ?? 0,
        low: ltp.low ?? 0,

        lockInDate: lock.lockInDate ?? "",
        unlockIn: lock.unlockIn ?? "",
        isLocked: lock.isLocked ?? false,
        daysRemaining: lock.daysRemaining ?? 0,

        inPortfolio: heldQty > 0,
        heldQty,
      };
      ok(res, { list });
    } catch (error: any) {
      fail(res, error?.message || "Failed to fetch watchlist");
    }
  },
);

stockmanagement.patch(
  "/watchlist/:symbol",
  async (req: Request, res: Response) => {
    try {
      const sym = String(req.params.symbol ?? "").toUpperCase();
      const stocks = await getStocksSheet();
      const stock = stocks.find((x: any) => x.symbol === sym);
      if (!stock) return fail(res, `${sym} not found`, 404);
      const { watch, remark, targetCap, slTp, message } = req.body;
      if (watch !== undefined) {
        await setWatchFlag(stock.rowIndex, watch);
      }

      if (remark !== undefined) {
        await setStockRemark(stock.rowIndex, remark);
      }

      if (targetCap !== undefined) {
        await setStockTargetCap(stock.rowIndex, targetCap);
      }

      if (slTp !== undefined) {
        await setStockSlTp(stock.rowIndex, slTp);
      }

      if (message !== undefined) {
        await setStockMessage(stock.rowIndex, message);
      }
      return ok(res, { success: true });
    } catch (error: any) {
      fail(res, error?.message || "Failed to update watchlist");
    }
  },
);

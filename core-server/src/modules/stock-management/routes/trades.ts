// ─── routes/trades.ts ─────────────────────────────────────────────────────────
// GET    /api/trades            → list all trades (supports ?symbol= ?type= ?limit= ?offset=)
// GET    /api/trades/:tradeId   → single trade
// POST   /api/trades            → create trade (validates symbol, validates sell qty)
// POST   /api/trades/preview    → dry-run: compute row without writing
// PUT    /api/trades/:tradeId   → update trade (rebuild row, overwrite sheet row)
// DELETE /api/trades/:tradeId   → delete trade by id
// DELETE /api/trades/action/last → delete the most recent trade
import { Request, Response } from "express";
import { buildTradeRow, computeState } from "../engine/trade";
import { getJournalRows, getStocksSheet } from "../sheets/reader";
import {
  appendTrade,
  deleteTradeRow,
  findTradeRowById,
  updateTradeRow,
} from "../sheets/writer";
import { fail, ok, stockmanagement } from "./helpers";

async function validateSymbol(sym: string): Promise<boolean> {
  const stocks = await getStocksSheet();
  return stocks.some((stock) => stock.symbol === sym.toUpperCase());
}

stockmanagement.get("/trades", async (req: Request, res: Response) => {
  try {
    const rows = await getJournalRows(true);
    const {
      symbol,
      type,
      limit = "200",
      offset = "0",
    } = req.query as Record<string, string>;
    let trades = rows;
    if (symbol)
      trades = trades.filter(
        (trade) => trade.symbol.toUpperCase() === symbol.toUpperCase(),
      );
    if (type) {
      trades = trades.filter(
        (r) => r.type?.toLowerCase() === type.toLowerCase(),
      );
    }
    const total = trades.length;
    trades = trades.reverse();
    const lim = Number(limit) || 200;
    const off = Number(offset) || 0;
    trades = trades.slice(off, off + lim);
    ok(res, {
      trades,
      total,
      limit: lim,
      offset: off,
    });
  } catch (error: any) {
    fail(res, error.message || "Failed to fetch trades");
  }
});

stockmanagement.post("/trades/preview", async (req: Request, res: Response) => {
  try {
    const { symbol, type, qty, price, remarks, dateStr } = req.body;
    if (!symbol || !type || qty == null || price == null) {
      return fail(res, "Missing required fields", 400);
    }
    const rows = await getJournalRows();
    const row = buildTradeRow(
      { symbol, type, qty, price, remarks, dateStr },
      rows,
    );
    const currentState = computeState(symbol, rows);
    ok(res, {
      preview: row,
      currentState,
    });
  } catch (error: any) {
    fail(res, error.message || "Preview failed");
  }
});

stockmanagement.get("/trades/:tradeId", async (req: Request, res: Response) => {
  try {
    const rows = await getJournalRows(true);
    const trade = rows.find((r) => r.tradeId === req.params.tradeId);

    if (!trade) {
      return fail(res, "Trade not found", 404);
    }

    ok(res, trade);
  } catch (error: any) {
    fail(res, error.message || "Failed to fetch trade");
  }
});

stockmanagement.post("/trades", async (req: Request, res: Response) => {
  try {
    const { symbol, type, qty, price, remarks, date } = req.body;
    if (!symbol || !type || qty == null || price == null) {
      return fail(res, "Missing required fields", 400);
    }
    const valid = await validateSymbol(symbol);
    if (!valid) {
      return fail(res, "Invalid symbol", 422);
    }
    const rows = await getJournalRows();
    if (String(type).toLowerCase() === "sell") {
      const state = computeState(symbol, rows);
      if (state.qty <= 0) {
        return fail(res, "No holdings", 400);
      }
      if (Number(qty) > state.qty) {
        return fail(
          res,
          `Oversell: you hold ${state.qty}, tried to sell ${qty}`,
          400,
        );
      }
    }
    const row = buildTradeRow(
      {
        symbol,
        type,
        qty,
        price,
        remarks,
        dateStr: date,
      },
      rows,
    );

    await appendTrade(row);

    ok(res, {
      success: true,
      tradeId: row[0],
    });
  } catch (error: any) {
    fail(res, error.message || "Failed to create trade");
  }
});

stockmanagement.delete(
  "/trades/action/last",
  async (req: Request, res: Response) => {
    try {
      const rows = await getJournalRows(true);

      if (!rows.length) {
        return fail(res, "No trades", 400);
      }

      const last = rows[rows.length - 1];

      const rowNum = await findTradeRowById(last.tradeId);

      if (rowNum == null) {
        return fail(res, "Trade not found", 404);
      }

      await deleteTradeRow(rowNum);

      ok(res, {
        success: true,
        deleted: last.tradeId,
      });
    } catch (error: any) {
      fail(res, error.message || "Failed to delete last trade");
    }
  },
);

stockmanagement.put("/trades/:tradeId", async (req: Request, res: Response) => {
  try {
    const tradeId = String(req.params.tradeId);
    const rowNum = await findTradeRowById(tradeId);
    if (rowNum == null) return fail(res, "Trade not found", 404);
    const rows = await getJournalRows();
    const existing = rows.find((r) => r.tradeId === tradeId);
    if (!existing) {
      return fail(res, "Trade not found", 404);
    }
    const merged = {
      symbol: req.body.symbol ?? existing.symbol,
      type: req.body.type ?? existing.type,
      qty: req.body.qty ?? existing.qty,
      price: req.body.price ?? existing.buyWacc,
      remarks: req.body.remarks ?? existing.remarks,
      date: req.body.date ?? existing.date,
    };
    const valid = await validateSymbol(merged.symbol);

    if (!valid) {
      return fail(res, "Invalid symbol", 422);
    }
    const others = rows.filter((r) => r.tradeId !== tradeId);
    const newRow = buildTradeRow(
      {
        symbol: merged.symbol,
        type: merged.type,
        qty: merged.qty,
        price: merged.price,
        remarks: merged.remarks,
        dateStr: merged.date,
      },
      others,
    );
    newRow[0] = tradeId;

    await updateTradeRow(rowNum, newRow);
    ok(res, { success: true });
  } catch (error: any) {
    fail(res, error.message || "Failed to update trade");
  }
});

stockmanagement.delete(
  "/trades/:tradeId",
  async (req: Request, res: Response) => {
    try {
      const rowNum = await findTradeRowById(String(req.params.tradeId));

      if (rowNum == null) {
        return fail(res, "Trade not found", 404);
      }

      await deleteTradeRow(rowNum);

      ok(res, { success: true });
    } catch (error: any) {
      fail(res, error.message || "Failed to delete trade");
    }
  },
);

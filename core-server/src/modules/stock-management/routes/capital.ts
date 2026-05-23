// ─── routes/capital.ts ────────────────────────────────────────────────────────
// GET  /api/capital            → full capital summary (deployed, available, P&L etc.)
// POST /api/capital/add        → record a capital addition
// POST /api/capital/retain     → record a capital withdrawal/retention
import { Request, Response } from "express";
import { computeAllPositions, computeRealizedPL, r2 } from "../engine/trade";

import {
  getCapitalAdditions,
  getCapitalRetentions,
  getJournalRows,
} from "../sheets/reader";
import { appendCapitalAddition, appendCapitalRetained } from "../sheets/writer";
import { fail, ok, stockmanagement } from "./helpers";

function computeDeployedCapital(rows: any[]): number {
  const position = Object.entries(computeAllPositions(rows));
  return r2(
    position.reduce((sum: number, [_, p]) => {
      const value = Number(p.cost ?? 0);
      return sum + value;
    }, 0),
  );
}

stockmanagement.get("/capital", async (req: Request, res: Response) => {
  try {
    const [additions, retentions, rows] = await Promise.all([
      getCapitalAdditions(),
      getCapitalRetentions(),
      getJournalRows(),
    ]);
    const totalCapitalAdded = r2(
      additions.reduce(
        (sum: number, item) => sum + Number(item.amount || 0),
        0,
      ),
    );

    const totalRetained = r2(
      retentions.reduce(
        (sum: number, item: any) => sum + Number(item.amount || 0),
        0,
      ),
    );

    const deployedCapital = r2(computeDeployedCapital(rows));
    const realizedPL = r2(computeRealizedPL(rows));
    const actualCapital = r2(totalCapitalAdded - totalRetained + realizedPL);
    const tradingCapital = r2(actualCapital * 0.7);
    const reservedCapital = r2(actualCapital * 0.3);
    const maxPerStock = r2(actualCapital * 0.2);
    const availableCapital = r2(actualCapital - deployedCapital);
    ok(res, {
      totalCapitalAdded,
      totalRetained,
      deployedCapital,
      realizedPL,
      actualCapital,
      tradingCapital,
      reservedCapital,
      maxPerStock,
      availableCapital,
      additions,
      retentions,
    });
  } catch (error: any) {
    fail(res, error.message || "Failed to fetch capital summary");
  }
});

stockmanagement.post("/capital/add", async (req: Request, res: Response) => {
  try {
    const { date, amount, notes } = req.body;

    if (!date || amount == null) {
      return fail(res, "Date and amount are required", 400);
    }

    const num = Number(amount);

    if (!Number.isFinite(num) || num <= 0) {
      return fail(res, "Amount must be greater than 0", 400);
    }

    await appendCapitalAddition(date, num, notes ?? "");

    ok(res, { success: true });
  } catch (error: any) {
    fail(res, error.message || "Failed to add capital");
  }
});

stockmanagement.post("/capital/retain", async (req: Request, res: Response) => {
  try {
    const { date, amount, notes } = req.body;

    if (!date || amount == null) {
      return fail(res, "Date and amount are required", 400);
    }

    const num = Number(amount);

    if (!Number.isFinite(num) || num <= 0) {
      return fail(res, "Amount must be greater than 0", 400);
    }

    await appendCapitalRetained(date, num, notes ?? "");

    ok(res, { success: true });
  } catch (error: any) {
    fail(res, error.message || "Failed to retain capital");
  }
});

import { Request, Response } from "express";
import { computePositions } from "../engine/trade";
import { getLtpMap } from "../ltp";
import { getJournalRows } from "../sheets/reader";
import { PositionResult } from "../types";
import { fail, ok, stockmanagement } from "./helpers";

async function getPosition(): Promise<PositionResult> {
  const [rows, ltpMap] = await Promise.all([getJournalRows(true), getLtpMap()]);

  return computePositions(rows, ltpMap);
}

stockmanagement.get("/positions", async (req: Request, res: Response) => {
  try {
    const data = await getPosition();
    return ok(res, data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return fail(res, message);
  }
});

stockmanagement.get(
  "/positions/:symbol",
  async (req: Request, res: Response) => {
    try {
      const sym = String(req.params.symbol ?? "").toUpperCase();
      const data = await getPosition();
      const position = data.positions.find((pos) => pos.symbol === sym);
      if (!position) return fail(res, "Symbol not in position", 404);
      return ok(res, position);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return fail(res, message);
    }
  },
);

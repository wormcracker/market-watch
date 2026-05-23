import { Request, Response } from "express";
import { fail, ok, stockmanagement } from "./helpers";
import { getJournalRows } from "../sheets/reader";
import { computeSummary } from "../engine/trade";

stockmanagement.get("/summary", async (req: Request, res: Response) => {
  try {
    const filter = String(req.query.filter || "all");
    const rows = await getJournalRows();
    const symbols = [
      ...new Set(rows.map((r: any) => r.symbol).filter(Boolean)),
    ];
    const summary = computeSummary(rows, filter, symbols);
    return ok(res, summary);
  } catch (error: any) {
    return fail(
      res,
      error?.message || "Internal server error unable to summarize",
      500,
    );
  }
});

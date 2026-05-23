// ─── routes/ltp.ts ────────────────────────────────────────────────────────────
// GET  /api/ltp                → full LTP map + cache status
// GET  /api/ltp/:symbol        → single symbol LTP
// POST /api/ltp/csv            → upload NEPSE CSV to inject LTP data
import { Request, Response } from "express";
import { getCacheStatus, getLtpMap, injectCsvLtp } from "../ltp";
import { fail, ok, stockmanagement } from "./helpers";

stockmanagement.get("/ltp/status", (req: Request, res: Response) => {
  ok(res, getCacheStatus());
});

stockmanagement.post("/ltp/csv", async (req: Request, res: Response) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      return fail(res, "rows must be an array", 400);
    }
    const normalized = rows
      .map((row: any) => ({
        symbol: String(row.symbol || "")
          .toUpperCase()
          .trim(),
        ltp: Number(row.ltp),
        chgPct:
          row.chgPct == null || row.chgPct === ""
            ? undefined
            : Number(row.chgPct),
        open:
          row.open == null || row.open === "" ? undefined : Number(row.open),
        high:
          row.high == null || row.high === "" ? undefined : Number(row.high),
        low: row.low == null || row.low === "" ? undefined : Number(row.low),
      }))
      .filter((row: any) => row.symbol && Number.isFinite(row.ltp));
    if (!normalized.length) {
      return fail(res, "No valid rows found", 400);
    }

    const updatedMap = injectCsvLtp(normalized);
    ok(res, {
      success: true,
      symbolCount: Object.keys(updatedMap).length,
      status: getCacheStatus(),
    });
  } catch (error: any) {
    fail(res, error.message || "Failed to import CSV LTP");
  }
});

stockmanagement.get("/ltp/:symbol", (req: Request, res: Response) => {
  const sym = String(req.params.symbol).toUpperCase();
  const map = getLtpMap();

  if (!map[sym]) {
    return fail(res, `No LTP for ${sym}`, 404);
  }

  ok(res, {
    symbol: sym,
    ...map[sym],
  });
});

stockmanagement.get("/ltp", (_req: Request, res: Response) => {
  ok(res, {
    ltp: getLtpMap(),
    status: getCacheStatus(),
  });
});

import { Router, Request, Response } from "express";
import { getSnapshot, getCacheStatus } from "@shared/cache";
import { ok, fail } from "@shared/response";
import { getSchedulerStatus } from "../scheduler";
import { getOrchestratorStatus, orchestrate } from "../orchestrator";
import { getSettings, saveSettings } from "../settings";
import { NepseDataSetting } from "../settings/defaults";
import { CACHE_FILE } from "../constants";

const nepseRoutes = Router();

nepseRoutes.get("/stocks", (_req: Request, res: Response) => {
  const cache = getSnapshot();
  if (cache === null)
    return res.status(503).json(fail("No market data available yet"));
  return res.json(
    ok({
      stocks: cache.stocks,
      meta: {
        fetchedAt: cache.fetchedAt,
        source: cache.source,
        count: Object.keys(cache.stocks).length,
      },
    }),
  );
});

nepseRoutes.get("/stocks/:symbol", (req: Request, res: Response) => {
  const symbol = req.params.symbol?.toUpperCase().trim();
  if (!symbol)
    return res.status(400).json(fail("Symbol parameter is required"));
  if (!/^[A-Z0-9]+$/.test(symbol))
    return res.status(400).json(fail(`Invalid symbol format: ${symbol}`));
  const cache = getSnapshot();
  if (cache === null)
    return res.status(503).json(fail("No market data available yet"));
  const stock = cache.stocks[symbol];
  if (!stock) return res.status(404).json(fail(`Stock not found: ${symbol}`));
  return res.json(
    ok({ stock, fetchedAt: cache.fetchedAt, source: cache.source }),
  );
});

nepseRoutes.get("/status", (_req: Request, res: Response) => {
  return res.json(
    ok({
      scheduler: getSchedulerStatus(),
      orchestrator: getOrchestratorStatus(),
      cache: getCacheStatus(CACHE_FILE),
      server: {
        uptime: process.uptime().toFixed(1) + "s",
        memory: process.memoryUsage().heapUsed,
        nodeVersion: process.version,
      },
    }),
  );
});

nepseRoutes.get("/settings", (_req: Request, res: Response) => {
  return res.json(ok(getSettings()));
});

nepseRoutes.patch("/settings", (req: Request, res: Response) => {
  const body = req.body as Partial<NepseDataSetting>;
  if (
    body.interval !== undefined &&
    (typeof body.interval !== "number" || body.interval < 5)
  )
    return res.status(400).json(fail("interval must be a number >= 5"));
  return res.json(ok(saveSettings(body)));
});

nepseRoutes.post("/refresh", async (_req: Request, res: Response) => {
  try {
    const result = await orchestrate(true);
    return res.json(
      ok({
        source: result.source,
        stockCount: Object.keys(result.snapshot.stocks).length,
        fetchedAt: result.snapshot.fetchedAt,
      }),
    );
  } catch (err) {
    return res
      .status(503)
      .json(fail(err instanceof Error ? err.message : "Refresh failed"));
  }
});

export default nepseRoutes;

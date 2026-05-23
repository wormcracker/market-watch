import { getCacheStatus, getLtpMap } from "../ltp";
import { getPreloadState } from "../startup";
import { fail, ok, stockmanagement } from "./helpers";

stockmanagement.get("/status", async (_req, res) => {
  try {
    const memory = process.memoryUsage();

    return ok(res, {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),

      preloadStatus: getPreloadState(),

      ltp: {
        symbols: Object.keys(getLtpMap()).length,
        cache: getCacheStatus(),
      },

      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
      },
    });
  } catch (error: any) {
    return fail(res, "Failed to fetch status");
  }
});

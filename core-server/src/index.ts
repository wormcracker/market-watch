import "./env";
import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

import { ENV } from "./env";
import { systemEvents } from "@shared/events";
import { getSnapshot } from "@shared/cache";
import { logger } from "@shared/logger";
import { ensureDir } from "@shared/fs";
import path from "path";

// ── Module bootstraps ─────────────────────────────────────────────────────────
import {
  bootstrapNepseData,
  startNepseScheduler,
  stopNepseScheduler,
  nepseRoutes,
} from "./modules/nepse-data";
import {
  bootstrapWatchers,
  startWatchersScheduler,
  stopWatchers,
  watchersRoutes,
} from "./modules/watchers";
import {
  bootstrapStockManagement,
  preloadStockData,
  stockManagementRoutes,
} from "./modules/stock-management";

// ── Ensure data directories exist ─────────────────────────────────────────────
ensureDir(path.join(process.cwd(), "data", "nepse"));
ensureDir(path.join(process.cwd(), "data", "watchers"));
ensureDir(path.join(process.cwd(), "data", "stocks"));
ensureDir(path.join(process.cwd(), "config", "nepse"));
ensureDir(path.join(process.cwd(), "config", "watchers"));
ensureDir(path.join(process.cwd(), "config", "stocks"));

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── Module routes ─────────────────────────────────────────────────────────────
app.use("/api/nepse", nepseRoutes);
app.use("/api/watchers", watchersRoutes);
app.use("/api/stocks", stockManagementRoutes);

// ── HTTP + WebSocket server ───────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// ── WebSocket client management ───────────────────────────────────────────────
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  logger.info("core:ws", `Client connected — ${clients.size} total`);

  // Send current snapshot immediately on connect
  const snapshot = getSnapshot();
  if (snapshot) {
    ws.send(
      JSON.stringify({
        type: "connected",
        payload: {
          data: snapshot.stocks,
          source: snapshot.source,
          fetchedAt: snapshot.fetchedAt,
          message: "Market Watch Connected",
        },
        timestamp: new Date().toISOString(),
      }),
    );
  } else {
    ws.send(
      JSON.stringify({
        type: "connected",
        payload: {
          data: null,
          source: null,
          fetchedAt: null,
          message: "Market Watch Connected",
        },
        timestamp: new Date().toISOString(),
      }),
    );
  }

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "ping")
        ws.send(
          JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }),
        );
    } catch {}
  });

  ws.on("close", () => {
    clients.delete(ws);
    logger.info("core:ws", `Client disconnected — ${clients.size} total`);
  });

  ws.on("error", (err) => {
    logger.error("core:ws", "Client error", err.message);
    clients.delete(ws);
  });
});

// ── Broadcast market updates to all WS clients ────────────────────────────────
systemEvents.on("nepse:snapshot", (payload) => {
  if (clients.size === 0) return;
  const message = JSON.stringify({
    type: "market_update",
    payload,
    timestamp: new Date().toISOString(),
  });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
});

// ── Broadcast alert fired to all WS clients ───────────────────────────────────
systemEvents.on("alert:fired", (payload) => {
  if (clients.size === 0) return;
  const message = JSON.stringify({
    type: "alert_fired",
    payload,
    timestamp: new Date().toISOString(),
  });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
});

// ── Ping/pong keep-alive ──────────────────────────────────────────────────────
setInterval(() => {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.ping();
    else clients.delete(client);
  }
}, 30_000);

// ── Boot sequence ─────────────────────────────────────────────────────────────
async function boot(): Promise<void> {
  // 1. Bootstrap all modules (load settings, init engines)
  bootstrapNepseData(app);
  bootstrapWatchers(app);
  await bootstrapStockManagement(app);

  // 2. Start HTTP server
  await new Promise<void>((resolve, reject) => {
    server.listen(ENV.PORT, "0.0.0.0", () => {
      logger.info(
        "core",
        `Market Watch running on http://localhost:${ENV.PORT}`,
      );
      resolve();
    });
    server.on("error", reject);
  });

  // 3. Start schedulers
  startNepseScheduler();
  startWatchersScheduler();

  // 4. Preload Google Sheets data (non-blocking)
  preloadStockData().catch((err) =>
    logger.error("core", "Stock preload failed", err),
  );

  logger.info("core", "✅ All modules started");
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
let _shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (_shuttingDown) return;
  _shuttingDown = true;

  logger.info("core", `${signal} received — shutting down`);

  stopNepseScheduler();
  await stopWatchers();

  for (const client of clients) client.terminate();
  clients.clear();

  await new Promise<void>((resolve) => server.close(() => resolve()));

  logger.info("core", "✅ Clean shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) =>
  logger.error("core", "Unhandled rejection", reason),
);
process.on("uncaughtException", (err) => {
  logger.error("core", "Uncaught exception", err);
  shutdown("uncaughtException").catch(() => process.exit(1));
});

boot().catch((err) => {
  logger.error("core", "Boot failed", err);
  process.exit(1);
});

// src/routes/index.ts

import { Router } from "express";
import { ok as apiOk, fail as apiFail } from "@shared/response";
import crypto from "crypto";

import {
  loadWatches,
  getWatch,
  upsertWatch,
  deleteWatch,
  loadAlerts,
  getAlert,
  markAlertsRead,
  clearAlerts,
  saveAlerts,
  loadSettings,
  updateSettings,
  resetSettings,
  getHistory,
  clearHistory,
  getWatchByName,
} from "../store";

import {
  startScheduler,
  stopScheduler,
  restartScheduler,
  triggerWatch,
  scheduleWatch,
  unscheduleWatch,
  findOverlappingWindows,
  getSchedulerStatus,
} from "../scheduler";

import { getNepseStatus } from "../engines/nepse.engine";
import type { Watch } from "../types";

const router = Router();

// ════════════════════════════════════════════════════════════════
// VALIDATION
// ════════════════════════════════════════════════════════════════

function validateWatch(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Body must be an object";
  const b = body as any;

  if (!b.name || typeof b.name !== "string") return "name is required";
  if (!b.engine || typeof b.engine !== "string") return "engine is required";

  if (!["http", "puppeteer", "nepse"].includes(b.engine))
    return `engine must be "http", "puppeteer", or "nepse" — got "${b.engine}"`;

  if (b.engine === "nepse") {
    if (!b.symbol) return "symbol is required for nepse engine";
    if (!b.field) return "field is required for nepse engine";
  } else {
    if (!b.url) return "url is required for http/puppeteer engines";
    if (!b.selector) return "selector is required for http/puppeteer engines";
  }

  if (
    !b.conditions ||
    !Array.isArray(b.conditions) ||
    b.conditions.length === 0
  )
    return "at least one condition is required";

  // Warn about overlapping windows but don't reject
  if (Array.isArray(b.schedule?.windows) && b.schedule.windows.length > 1) {
    const overlaps = findOverlappingWindows(b.schedule.windows);
    if (overlaps.length > 0) {
      console.warn(
        `[Routes] Watch "${b.name}" has overlapping windows at pairs:`,
        overlaps,
        "— first matching window will be used",
      );
    }
  }

  return null;
}

// ════════════════════════════════════════════════════════════════
// WATCHES — CRUD
// ════════════════════════════════════════════════════════════════

// GET /api/watches
router.get("/watches", (_req, res) => {
  return res.json(apiOk(loadWatches()));
});

// POST /api/watches
router.post("/watches", (req, res) => {
  const body = req.body;
  const invalid = validateWatch(body);
  if (invalid) return res.status(400).json(apiFail(invalid));

  const watch: Watch = {
    ...body,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    enabled: body.enabled ?? true,
    conditions: body.conditions ?? [],
    lastValue: null, //
    lastCheckedAt: null,
    lastAlertAt: null,
  };

  upsertWatch(watch);
  scheduleWatch(watch.id);

  return res.status(201).json(apiOk(watch));
});

// GET /api/watches/:id
router.get("/watches/:id", (req, res) => {
  const existing = getWatch(req.params.id);
  if (!existing) return res.status(404).json(apiFail("Watch not found"));
  return res.json(apiOk(existing));
});

// GET /api/watches/:id
router.get("/watches/byName/:name(*)", (req, res) => {
  const name = decodeURIComponent(req.params.name).trim();
  const watchName = getWatchByName(name);
  if (!watchName) return res.status(404).json(apiFail("WatchName not found"));
  return res.json(apiOk(watchName));
});

// PATCH /api/watches/:id
router.patch("/watches/:id", (req, res) => {
  const existing = getWatch(req.params.id);
  if (!existing) return res.status(404).json(apiFail("Watch not found"));

  const updated: Watch = {
    ...existing,
    ...req.body,
    id: existing.id,
    createdAt: existing.createdAt,
    lastValue: existing.lastValue,
    lastCheckedAt: existing.lastCheckedAt,
    lastAlertAt: existing.lastAlertAt,
  };

  upsertWatch(updated);
  unscheduleWatch(existing.id);
  scheduleWatch(updated.id);
  return res.json(apiOk(updated));
});

// DELETE /api/watches/:id
router.delete("/watches/:id", (req, res) => {
  const existing = getWatch(req.params.id);
  if (!existing) return res.status(404).json(apiFail("Watch not found"));

  unscheduleWatch(existing.id);
  deleteWatch(existing.id);

  return res.json(apiOk({ deleted: existing.id }));
});

// ════════════════════════════════════════════════════════════════
// WATCHES — ACTIONS
// ════════════════════════════════════════════════════════════════

// POST /api/watches/:id/run
router.post("/watches/:id/run", async (req, res) => {
  const existing = getWatch(req.params.id);
  if (!existing) return res.status(404).json(apiFail("Watch not found"));

  try {
    await triggerWatch(existing.id);
    return res.json(apiOk(getWatch(existing.id) ?? existing));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Trigger failed";
    return res.status(500).json(apiFail(msg));
  }
});

// POST /api/watches/:id/enable
router.post("/watches/:id/enable", (req, res) => {
  const existing = getWatch(req.params.id);
  if (!existing) return res.status(404).json(apiFail("Watch not found"));

  if (existing.enabled) return res.json(apiOk(existing));

  const updated = { ...existing, enabled: true };
  upsertWatch(updated);
  scheduleWatch(updated.id);

  return res.json(apiOk(updated));
});

router.post("/watches/:id/mode", (req, res) => {
  const existing = getWatch(req.params.id);
  if (!existing) return res.status(404).json(apiFail("Watch not found"));

  const { mode } = req.body;
  if (!["auto", "enabled", "disabled"].includes(mode))
    return res
      .status(400)
      .json(apiFail('mode must be "auto", "enabled", or "disabled"'));

  const updated = { ...existing, scheduleMode: mode };
  upsertWatch(updated);

  // reschedule with new mode
  unscheduleWatch(existing.id);
  if (updated.enabled && mode !== "disabled") {
    scheduleWatch(updated.id);
  }

  return res.json(apiOk(updated));
});

// POST /api/watches/:id/disable
router.post("/watches/:id/disable", (req, res) => {
  const existing = getWatch(req.params.id);
  if (!existing) return res.status(404).json(apiFail("Watch not found"));

  if (!existing.enabled) return res.json(apiOk(existing));

  const updated = { ...existing, enabled: false };
  upsertWatch(updated);
  unscheduleWatch(updated.id);

  return res.json(apiOk(updated));
});

// ════════════════════════════════════════════════════════════════
// WATCHES — HISTORY
// ════════════════════════════════════════════════════════════════

// GET /api/watches/:id/history?limit=100
router.get("/watches/:id/history", (req, res) => {
  const existing = getWatch(req.params.id);
  if (!existing) return res.status(404).json(apiFail("Watch not found"));

  const raw = req.query.limit;
  const limit =
    typeof raw === "string" && !isNaN(Number(raw))
      ? Math.min(Math.max(parseInt(raw, 10), 1), 1000)
      : 100;

  return res.json(apiOk(getHistory(existing.id, limit)));
});

// DELETE /api/watches/:id/history
router.delete("/watches/:id/history", (req, res) => {
  const existing = getWatch(req.params.id);
  if (!existing) return res.status(404).json(apiFail("Watch not found"));
  clearHistory(existing.id);
  return res.json(apiOk({ cleared: existing.id }));
});

// ════════════════════════════════════════════════════════════════
// WATCHES — ALERTS (scoped to one watch)
// ════════════════════════════════════════════════════════════════

// GET /api/watches/:id/alerts
router.get("/watches/:id/alerts", (req, res) => {
  const existing = getWatch(req.params.id);
  if (!existing) return res.status(404).json(apiFail("Watch not found"));
  const alerts = loadAlerts().filter((a) => a.watchId === existing.id);
  return res.json(apiOk(alerts));
});

// DELETE /api/watches/:id/alerts
router.delete("/watches/:id/alerts", (req, res) => {
  const existing = getWatch(req.params.id);
  if (!existing) return res.status(404).json(apiFail("Watch not found"));
  clearAlerts(existing.id);
  return res.json(apiOk({ cleared: existing.id }));
});

// ════════════════════════════════════════════════════════════════
// ALERTS — GLOBAL
// ════════════════════════════════════════════════════════════════

// GET /api/alerts?unread=true&watchId=xxx
router.get("/alerts", (req, res) => {
  let alerts = loadAlerts();

  // Filter by read status
  if (req.query.unread === "true") {
    alerts = alerts.filter((a) => a.readAt === null);
  } else if (req.query.unread === "false") {
    alerts = alerts.filter((a) => a.readAt !== null);
  }

  // Filter by watch
  if (typeof req.query.watchId === "string" && req.query.watchId.trim()) {
    alerts = alerts.filter((a) => a.watchId === req.query.watchId);
  }

  return res.json(apiOk(alerts));
});

// DELETE /api/alerts — clear all alerts
router.delete("/alerts", (_req, res) => {
  clearAlerts();
  return res.json(apiOk({ cleared: true }));
});

// GET /api/alerts/:id
router.get("/alerts/:id", (req, res) => {
  const alert = getAlert(req.params.id);
  if (!alert) return res.status(404).json(apiFail("Alert not found"));
  return res.json(apiOk(alert));
});

// PATCH /api/alerts/:id/read — mark single alert as read
router.patch("/alerts/:id/read", (req, res) => {
  const alert = getAlert(req.params.id);
  if (!alert) return res.status(404).json(apiFail("Alert not found"));
  markAlertsRead([req.params.id]);
  return res.json(apiOk({ marked: [req.params.id] }));
});

// POST /api/alerts/read — batch mark as read
router.post("/alerts/read", (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json(apiFail("ids must be a non-empty array"));

  if (!ids.every((id: unknown) => typeof id === "string"))
    return res.status(400).json(apiFail("all ids must be strings"));

  markAlertsRead(ids);
  return res.json(apiOk({ marked: ids.length }));
});

// DELETE /api/alerts/:id — delete single alert
router.delete("/alerts/:id", (req, res) => {
  const id = req.params.id;
  const alerts = loadAlerts();
  const before = alerts.length;

  // Filter out the target alert.
  const filtered = alerts.filter((a) => a.id !== id);

  if (filtered.length === before)
    return res.status(404).json(apiFail("Alert not found"));

  saveAlerts(filtered);
  return res.json(apiOk({ deleted: id }));
});

// ════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════

// GET /api/settings
router.get("/settings", (_req, res) => {
  return res.json(apiOk(loadSettings()));
});

// PATCH /api/settings
router.patch("/settings", (req, res) => {
  if (!req.body || typeof req.body !== "object")
    return res.status(400).json(apiFail("Body must be an object"));

  const updated = updateSettings(req.body);

  // WHY restart on maxConcurrent change:
  if (req.body.maxConcurrent !== undefined) {
    restartScheduler();
  }

  return res.json(apiOk(updated));
});

// POST /api/settings/reset
router.post("/settings/reset", (_req, res) => {
  return res.json(apiOk(resetSettings()));
});

// ════════════════════════════════════════════════════════════════
// SYSTEM
// ════════════════════════════════════════════════════════════════

// GET /api/system/health
router.get("/system/health", (_req, res) => {
  const mem = process.memoryUsage();
  return res.json(
    apiOk({
      status: "ok",
      uptime: Math.floor(process.uptime()), // seconds
      uptimeHuman: formatUptime(process.uptime()),
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
      },
      node: process.version,
    }),
  );
});

// GET /api/system/status
router.get("/system/status", (_req, res) => {
  const watches = loadWatches();
  const alerts = loadAlerts();

  return res.json(
    apiOk({
      scheduler: getSchedulerStatus(),
      watches: {
        total: watches.length,
        enabled: watches.filter((w) => w.enabled).length,
        byEngine: {
          http: watches.filter((w) => w.engine === "http").length,
          puppeteer: watches.filter((w) => w.engine === "puppeteer").length,
          nepse: watches.filter((w) => w.engine === "nepse").length,
        },
      },
      alerts: {
        total: alerts.length,
        unread: alerts.filter((a) => !a.readAt).length,
      },
      engines: {
        nepse: getNepseStatus(),
      },
    }),
  );
});

// POST /api/system/scheduler/start
router.post("/system/scheduler/start", (_req, res) => {
  startScheduler();
  return res.json(apiOk({ started: true }));
});

// POST /api/system/scheduler/stop
router.post("/system/scheduler/stop", (_req, res) => {
  stopScheduler();
  return res.json(apiOk({ stopped: true }));
});

// POST /api/system/scheduler/restart
router.post("/system/scheduler/restart", (_req, res) => {
  restartScheduler();
  return res.json(apiOk({ restarting: true }));
});

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default router;

// ─── routes/settings.ts ───────────────────────────────────────────────────────
// GET   /api/settings          → return current config
// PATCH /api/settings          → deep-merge partial update, save
// POST  /api/settings/reset    → reset to DEFAULT_CONFIG
import { Request, Response } from "express";
import { loadConfig, resetSettings, updateConfig } from "../config";
import { fail, ok, stockmanagement } from "./helpers";

stockmanagement.get("/settings", (req: Request, res: Response) => {
  ok(res, loadConfig());
});

stockmanagement.patch("/settings", (req: Request, res: Response) => {
  try {
    const updated = updateConfig(req.body);
    ok(res, updated);
  } catch (error: any) {
    fail(res, error.message || "Failed to update settings");
  }
});

stockmanagement.post("/settings/reset", (req: Request, res: Response) => {
  try {
    const config = resetSettings();
    ok(res, config);
  } catch (error: any) {
    fail(res, error.message || "Failed to reset settings");
  }
});

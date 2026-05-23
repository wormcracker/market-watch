import { Express } from "express";
import { loadConfig } from "./config";
import { preloadAll } from "./startup";
import { logger } from "@shared/logger";

export async function bootstrapStockManagement(_app: Express): Promise<void> {
  loadConfig();
  logger.info("stock-management", "Config loaded");
}

export async function preloadStockData(): Promise<void> {
  await preloadAll();
}

export { stockManagementRoutes } from "./routes";

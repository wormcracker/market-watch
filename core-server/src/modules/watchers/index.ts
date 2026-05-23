import { Express } from "express";
import { startAllEngines, stopAllEngines } from "./engines";
import { startScheduler, stopScheduler } from "./scheduler";
import { logger } from "@shared/logger";

export function bootstrapWatchers(app: Express): void {
  startAllEngines();
  logger.info("watchers", "Engines started");
}

export function startWatchersScheduler(): void {
  startScheduler();
  logger.info("watchers", "Scheduler started");
}

export async function stopWatchers(): Promise<void> {
  stopScheduler();
  await stopAllEngines();
  logger.info("watchers", "Stopped");
}

export { default as watchersRoutes } from "./routes";

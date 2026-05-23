import { readJson, writeJson } from "@shared/fs";
import { logger } from "@shared/logger";
import { DATA_DIR } from "../constants";
import path from "path";

function fp(name: string): string {
  return path.join(DATA_DIR, `${name}.json`);
}

export function load<T>(name: string, fallback: T): T {
  const result = readJson<T>(fp(name));
  if (result === null) return fallback;
  logger.debug("stocks:config", `${name} loaded`);
  return result;
}

export function save<T>(name: string, data: T): void {
  writeJson(fp(name), data);
  logger.debug("stocks:config", `${name} saved`);
}

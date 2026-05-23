import fs from "fs";
import { DeepPartial } from "../types";
import { load, save } from "./core";
import { DEFAULT_CONFIG, StockManagementConfig } from "./defaults";
import { SERVICE_ACCOUNT_FILE } from "../constants";

let _settings: StockManagementConfig | null = null;

function isObject(val: any): val is Record<string, any> {
  return val && typeof val === "object" && !Array.isArray(val);
}

function deepMerge<T>(base: T, patch: any): T {
  const output: any = { ...base };
  for (const key of Object.keys(patch || {})) {
    const b = (base as any)[key];
    const p = patch[key];
    if (isObject(b) && isObject(p)) output[key] = deepMerge(b, p);
    else output[key] = p;
  }
  return output;
}

export function getServiceAccountPath(): string | null {
  return fs.existsSync(SERVICE_ACCOUNT_FILE) ? SERVICE_ACCOUNT_FILE : null;
}

export function loadConfig(): StockManagementConfig {
  if (_settings) return _settings;
  const saved = load<Partial<StockManagementConfig>>("settings", {});
  _settings = deepMerge(DEFAULT_CONFIG, saved);
  if (Object.keys(saved).length === 0) saveConfig(_settings);
  return _settings;
}

export function saveConfig(settings: StockManagementConfig): void {
  _settings = settings;
  save("settings", settings);
}

export function updateConfig(partial: DeepPartial<StockManagementConfig>): StockManagementConfig {
  const updated = deepMerge(loadConfig(), partial);
  saveConfig(updated);
  return updated;
}

export function resetSettings(): StockManagementConfig {
  saveConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

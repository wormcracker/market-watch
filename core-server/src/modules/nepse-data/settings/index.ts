import fs from "fs";
import { DEFAULT_SETTINGS, NepseDataConfig, NepseDataSetting } from "./defaults";
import { readJson, writeJson } from "@shared/fs";
import { CONFIG_FILE } from "../constants";
import { systemEvents } from "@shared/events";
import { logger } from "@shared/logger";

let _currentSettings: NepseDataSetting = DEFAULT_SETTINGS;
let _watcherAttached = false;
let initialized = false;

function mergeWithDefaults(partial: Partial<NepseDataSetting> = {}): NepseDataSetting {
  return { ...DEFAULT_SETTINGS, ...partial };
}

function repairConfigFile(): void {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return;
    const timestamp = Date.now();
    const backupPath = CONFIG_FILE.replace("settings.json", `settings_${timestamp}.json`);
    const corrupted = fs.readFileSync(CONFIG_FILE, "utf-8");
    fs.writeFileSync(backupPath, corrupted, "utf-8");
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ "nepse-data-setting": DEFAULT_SETTINGS }, null, 2), "utf-8");
    logger.info("nepse:settings", "Backup created", { backupPath });
  } catch (err) {
    logger.error("nepse:settings", "Backup failed", err);
  }
}

export function loadSettings(): NepseDataSetting {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      writeJson(CONFIG_FILE, { "nepse-data-setting": DEFAULT_SETTINGS });
      _currentSettings = DEFAULT_SETTINGS;
      initialized = true;
      watchSettings();
      return _currentSettings;
    }
    const parsed = readJson<NepseDataConfig>(CONFIG_FILE);
    if (parsed === null) {
      logger.error("nepse:settings", "Corrupt or missing config. Repairing...");
      repairConfigFile();
      _currentSettings = DEFAULT_SETTINGS;
    } else {
      _currentSettings = mergeWithDefaults(parsed["nepse-data-setting"] ?? {});
    }
    watchSettings();
    initialized = true;
    logger.info("nepse:settings", "Loaded successfully");
    return _currentSettings;
  } catch (err) {
    logger.error("nepse:settings", "Load failed", err);
    _currentSettings = DEFAULT_SETTINGS;
    return _currentSettings;
  }
}

export function getSettings(): NepseDataSetting {
  if (!initialized) throw new Error("Settings not initialized. Call loadSettings() first.");
  return _currentSettings;
}

function watchSettings(): void {
  if (_watcherAttached) return;
  if (!fs.existsSync(CONFIG_FILE)) return;
  _watcherAttached = true;
  fs.watch(CONFIG_FILE, (eventType) => {
    if (eventType !== "change") return;
    logger.info("nepse:settings", "Change detected — reloading...");
    const parsed = readJson<NepseDataConfig>(CONFIG_FILE);
    if (parsed === null) {
      logger.error("nepse:settings", "Reload failed — keeping current settings");
    } else {
      _currentSettings = mergeWithDefaults(parsed["nepse-data-setting"] ?? {});
      logger.info("nepse:settings", "Reloaded successfully");
      systemEvents.emit("system:info", { module: "nepse:settings", message: "settings:changed" });
    }
  });
}

export function saveSettings(updates: Partial<NepseDataSetting>): NepseDataSetting {
  const updated = { "nepse-data-setting": { ..._currentSettings, ...updates } };
  writeJson(CONFIG_FILE, updated);
  _currentSettings = updated["nepse-data-setting"];
  logger.info("nepse:settings", "Saved to disk");
  systemEvents.emit("system:info", { module: "nepse:settings", message: "settings:changed" });
  return _currentSettings;
}

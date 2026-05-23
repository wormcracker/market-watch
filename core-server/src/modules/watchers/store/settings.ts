// src/store/settings.ts
import { load, save } from "./core";
import { Settings } from "../types";

let _settings: Settings | null = null;

const DEFAULT_SETTINGS: Settings = {
  defaultIntervalSec: 60,
  jitterFraction: 0.35,
  maxConcurrent: 5,
  perDomainDelayMs: 3000,
  requestTimeoutSec: 8,
  alertCooldownSec: 0,

  maxAlerts: 1000,
  maxHistory: 500,

  notifPersists: true,
  macBackend: "osascript",

  truncate: false,
  truncateLen: 60,

  notifTemplate: "",

  osNotifications: true,
  osTemplate: null,

  playSound: true,

  macSound: "Glass",
  macVolumeLevel: 1,
  customSound: null,
  customVolumeLevel: 0.25,

  enabledChannels: {
    webhook: false,
    ntfy: false,
    discord: false,
    slack: false,
    telegram: false,
  },

  notifications: {
    webhook: null,
    discord: null,
    slack: null,
    ntfy: null,
    telegram: {
      token: "",
      chatId: "",
    },
  },
};

function isObject(val: any): val is Record<string, any> {
  return val && typeof val === "object" && !Array.isArray(val);
}

function deepMerge<T>(base: T, patch: any): T {
  const output: any = { ...base };

  for (const key of Object.keys(patch || {})) {
    const b = (base as any)[key];
    const p = patch[key];

    if (isObject(b) && isObject(p)) {
      output[key] = deepMerge(b, p);
    } else {
      output[key] = p;
    }
  }

  return output;
}

export function loadSettings(): Settings {
  if (_settings) return _settings;
  const saved = load<Partial<Settings>>("settings", {});
  _settings = deepMerge(DEFAULT_SETTINGS, saved);
  return _settings;
}

// internal
export function saveSettings(settings: Settings): void {
  _settings = settings;
  save("settings", settings);
}

export function updateSettings(partial: Partial<Settings>): Settings {
  const updated = deepMerge(loadSettings(), partial);
  saveSettings(updated);
  return updated;
}

export function resetSettings(): Settings {
  saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

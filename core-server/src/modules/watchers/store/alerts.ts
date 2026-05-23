// src/store/alerts.ts
import { load, save } from "./core";
import { Alert } from "../types";
import { loadSettings } from "./settings";

let _alerts: Alert[] | null = null;

export function loadAlerts(): Alert[] {
  if (_alerts === null) _alerts = load<Alert[]>("alerts", []);
  return _alerts;
}

export function saveAlerts(alerts: Alert[]) {
  _alerts = alerts;
  save<Alert[]>("alerts", alerts);
}

export function pushAlert(alert: Alert): void {
  const alerts = loadAlerts();
  const { maxAlerts } = loadSettings();
  alerts.unshift(alert);
  if (alerts.length > maxAlerts) alerts.pop();
  saveAlerts(alerts);
}

export function markAlertsRead(ids: string[]): void {
  const alerts = loadAlerts();
  const set = new Set(ids);

  for (const alert of alerts) {
    if (set.has(alert.id) && !alert.readAt) {
      alert.readAt = new Date().toISOString();
    }
  }

  saveAlerts(alerts);
}

export function clearAlerts(watchId?: string): void {
  const alerts = loadAlerts();

  const filtered = watchId ? alerts.filter((a) => a.watchId !== watchId) : [];

  saveAlerts(filtered);
}

export function getAlert(alertId: string): Alert | null {
  const alerts = loadAlerts();
  return alerts.find((a) => a.id === alertId) ?? null;
}

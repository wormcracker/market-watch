// src/store/history.ts
import { load, save } from "./core";
import { History, HistoryEntry } from "../types";
import { loadSettings } from "./settings";

let _history: History | null = null;

export function loadHistory(): History {
  if (_history === null) _history = load<History>("history", {});
  return _history;
}

export function saveHistory(history: History) {
  _history = history;
  save<History>("history", history);
}

export function pushHistory(watchId: string, entry: HistoryEntry): void {
  const history = loadHistory();

  if (!history[watchId]) {
    history[watchId] = [];
  }

  history[watchId].unshift(entry);

  const { maxHistory } = loadSettings();

  if (history[watchId].length > maxHistory) {
    history[watchId].pop();
  }

  saveHistory(history);
}

export function getHistory(watchId: string, limit = 100): HistoryEntry[] {
  const history = loadHistory();
  return history[watchId]?.slice(0, limit) ?? [];
}

export function clearHistory(watchId?: string): void {
  const history = loadHistory();

  if (watchId) {
    delete history[watchId];
    saveHistory(history);
    return;
  }

  saveHistory({});
}

// src/store/watches.ts

import { load, save } from "./core";
import { Watch } from "../types";

let _watches: Watch[] | null = null;

export function loadWatches(): Watch[] {
  if (_watches === null) _watches = load<Watch[]>("watches", []);
  return _watches;
}

export function saveWatches(watches: Watch[]): void {
  _watches = watches;
  save<Watch[]>("watches", watches);
}

export function getWatch(id: string): Watch | null {
  const data = loadWatches();
  if (!id || data.length === 0) return null;

  return data.find((w) => w.id === id) ?? null;
}

export function getWatchByName(name: string): Watch | null {
  const data = loadWatches();
  if (!name || data.length === 0) return null;

  return data.find((w) => w.name === name) ?? null;
}

export function upsertWatch(watch: Watch): void {
  const data = loadWatches();
  const index = data.findIndex((w) => w.id === watch.id);

  if (index === -1) data.push(watch);
  else data[index] = watch;

  saveWatches(data);
}

export function deleteWatch(id: string): void {
  const data = loadWatches();
  const filtered = data.filter((w) => w.id !== id);

  if (filtered.length !== data.length) {
    saveWatches(filtered);
  }
}

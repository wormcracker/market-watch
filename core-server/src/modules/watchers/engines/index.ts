// /src/engine/index.ts
import type { Engine, FetchResult, Watch } from "../types";
import { fetchWithHttp } from "./http.engine";
import {
  fetchWithNepse,
  startNepseEngine,
  stopNepseEngine,
} from "./nepse.engine";
import { fetchWithPuppeteer, stopPuppeteerEngine } from "./puppeteer.engine";

type Lifecycle = {
  start?: () => void | Promise<void>;
  stop?: () => void | Promise<void>;
  fetch?: (watch: any) => Promise<FetchResult>;
};

const engines: Record<Engine, Lifecycle> = {
  http: { fetch: fetchWithHttp },
  nepse: {
    fetch: fetchWithNepse,
    start: startNepseEngine,
    stop: stopNepseEngine,
  },
  puppeteer: { fetch: fetchWithPuppeteer, stop: stopPuppeteerEngine },
};

// ── Per-watch fetch ───────────────────────────────────────────────────────────
export function fetchValue(watch: Watch): Promise<FetchResult> {
  const engine = engines[watch.engine];
  if (!engine?.fetch)
    throw new Error(`Unknown or invalid engine: "${watch.engine}"`);
  return engine.fetch(watch);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
export function startEngine(engine: Engine): void {
  engines[engine]?.start?.();
}

export async function stopEngine(engine: Engine): Promise<void> {
  await engines[engine]?.stop?.();
}

export function startAllEngines(): void {
  (Object.keys(engines) as Engine[]).forEach((e) => engines[e]?.start?.());
}

export async function stopAllEngines(): Promise<void> {
  for (const e of Object.keys(engines) as Engine[]) {
    await engines[e]?.stop?.();
  }
}

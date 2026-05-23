// /src/engine/puppeteer.engine.ts

import puppeteer, { Browser, Page } from "puppeteer";
import type { FetchResult, Watch } from "../types";
import { loadSettings } from "../store";

type PuppeteerWatch = Extract<Watch, { engine: "puppeteer" }>;

// ── Browser singleton ─────────────────────────────────────────────────────────

let _browser: Browser | null = null;

const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 5 minutes

let idleTimer: NodeJS.Timeout | null = null;

function resetIdleTimer() {
  // clear previous timer
  if (idleTimer) {
    clearTimeout(idleTimer);
  }

  // start new timer
  idleTimer = setTimeout(async () => {
    await stopPuppeteerEngine();
  }, IDLE_TIMEOUT_MS);
}

async function getBrowser(): Promise<Browser> {
  if (_browser === null || !_browser.isConnected()) {
    _browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  // browser is being actively used
  resetIdleTimer();

  return _browser;
}

// ── Public: fetch ─────────────────────────────────────────────────────────────

export async function fetchWithPuppeteer(
  watch: PuppeteerWatch,
): Promise<FetchResult> {
  const { requestTimeoutSec } = loadSettings();
  const timeoutMs = requestTimeoutSec * 1000;

  const browser = await getBrowser();

  let page: Page | null = null;

  try {
    page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    );

    await page.goto(watch.url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    if (watch.waitFor) {
      await page.waitForSelector(watch.waitFor, {
        timeout: timeoutMs,
      });
    }

    const raw = watch.attribute
      ? await page.$eval(
          watch.selector,
          (el, attr) => el.getAttribute(attr) ?? "",
          watch.attribute,
        )
      : await page.$eval(watch.selector, (el) => el.textContent?.trim() ?? "");

    const value = raw.trim();

    if (!value) {
      throw new Error(
        `Selector "${watch.selector}" found element but extracted empty value`,
      );
    }

    return {
      value,
      source: "puppeteer",
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    await page?.close();

    // still considered activity
    resetIdleTimer();
  }
}

// ── Public: stop ──────────────────────────────────────────────────────────────

export async function stopPuppeteerEngine(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

// src/engine/http.engine.ts

import * as https from "https";
import * as http from "http";
import * as zlib from "zlib";
import * as cheerio from "cheerio";
import type { FetchResult, Watch } from "../types";
import { loadSettings } from "../store";

type HttpWatch = Extract<Watch, { engine: "http" }>;

// ─────────────────────────────────────────────
// User agents (same idea as old stealth.js)
// ─────────────────────────────────────────────
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function pickUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ─────────────────────────────────────────────
// Cookie jar (per host)
// ─────────────────────────────────────────────
const cookieJar = new Map<string, Map<string, string>>();

function storeCookies(host: string, setCookie?: string | string[]) {
  if (!setCookie) return;

  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

  if (!cookieJar.has(host)) cookieJar.set(host, new Map());
  const jar = cookieJar.get(host)!;

  for (const c of cookies) {
    const pair = c.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx === -1) continue;

    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();

    jar.set(name, value);
  }
}

function getCookieHeader(host: string): string | null {
  const jar = cookieJar.get(host);
  if (!jar || jar.size === 0) return null;
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function clearCookies(host: string) {
  cookieJar.delete(host);
}

// ─────────────────────────────────────────────
// HTTP request (old engine core logic)
// ─────────────────────────────────────────────
async function request(
  url: string,
  options: { referer?: string; timeoutMs?: number } = {},
  depth = 0,
  visited = new Set<string>(),
): Promise<{ body: string; status: number; headers: any }> {
  if (depth > 6) throw new Error("Too many redirects");
  if (visited.has(url)) throw new Error("Redirect loop");
  visited.add(url);

  const parsed = new URL(url);
  const lib = parsed.protocol === "https:" ? https : http;

  const cookies = getCookieHeader(parsed.hostname);

  const headers: Record<string, string> = {
    "User-Agent": pickUA(),
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    ...(options.referer ? { Referer: options.referer } : {}),
    ...(cookies ? { Cookie: cookies } : {}),
  };

  const timeoutMs = options.timeoutMs ?? 15000;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers,
      },
      (res) => {
        storeCookies(parsed.hostname, res.headers["set-cookie"]);

        // ─────────────────────────────
        // Redirect handling
        // ─────────────────────────────
        if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0)) {
          const loc = res.headers.location;
          if (!loc) return reject(new Error("Redirect missing location"));

          const next = new URL(loc, url).href;

          res.resume();
          return request(next, { ...options, referer: url }, depth + 1, visited)
            .then(resolve)
            .catch(reject);
        }

        if (!res.statusCode || res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        // ─────────────────────────────
        // Compression
        // ─────────────────────────────
        const enc = res.headers["content-encoding"];
        let stream: any = res;

        if (enc === "gzip") stream = res.pipe(zlib.createGunzip());
        else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());
        else if (enc === "deflate") stream = res.pipe(zlib.createInflate());

        let body = "";
        stream.setEncoding("utf8");

        stream.on("data", (c: string) => (body += c));
        stream.on("end", () =>
          resolve({
            body,
            status: res.statusCode!,
            headers: res.headers,
          }),
        );

        stream.on("error", reject);
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Timeout"));
    });

    req.on("error", reject);
    req.end();
  });
}

async function sessionRequest(url: string, timeoutMs: number) {
  const seed = new URL(url).origin;

  try {
    await request(seed, { timeoutMs }); // warmup
  } catch {}

  return await request(url, {
    timeoutMs,
    referer: seed,
  });
}

// ─────────────────────────────────────────────
// HTML extraction (from your current engine)
// ─────────────────────────────────────────────
function extractValue(html: string, watch: any): string {
  const $ = cheerio.load(html);

  const elements = $(watch.selector);
  if (!elements.length) {
    throw new Error(`Selector "${watch.selector}" matched nothing`);
  }

  const idx = watch.index ?? 0;
  const el = elements.eq(idx);

  const raw = watch.attribute ? el.attr(watch.attribute) : el.text();

  const value = (raw ?? "").trim();
  if (!value) throw new Error("Empty extraction result");

  return value;
}

// ─────────────────────────────────────────────
// Public engine
// ─────────────────────────────────────────────
export async function fetchWithHttp(watch: HttpWatch): Promise<FetchResult> {
  const { requestTimeoutSec } = loadSettings();

  const timeoutMs = requestTimeoutSec * 1000;

  let res;

  try {
    res = await sessionRequest(watch.url, timeoutMs);
  } catch (e) {
    clearCookies(new URL(watch.url).hostname);

    try {
      res = await sessionRequest(watch.url, timeoutMs);
    } catch (err) {
      throw new Error(`HTTP fetch failed after retry: ${String(err)}`);
    }
  }
  const value = extractValue(res.body, watch);

  return {
    value,
    source: "http",
    fetchedAt: new Date().toISOString(),
  };
}

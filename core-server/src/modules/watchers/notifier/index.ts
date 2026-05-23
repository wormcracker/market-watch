import { logger } from "@shared/logger";
import { systemEvents } from "@shared/events";
// /src/notifier/index.ts

import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import type { Alert, Settings } from "../types";
import { loadSettings, pushAlert } from "../store";
import { readFile } from "fs/promises";

// ═══════════════════════════════════════════════════════════════
// SECTION 1: HELPERS
// ═══════════════════════════════════════════════════════════════

// ── Logging ───────────────────────────────────────────────────
const log =
  (channel: string) =>
  (err: unknown): void => {
    logger.error("watchers:notifier", `${channel} failed`, err);
  };

// ── AppleScript string escaping ───────────────────────────────
function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ── Numeric parser ────────────────────────────────────────────
const n = (v: string): number =>
  parseFloat(
    String(v)
      .replace(/,/g, "")
      .replace(/[^\d.\-]/g, ""),
  );

// ── HTML parser ────────────────────────────────────────────
function stripHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function trunc(v: unknown, settings: Settings): string {
  const s = stripHtml(v);
  const { truncate, truncateLen } = settings;
  if (truncate) {
    return s.length > truncateLen ? s.slice(0, truncateLen) + "…" : s;
  }
  return s;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 2: TEMPLATE RENDERING
// ═══════════════════════════════════════════════════════════════
export function renderTemplate(
  template: string | null | undefined,
  alert: Alert,
): string {
  if (!template || !template.trim()) return alert.message;

  const cur = alert.currentValue;
  const prev = alert.prevValue;

  // ── Calculate % change ──────────────────────────────────────
  let changeStr = "N/A";
  let directionStr = "→";

  if (prev !== null) {
    const cn = n(cur);
    const pn = n(prev);

    if (!isNaN(cn) && !isNaN(pn) && pn !== 0) {
      const pct = ((cn - pn) / Math.abs(pn)) * 100;
      changeStr = pct.toFixed(2) + "%";
      directionStr = pct > 0 ? "▲" : pct < 0 ? "▼" : "→";
    }
  }

  // ── Replace all tokens ──────────────────────────────────────
  return template
    .replace(/\{\{id\}\}/g, alert.id)
    .replace(/\{\{watchName\}\}/g, alert.watchName)
    .replace(/\{\{watchId\}\}/g, alert.watchId)
    .replace(/\{\{conditionType\}\}/g, alert.condition.type)
    .replace(/\{\{url\}\}/g, alert.url ?? "")
    .replace(/\{\{message\}\}/g, alert.message)
    .replace(/\{\{firedAt\}\}/g, alert.firedAt)
    .replace(/\{\{value\}\}/g, cur)
    .replace(/\{\{prevValue\}\}/g, prev ?? "N/A")
    .replace(/\{\{change\}\}/g, changeStr)
    .replace(/\{\{direction\}\}/g, directionStr);
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3: HTTP POST HELPER
// ═══════════════════════════════════════════════════════════════
function httpPost(
  url: string,
  body: string,
  extraHeaders: Record<string, string> = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      // Invalid URL — reject immediately, no network attempt
      reject(new Error(`Invalid URL: "${url}"`));
      return;
    }

    const isHttps = parsed.protocol === "https:";
    const bodyBytes = Buffer.byteLength(body);

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": bodyBytes.toString(),
        ...extraHeaders,
      },
    };

    // Choose http or https module based on protocol
    const transport = isHttps ? https : http;

    const req = transport.request(options, (res) => {
      res.on("data", () => {});

      res.on("end", () => {
        if (!res.statusCode || res.statusCode >= 400) {
          reject(
            new Error(
              `HTTP ${res.statusCode} from ${parsed.hostname}${parsed.pathname}`,
            ),
          );
        } else {
          resolve();
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════
// SECTION 4: OS NOTIFICATION (macOS)
// ═══════════════════════════════════════════════════════════════

const SOUND_DIR = process.env.SOUND_DIR ?? path.join(process.cwd(), "sounds");

const SYSTEM_SOUND_DIR = "/System/Library/Sounds/";

function resolveSound(alert: Alert, settings: Settings) {
  if (!settings.playSound) return null;

  const custom = alert.customSound || settings.customSound || null;
  const system = alert.macSound || settings.macSound || null;

  const clampVolume = (v?: number) =>
    typeof v === "number" && v >= 0 && v <= 1 ? v : 1;

  if (custom) {
    const full = path.isAbsolute(custom)
      ? custom
      : path.join(SOUND_DIR, custom);
    const volume = clampVolume(settings.customVolumeLevel);
    if (fs.existsSync(full)) {
      return { type: "custom" as const, path: full, custom, volume };
    }
    // Custom file not found — fall through to system sound rather than silently failing
    logger.warn(
      "watchers:notifier",
      `Custom sound file not found: ${full} — falling back to system sound`,
    );
  }

  if (system) {
    const volume = clampVolume(settings.macVolumeLevel);
    const full = path.join(SYSTEM_SOUND_DIR, `${system}.aiff`);
    return { type: "system" as const, path: full, system, volume };
  }

  return null;
}

async function getConsoleUID(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("stat", ["-f", "%u", "/dev/console"], (err, stdout) => {
      const uid = stdout?.trim();
      resolve(!err && uid && uid !== "0" ? uid : null);
    });
  });
}

async function runAsUser(uid: string, command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile("launchctl", ["asuser", uid, command, ...args], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ── osascript backend ─────────────────────────────────────────
async function sendOsAppleScript(
  alert: Alert,
  settings: Settings,
  message: string,
): Promise<void> {
  if (process.platform !== "darwin") return;

  const uid = await getConsoleUID();
  if (!uid) return;

  const title = escapeAppleScript(alert.watchName);
  const body = escapeAppleScript(trunc(message, settings));
  const url = alert.url ?? "";
  const server_path = process.env.SERVER_PATH ?? "http://localhost";
  const port = parseInt(process.env.PORT ?? "3020", 10);

  const sound = resolveSound(alert, settings);
  if (sound) {
    const args = [
      "asuser",
      uid,
      "afplay",
      "-v",
      String(sound.volume),
      sound.path,
    ];
    execFile("launchctl", args, (err) => {
      if (err) logger.warn("watchers:notifier", `afplay error: ${err.message}`);
    });
  }

  let script = "";

  if (settings.notifPersists) {
    const markReadUrl = `${server_path}:${port}/api/watchers/alerts/${alert.id}/read`;
    script = `
set res to display dialog "${body}" with title "${title}" buttons {"Mark Read", "Open", "Dismiss"} default button "Dismiss"
if button returned of res is "Open" then
  open location "${url}"
else if button returned of res is "Mark Read" then
  do shell script "curl -X PATCH ${markReadUrl} > /dev/null 2>&1"
end if
`;
  } else {
    script = `
display notification "${body}" with title "${title}"
`;
  }

  const tmp = path.join(os.tmpdir(), `notify_${Date.now()}.applescript`);
  fs.writeFileSync(tmp, script);

  try {
    await runAsUser(uid, "osascript", [tmp]);
  } finally {
    fs.unlink(tmp, () => {}); // async, fire-and-forget, won't throw
  }
}

// ── node-notifier backend ─────────────────────────────────────
async function sendOsNodeNotifier(
  alert: Alert,
  settings: Settings,
  message: string,
): Promise<void> {
  let notifier: any;
  try {
    notifier = require("node-notifier");
  } catch {
    throw new Error(
      "[Notifier] node-notifier not installed. Run: npm install node-notifier",
    );
  }
  let sound = resolveSound(alert, settings);
  if (sound?.type === "system" && process.platform !== "darwin") {
    sound = null;
  }
  return new Promise((resolve, reject) => {
    notifier.notify(
      {
        title: alert.watchName,
        message: message,
        sound: sound?.path,
        wait: settings.notifPersists ?? false,
      },
      (err: unknown) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

// ── OS dispatcher: routes to correct backend ──────────────────
async function sendOs(
  alert: Alert,
  settings: Settings,
  message: string,
): Promise<void> {
  if (process.platform === "darwin") {
    if (settings.macBackend === "node-notifier") {
      await sendOsNodeNotifier(alert, settings, message);
    } else {
      await sendOsAppleScript(alert, settings, message);
    }
  } else {
    await sendOsNodeNotifier(alert, settings, message);
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 5: REMOTE CHANNELS
// ═══════════════════════════════════════════════════════════════

async function sendKdeConnect(message: string): Promise<void> {
  if (process.platform !== "darwin") return;
  const deviceId = process.env.KDE_CONNECT_DEVICE_ID;
  const kdeUser = process.env.KDE_CONNECT_USER;
  if (!deviceId || !kdeUser) return;
  const safeMessage = message.replace(/\n+/g, " ");

  let dbusAddress: string;
  try {
    dbusAddress = (await readFile("/tmp/private_dbus_address", "utf8")).trim();
  } catch {
    logger.info(
      "watchers:notifier",
      "KDE Connect failed: could not read D-Bus address",
    );
    return;
  }

  execFile(
    "sudo",
    [
      "-u",
      kdeUser,
      "env",
      `DBUS_SESSION_BUS_ADDRESS=${dbusAddress}`,
      "/Applications/KDE Connect.app/Contents/MacOS/kdeconnect-cli",
      "-d",
      deviceId,
      "--ping-msg",
      safeMessage,
    ],
    (err, _stdout, stderr) => {
      if (err) {
        const output = stderr || err.message;
        if (!output.includes("ServiceUnknown")) {
          logger.info("watchers:notifier", `KDE Connect failed: ${output}`);
        }
        return;
      }
      logger.info("watchers:notifier", "KDE Connect sent");
    },
  );
}

async function sendNtfy(
  alert: Alert,
  topic: string,
  message: string,
): Promise<void> {
  await httpPost(topic, message, {
    Title: alert.watchName,
    Priority: "default",
  });
}

async function sendDiscord(
  alert: Alert,
  webhookUrl: string,
  message: string,
): Promise<void> {
  await httpPost(
    webhookUrl,
    JSON.stringify({ content: `**${alert.watchName}**\n${message}` }),
  );
}

async function sendSlack(
  alert: Alert,
  webhookUrl: string,
  message: string,
): Promise<void> {
  await httpPost(
    webhookUrl,
    JSON.stringify({ text: `*${alert.watchName}*\n${message}` }),
  );
}

async function sendTelegram(
  alert: Alert,
  config: { token: string; chatId: string },
  message: string,
): Promise<void> {
  sendKdeConnect(message);
  await httpPost(
    `https://api.telegram.org/bot${config.token}/sendMessage`,
    JSON.stringify({
      chat_id: config.chatId,
      text: `<b>${alert.watchName}</b>\n${message}`,
      parse_mode: "HTML",
    }),
  );
}

async function sendWebhook(
  alert: Alert,
  url: string,
  message: string,
): Promise<void> {
  await httpPost(
    url,
    JSON.stringify({
      ...alert,
      renderedMessage: message,
    }),
  );
}

// ═══════════════════════════════════════════════════════════════
// SECTION 6: MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════

export async function notify(alert: Alert): Promise<void> {
  const alertCopy = { ...alert };
  pushAlert(alertCopy);
  emitAlertFired(alertCopy, alertCopy.message);

  const settings = loadSettings();
  const { notifications: nc, enabledChannels: ch } = settings;

  const baseMessage = renderTemplate(
    settings.notifTemplate ?? "{{message}}",
    alertCopy,
  );

  const osMessage = renderTemplate(
    settings.osTemplate ?? settings.notifTemplate ?? "{{message}}",
    alertCopy,
  );

  const safe = (msg: string) =>
    settings.truncate ? msg.slice(0, settings.truncateLen) : msg;

  const message = safe(baseMessage);
  const osMessageSafe = safe(osMessage);

  const tasks: Promise<void>[] = [];

  if (settings.osNotifications) {
    tasks.push(sendOs(alertCopy, settings, osMessageSafe).catch(log("os")));
  }

  if (ch.ntfy && nc.ntfy) {
    tasks.push(sendNtfy(alertCopy, nc.ntfy, message).catch(log("ntfy")));
  }

  if (ch.discord && nc.discord) {
    tasks.push(
      sendDiscord(alertCopy, nc.discord, message).catch(log("discord")),
    );
  }

  if (ch.slack && nc.slack) {
    tasks.push(sendSlack(alertCopy, nc.slack, message).catch(log("slack")));
  }

  if (ch.telegram && nc.telegram?.token && nc.telegram?.chatId) {
    tasks.push(
      sendTelegram(alertCopy, nc.telegram, message).catch(log("telegram")),
    );
  }

  if (ch.webhook && nc.webhook) {
    tasks.push(
      sendWebhook(alertCopy, nc.webhook, message).catch(log("webhook")),
    );
  }

  if (tasks.length === 0) {
    logger.warn("watchers:notifier", "No channels enabled");
    return;
  }

  const results = await Promise.allSettled(tasks);

  for (const r of results) {
    if (r.status === "rejected") {
      logger.warn("watchers:notifier", "Channel error", r.reason);
    }
  }
}

// Emit to systemEvents for WebSocket broadcast
export function emitAlertFired(alert: Alert, message: string): void {
  systemEvents.emit("alert:fired", {
    watchId: alert.watchId,
    watchName: alert.watchName,
    message,
    value: alert.currentValue,
    firedAt: alert.firedAt,
  });
}

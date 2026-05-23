// shared/logger.ts

type LogLevel = "info" | "warn" | "error" | "debug";

function log(
  level: LogLevel,
  module: string,
  message: string,
  data?: unknown,
): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${module}]`;

  if (data !== undefined) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export const logger = {
  info: (module: string, message: string, data?: unknown) =>
    log("info", module, message, data),
  warn: (module: string, message: string, data?: unknown) =>
    log("warn", module, message, data),
  error: (module: string, message: string, data?: unknown) =>
    log("error", module, message, data),
  debug: (module: string, message: string, data?: unknown) =>
    log("debug", module, message, data),
};

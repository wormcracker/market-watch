import fs from "fs";
import { logger } from "./logger";

// 1. Ensure a directory exists (create if missing)
export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
  logger.debug("fs", `Ensured directory: ${dirPath}`);
}

// 2. Read a JSON file safely — return null if missing or corrupt
export function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    logger.info("fs", `File not found: ${filePath}`);
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.error("fs", `Failed to parse JSON: ${filePath}`, err);
    return null;
  }
}

// 3. Write JSON atomically (.tmp → rename)
export function writeJson(filePath: string, data: unknown): void {
  const tmpFilePath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmpFilePath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpFilePath, filePath);
  } catch (err) {
    logger.error("fs", `Failed to write file: ${filePath}`, err);
    try {
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
    } catch (cleanupErr) {
      logger.error("fs", `Fail to Cleanup tmp File:${tmpFilePath}`, cleanupErr);
    }
  }
}

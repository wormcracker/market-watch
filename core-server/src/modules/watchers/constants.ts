import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data", "watchers");
export const CONFIG_FILE = path.join(
  process.cwd(),
  "config",
  "watchers",
  "settings.json",
);
export const SOUND_DIR =
  process.env.SOUND_DIR ?? path.join(process.cwd(), "sounds");

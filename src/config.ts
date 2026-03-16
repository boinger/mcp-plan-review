import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface Config {
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
}

const CONFIG_PATH = join(homedir(), ".config", "mcp-plan-review", "config.json");

let cachedConfig: Config | null = null;

export function resetConfigCache(): void {
  cachedConfig = null;
}

export function loadConfig(): Config {
  if (cachedConfig) return cachedConfig;

  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    cachedConfig = JSON.parse(raw) as Config;
    return cachedConfig;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      // No config file — return empty defaults (all fields fall through to env vars)
      cachedConfig = {};
      return cachedConfig;
    }
    // Config file exists but is unreadable or has invalid JSON
    throw err;
  }
}

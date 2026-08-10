import type { Settings } from "../types";

const KEY = "orbeat_settings";

export function readSettings(): Settings | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.apiKey === "string" &&
      typeof parsed.username === "string" &&
      parsed.apiKey &&
      parsed.username
    ) {
      return parsed as Settings;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSettings(settings: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export function clearSettings(): void {
  localStorage.removeItem(KEY);
}

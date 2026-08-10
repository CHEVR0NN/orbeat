import { describe, it, expect, beforeEach } from "vitest";
import { readSettings, writeSettings, clearSettings } from "./settings";

describe("settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing stored", () => {
    expect(readSettings()).toBeNull();
  });

  it("round-trips a written settings object", () => {
    writeSettings({ apiKey: "abc123", username: "kai" });
    expect(readSettings()).toEqual({ apiKey: "abc123", username: "kai" });
  });

  it("returns null for malformed stored data", () => {
    localStorage.setItem("orbeat_settings", "{not json");
    expect(readSettings()).toBeNull();
  });

  it("returns null after clearSettings", () => {
    writeSettings({ apiKey: "abc123", username: "kai" });
    clearSettings();
    expect(readSettings()).toBeNull();
  });
});

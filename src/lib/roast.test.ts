import { describe, it, expect } from "vitest";
import { generateRoasts } from "./roast";
import type { ScrobbleEvent } from "../types";

function scrobbleAt(dateStr: string): ScrobbleEvent {
  return { artist: "Some Artist", timestamp: new Date(dateStr).getTime() };
}

function scrobbleFor(artist: string, dateStr: string): ScrobbleEvent {
  return { artist, timestamp: new Date(dateStr).getTime() };
}

function idsOf(scrobbles: ScrobbleEvent[]): string[] {
  return generateRoasts(scrobbles).map((r) => r.id);
}

describe("generateRoasts", () => {
  it("fires the streak roast for a 7+ day gap-free run", () => {
    const scrobbles: ScrobbleEvent[] = [];
    for (let day = 1; day <= 8; day++) {
      for (const hour of [9, 12, 15]) {
        scrobbles.push(scrobbleFor(`Artist${hour}`, `2026-08-0${day}T${String(hour).padStart(2, "0")}:00:00`));
      }
    }
    const roasts = generateRoasts(scrobbles);
    const streakRoast = roasts.find((r) => r.id === "streak");
    expect(streakRoast).toBeDefined();
    expect(streakRoast!.text).toContain("8-day streak");
  });

  it("fires the short-streak roast when the streak never exceeds a day", () => {
    const scrobbles: ScrobbleEvent[] = [];
    for (let hour = 0; hour < 20; hour++) {
      scrobbles.push(scrobbleFor(`Artist${hour}`, `2026-08-01T${String(hour).padStart(2, "0")}:00:00`));
    }
    const roasts = generateRoasts(scrobbles);
    const roast = roasts.find((r) => r.id === "short-streak");
    expect(roast).toBeDefined();
    expect(roast!.text).toContain("1 day");
  });

  it("fires the night owl archetype roast with the real peak-hour range", () => {
    const scrobbles: ScrobbleEvent[] = [];
    for (let day = 1; day <= 20; day++) {
      scrobbles.push(scrobbleFor(`Artist${day}`, `2026-08-${String(day).padStart(2, "0")}T23:00:00`));
    }
    const roasts = generateRoasts(scrobbles);
    const roast = roasts.find((r) => r.id === "archetype-night-owl");
    expect(roast).toBeDefined();
    expect(roast!.text).toContain("10pm to 3am");
  });

  it("fires the early bird archetype roast with the real peak-hour range", () => {
    const scrobbles: ScrobbleEvent[] = [];
    for (let day = 1; day <= 20; day++) {
      scrobbles.push(scrobbleFor(`Artist${day}`, `2026-08-${String(day).padStart(2, "0")}T06:00:00`));
    }
    const roasts = generateRoasts(scrobbles);
    const roast = roasts.find((r) => r.id === "archetype-early-bird");
    expect(roast).toBeDefined();
    expect(roast!.text).toContain("before 9am");
  });

  it("fires the nine-to-fiver archetype roast", () => {
    const scrobbles: ScrobbleEvent[] = [];
    for (let day = 1; day <= 20; day++) {
      scrobbles.push(scrobbleFor(`Artist${day}`, `2026-08-${String(day).padStart(2, "0")}T12:00:00`));
    }
    expect(idsOf(scrobbles)).toContain("archetype-nine-to-fiver");
  });

  it("fires the evening wind-down archetype roast", () => {
    const scrobbles: ScrobbleEvent[] = [];
    for (let day = 1; day <= 20; day++) {
      scrobbles.push(scrobbleFor(`Artist${day}`, `2026-08-${String(day).padStart(2, "0")}T19:00:00`));
    }
    expect(idsOf(scrobbles)).toContain("archetype-evening");
  });

  it("fires the weekday-heavy roast when weekdays dominate", () => {
    const scrobbles: ScrobbleEvent[] = [];
    const weekdayDates = ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"];
    for (const date of weekdayDates) {
      for (let i = 0; i < 4; i++) scrobbles.push(scrobbleFor(`Artist${i}`, `${date}T${10 + i}:00:00`));
    }
    scrobbles.push(scrobbleAt("2026-08-15T10:00:00")); // Saturday
    scrobbles.push(scrobbleAt("2026-08-16T10:00:00")); // Sunday
    const roasts = generateRoasts(scrobbles);
    expect(roasts.some((r) => r.id === "weekday-heavy")).toBe(true);
    expect(roasts.some((r) => r.id === "weekend-heavy")).toBe(false);
  });

  it("fires the weekend-heavy roast with the real ratio when weekends dominate", () => {
    const scrobbles: ScrobbleEvent[] = [];
    const weekdayDates = ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"];
    for (const date of weekdayDates) scrobbles.push(scrobbleAt(`${date}T10:00:00`));
    for (let i = 0; i < 6; i++) scrobbles.push(scrobbleFor(`Artist${i}`, `2026-08-15T${10 + i}:00:00`));
    for (let i = 0; i < 6; i++) scrobbles.push(scrobbleFor(`Artist${i}`, `2026-08-16T${10 + i}:00:00`));
    const roasts = generateRoasts(scrobbles);
    const roast = roasts.find((r) => r.id === "weekend-heavy");
    expect(roast).toBeDefined();
    expect(roast!.text).toContain("6x more");
    expect(roasts.some((r) => r.id === "weekday-heavy")).toBe(false);
  });

  it("fires the long-session roast for a 20+ track unbroken session", () => {
    const base = new Date("2026-08-01T10:00:00").getTime();
    const scrobbles: ScrobbleEvent[] = Array.from({ length: 20 }, (_, i) => ({
      artist: `Artist${i}`,
      timestamp: base + i * 10 * 60000,
    }));
    const roasts = generateRoasts(scrobbles);
    const roast = roasts.find((r) => r.id === "long-session");
    expect(roast).toBeDefined();
    expect(roast!.text).toContain("20 tracks");
  });

  it("fires the many-sessions roast for 15+ separate short sessions", () => {
    const scrobbles: ScrobbleEvent[] = [];
    for (let day = 1; day <= 15; day++) {
      scrobbles.push(scrobbleFor(`Artist${day}`, `2026-08-${String(day).padStart(2, "0")}T10:00:00`));
    }
    const roasts = generateRoasts(scrobbles);
    const roast = roasts.find((r) => r.id === "many-sessions");
    expect(roast).toBeDefined();
    expect(roast!.text).toContain("15 separate sessions");
  });

  it("fires the daypart-obsession roast when one artist dominates a daypart", () => {
    const scrobbles: ScrobbleEvent[] = [
      scrobbleFor("Obsession", "2026-08-01T23:00:00"),
      scrobbleFor("Obsession", "2026-08-02T23:00:00"),
      scrobbleFor("Obsession", "2026-08-03T23:00:00"),
      scrobbleFor("Obsession", "2026-08-04T23:00:00"),
      scrobbleFor("Other", "2026-08-05T23:00:00"),
      scrobbleFor("AnotherOne", "2026-08-06T23:00:00"),
    ];
    const roasts = generateRoasts(scrobbles);
    const roast = roasts.find((r) => r.id === "daypart-obsession");
    expect(roast).toBeDefined();
    expect(roast!.text).toContain("Obsession");
    expect(roast!.text).toContain("night owl");
  });

  it("fires the artist-dominance roast when one artist makes up a large share of all listening", () => {
    const scrobbles: ScrobbleEvent[] = [];
    for (let day = 1; day <= 8; day++) scrobbles.push(scrobbleFor("Dominant", `2026-08-${String(day).padStart(2, "0")}T10:00:00`));
    const filler = ["B", "C", "D", "E", "F", "G"];
    let day = 9;
    for (const artist of filler) {
      scrobbles.push(scrobbleFor(artist, `2026-08-${String(day).padStart(2, "0")}T14:00:00`));
      scrobbles.push(scrobbleFor(artist, `2026-08-${String(day).padStart(2, "0")}T15:00:00`));
      day++;
    }
    const roasts = generateRoasts(scrobbles);
    const roast = roasts.find((r) => r.id === "artist-dominance");
    expect(roast).toBeDefined();
    expect(roast!.text).toContain("Dominant");
    expect(roast!.text).toContain("40%");
  });

  it("fires the high-volume roast when scrobble count is very high", () => {
    const scrobbles: ScrobbleEvent[] = [];
    const artists = ["A", "B", "C", "D", "E"];
    for (let i = 0; i < 500; i++) {
      const day = 1 + (i % 28);
      const hour = i % 24;
      scrobbles.push(scrobbleFor(artists[i % artists.length], `2026-0${(i % 2) + 1}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00`));
    }
    const roasts = generateRoasts(scrobbles);
    const roast = roasts.find((r) => r.id === "high-volume");
    expect(roast).toBeDefined();
    expect(roast!.text).toContain("500 scrobbles");
  });

  it("falls back to a gentle roast plus universal fillers when data is too sparse", () => {
    const scrobbles = [scrobbleAt("2026-08-01T10:00:00"), scrobbleAt("2026-08-02T10:00:00")];
    const roasts = generateRoasts(scrobbles);
    expect(roasts.some((r) => r.id === "not-enough-data")).toBe(true);
    expect(roasts.length).toBeGreaterThanOrEqual(2);
    expect(roasts.every((r) => r.id && r.text)).toBe(true);
  });

  it("falls back to universal roasts for completely empty input", () => {
    const roasts = generateRoasts([]);
    expect(roasts.some((r) => r.id === "not-enough-data")).toBe(true);
    expect(roasts.length).toBeGreaterThanOrEqual(2);
  });

  it("never fires mutually exclusive roasts together and never returns duplicate ids", () => {
    const scrobbles: ScrobbleEvent[] = [];
    for (let day = 1; day <= 10; day++) {
      for (let i = 0; i < 3; i++) {
        scrobbles.push(scrobbleFor(`Artist${i}`, `2026-08-${String(day).padStart(2, "0")}T23:${String(i * 15).padStart(2, "0")}:00`));
      }
    }
    const roasts = generateRoasts(scrobbles);
    const ids = roasts.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.includes("streak") && ids.includes("short-streak")).toBe(false);
    expect(ids.includes("weekday-heavy") && ids.includes("weekend-heavy")).toBe(false);
  });

  it("gives every roast a stable, non-index-based id", () => {
    const scrobbles = [scrobbleAt("2026-08-01T10:00:00")];
    const roasts = generateRoasts(scrobbles);
    expect(roasts.every((r) => /^[a-z0-9-]+$/.test(r.id))).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import {
  buildHourDayMatrix,
  longestStreak,
  deriveArchetype,
  daypartBreakdown,
  weekdayWeekendSplit,
  sessionStats,
  topArtistPerCell,
  topArtistsInWindow,
} from "./rhythm";
import type { ScrobbleEvent } from "../types";

function scrobbleAt(dateStr: string): ScrobbleEvent {
  return { artist: "Some Artist", timestamp: new Date(dateStr).getTime() };
}

function scrobbleFor(artist: string, dateStr: string): ScrobbleEvent {
  return { artist, timestamp: new Date(dateStr).getTime() };
}

describe("buildHourDayMatrix", () => {
  it("buckets scrobbles into the correct [day][hour] cells", () => {
    const scrobbles = [
      scrobbleAt("2026-08-09T22:15:00"), // Sunday, hour 22
      scrobbleAt("2026-08-09T22:45:00"), // Sunday, hour 22 (same cell)
      scrobbleAt("2026-08-10T09:00:00"), // Monday, hour 9
    ];
    const matrix = buildHourDayMatrix(scrobbles);
    expect(matrix[0][22]).toBe(2);
    expect(matrix[1][9]).toBe(1);
    const total = matrix.flat().reduce((sum, c) => sum + c, 0);
    expect(total).toBe(3);
  });

  it("returns an all-zero 7x24 matrix for empty input", () => {
    const matrix = buildHourDayMatrix([]);
    expect(matrix).toHaveLength(7);
    expect(matrix.every((row) => row.length === 24)).toBe(true);
    expect(matrix.flat().every((c) => c === 0)).toBe(true);
  });
});

describe("longestStreak", () => {
  it("returns 0 for empty input", () => {
    expect(longestStreak([])).toBe(0);
  });

  it("finds a 3-day gap-free run", () => {
    const scrobbles = [
      scrobbleAt("2026-08-01T10:00:00"),
      scrobbleAt("2026-08-02T10:00:00"),
      scrobbleAt("2026-08-03T10:00:00"),
    ];
    expect(longestStreak(scrobbles)).toBe(3);
  });

  it("stops the streak at a gap", () => {
    const scrobbles = [
      scrobbleAt("2026-08-01T10:00:00"),
      scrobbleAt("2026-08-02T10:00:00"),
      scrobbleAt("2026-08-05T10:00:00"),
      scrobbleAt("2026-08-06T10:00:00"),
      scrobbleAt("2026-08-07T10:00:00"),
    ];
    expect(longestStreak(scrobbles)).toBe(3);
  });
});

describe("deriveArchetype", () => {
  it("returns 'Not enough data yet' when the matrix is all zeros", () => {
    const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
    expect(deriveArchetype(matrix)).toBe("Not enough data yet");
  });

  it("returns 'Night owl' when the peak hour falls in the night bucket", () => {
    const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
    matrix[0][23] = 10;
    expect(deriveArchetype(matrix)).toBe("Night owl");
  });

  it("returns 'Early bird' when the peak hour falls in the morning bucket", () => {
    const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
    matrix[2][6] = 5;
    expect(deriveArchetype(matrix)).toBe("Early bird");
  });

  it("returns 'Balanced listener' when the peak hour is the unmatched hour 4", () => {
    const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
    matrix[3][4] = 7;
    expect(deriveArchetype(matrix)).toBe("Balanced listener");
  });
});

describe("daypartBreakdown", () => {
  it("returns 4 zeroed-out buckets for empty input", () => {
    const breakdown = daypartBreakdown([]);
    expect(breakdown).toHaveLength(4);
    expect(breakdown.map((b) => b.label)).toEqual([
      "Night owl",
      "Early bird",
      "Nine-to-fiver",
      "Evening wind-down",
    ]);
    expect(breakdown.every((b) => b.count === 0 && b.topArtist === null)).toBe(true);
  });

  it("counts scrobbles and finds the top artist per daypart", () => {
    const scrobbles = [
      scrobbleFor("A", "2026-08-09T23:00:00"), // Night owl
      scrobbleFor("A", "2026-08-09T23:30:00"), // Night owl, same artist
      scrobbleFor("B", "2026-08-10T06:00:00"), // Early bird
    ];
    const breakdown = daypartBreakdown(scrobbles);
    const nightOwl = breakdown.find((b) => b.label === "Night owl")!;
    const earlyBird = breakdown.find((b) => b.label === "Early bird")!;
    const nineToFiver = breakdown.find((b) => b.label === "Nine-to-fiver")!;

    expect(nightOwl).toEqual({ label: "Night owl", topArtist: "A", count: 2 });
    expect(earlyBird).toEqual({ label: "Early bird", topArtist: "B", count: 1 });
    expect(nineToFiver).toEqual({ label: "Nine-to-fiver", topArtist: null, count: 0 });
  });

  it("breaks a tied artist count by first-seen order", () => {
    const scrobbles = [
      scrobbleFor("B", "2026-08-09T23:00:00"),
      scrobbleFor("A", "2026-08-09T23:10:00"),
    ];
    const nightOwl = daypartBreakdown(scrobbles).find((b) => b.label === "Night owl")!;
    expect(nightOwl.topArtist).toBe("B");
  });
});

describe("weekdayWeekendSplit", () => {
  it("returns zeroed-out sides for empty input", () => {
    expect(weekdayWeekendSplit([])).toEqual({
      weekday: { avgPerDay: 0, topArtist: null },
      weekend: { avgPerDay: 0, topArtist: null },
    });
  });

  it("splits scrobbles by weekday/weekend and averages per day with activity", () => {
    const scrobbles = [
      scrobbleFor("A", "2026-08-10T10:00:00"), // Monday
      scrobbleFor("A", "2026-08-10T11:00:00"), // Monday, same artist
      scrobbleFor("B", "2026-08-10T12:00:00"), // Monday
      scrobbleFor("A", "2026-08-11T10:00:00"), // Tuesday
      scrobbleFor("C", "2026-08-15T10:00:00"), // Saturday
      scrobbleFor("C", "2026-08-16T10:00:00"), // Sunday
    ];
    const split = weekdayWeekendSplit(scrobbles);
    expect(split.weekday).toEqual({ avgPerDay: 2, topArtist: "A" });
    expect(split.weekend).toEqual({ avgPerDay: 1, topArtist: "C" });
  });
});

describe("topArtistPerCell", () => {
  it("returns an all-null 7x24 matrix for empty input", () => {
    const matrix = topArtistPerCell([]);
    expect(matrix).toHaveLength(7);
    expect(matrix.every((row) => row.length === 24)).toBe(true);
    expect(matrix.flat().every((a) => a === null)).toBe(true);
  });

  it("finds the top artist for each exact day/hour cell", () => {
    const scrobbles = [
      scrobbleFor("A", "2026-08-09T22:15:00"), // Sunday, hour 22
      scrobbleFor("A", "2026-08-09T22:45:00"), // Sunday, hour 22, same artist
      scrobbleFor("B", "2026-08-09T22:50:00"), // Sunday, hour 22, fewer plays
      scrobbleFor("C", "2026-08-10T09:00:00"), // Monday, hour 9
    ];
    const matrix = topArtistPerCell(scrobbles);
    expect(matrix[0][22]).toBe("A");
    expect(matrix[1][9]).toBe("C");
    expect(matrix[0][23]).toBeNull();
  });
});

describe("topArtistsInWindow", () => {
  it("returns an empty array for empty input", () => {
    expect(topArtistsInWindow([])).toEqual([]);
  });

  it("ranks distinct artists by total count, breaking ties by first-seen order", () => {
    const scrobbles = [
      scrobbleFor("B", "2026-08-09T22:00:00"),
      scrobbleFor("A", "2026-08-09T22:10:00"),
      scrobbleFor("A", "2026-08-09T22:20:00"),
      scrobbleFor("A", "2026-08-09T22:30:00"),
      scrobbleFor("C", "2026-08-10T09:00:00"),
      scrobbleFor("D", "2026-08-10T10:00:00"),
      scrobbleFor("E", "2026-08-10T11:00:00"),
    ];
    expect(topArtistsInWindow(scrobbles, 4)).toEqual(["A", "B", "C", "D"]);
  });
});

describe("sessionStats", () => {
  it("returns 0 sessions for empty input", () => {
    expect(sessionStats([])).toEqual({ sessionCount: 0, avgSessionLength: 0, longestSessionLength: 0 });
  });

  it("splits into separate sessions when the gap exceeds the threshold", () => {
    const scrobbles = [
      scrobbleAt("2026-08-01T10:00:00"),
      scrobbleAt("2026-08-01T10:10:00"), // 10 min gap, same session
      scrobbleAt("2026-08-01T10:15:00"), // 5 min gap, same session
      scrobbleAt("2026-08-01T11:00:00"), // 45 min gap, new session
      scrobbleAt("2026-08-01T11:05:00"), // 5 min gap, same session
    ];
    expect(sessionStats(scrobbles)).toEqual({
      sessionCount: 2,
      avgSessionLength: 2.5,
      longestSessionLength: 3,
    });
  });
});

import { describe, it, expect } from "vitest";
import { computeDrift } from "./drift";
import type { TopArtist } from "../types";

function artist(overrides: Partial<TopArtist>): TopArtist {
  return { name: "Some Artist", mbid: "", playcount: 100, rank: 1, ...overrides };
}

describe("computeDrift", () => {
  it("returns [] when both recent and baseline are empty", () => {
    expect(computeDrift([], [])).toEqual([]);
  });

  it("returns [] for empty recent and empty baseline independently", () => {
    expect(computeDrift([], [])).toEqual([]);
  });

  it("treats every baseline artist as fading when recent is empty", () => {
    const baseline = [artist({ name: "Baseline Only", rank: 1 })];
    const result = computeDrift([], baseline);
    expect(result).toEqual([
      { name: "Baseline Only", direction: "fading", rankRecent: null, rankBaseline: 1 },
    ]);
  });

  it("treats every recent artist as rising when baseline is empty", () => {
    const recent = [artist({ name: "Recent Only", rank: 1 })];
    const result = computeDrift(recent, []);
    expect(result).toEqual([
      { name: "Recent Only", direction: "rising", rankRecent: 1, rankBaseline: null },
    ]);
  });

  it("marks a new artist (in recent, absent from baseline) as rising with null rankBaseline", () => {
    const recent = [artist({ name: "New Artist", rank: 2 })];
    const baseline = [artist({ name: "Other Artist", rank: 1 })];
    const result = computeDrift(recent, baseline);
    const entry = result.find((e) => e.name === "New Artist");
    expect(entry).toEqual({
      name: "New Artist",
      direction: "rising",
      rankRecent: 2,
      rankBaseline: null,
    });
  });

  it("marks a fully-dropped artist (in baseline, absent from recent) as fading with null rankRecent", () => {
    const recent = [artist({ name: "Other Artist", rank: 1 })];
    const baseline = [artist({ name: "Dropped Artist", rank: 3 })];
    const result = computeDrift(recent, baseline);
    const entry = result.find((e) => e.name === "Dropped Artist");
    expect(entry).toEqual({
      name: "Dropped Artist",
      direction: "fading",
      rankRecent: null,
      rankBaseline: 3,
    });
  });

  it("marks a climbing artist (present in both, better rank in recent) as rising", () => {
    const recent = [artist({ name: "Climber", rank: 1 })];
    const baseline = [artist({ name: "Climber", rank: 4 })];
    const result = computeDrift(recent, baseline);
    expect(result).toEqual([
      { name: "Climber", direction: "rising", rankRecent: 1, rankBaseline: 4 },
    ]);
  });

  it("marks a fading-but-present artist (present in both, worse rank in recent) as fading", () => {
    const recent = [artist({ name: "Sinker", rank: 5 })];
    const baseline = [artist({ name: "Sinker", rank: 1 })];
    const result = computeDrift(recent, baseline);
    expect(result).toEqual([
      { name: "Sinker", direction: "fading", rankRecent: 5, rankBaseline: 1 },
    ]);
  });

  it("produces no entry for an artist with an identical rank in both periods", () => {
    const recent = [artist({ name: "Steady", rank: 2 })];
    const baseline = [artist({ name: "Steady", rank: 2 })];
    const result = computeDrift(recent, baseline);
    expect(result.find((e) => e.name === "Steady")).toBeUndefined();
    expect(result).toHaveLength(0);
  });
});

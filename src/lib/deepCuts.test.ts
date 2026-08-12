import { describe, it, expect } from "vitest";
import { rankDeepCuts } from "./deepCuts";
import type { GraphNode } from "../types";

function candidate(overrides: Partial<GraphNode>): GraphNode {
  return {
    id: "Some Artist",
    kind: "candidate",
    relevance: 0.5,
    listeners: 10000,
    sourceCoreArtist: "Core Artist",
    match: 0.5,
    ...overrides,
  };
}

describe("rankDeepCuts", () => {
  it("returns [] for empty input", () => {
    expect(rankDeepCuts([])).toEqual([]);
  });

  it("excludes core nodes even with a high relevance", () => {
    const nodes: GraphNode[] = [
      { id: "Core Artist", kind: "core", relevance: 1, listeners: 5000000 },
      candidate({ id: "Candidate A", relevance: 0.9, listeners: 1000 }),
    ];
    const result = rankDeepCuts(nodes);
    expect(result).toHaveLength(1);
    expect(result[0].node.id).toBe("Candidate A");
  });

  it("ranks a low-listener candidate above a high-listener one at equal relevance", () => {
    const nodes: GraphNode[] = [
      candidate({ id: "Huge Popular Act", relevance: 0.8, listeners: 5000000 }),
      candidate({ id: "Obscure Gem", relevance: 0.8, listeners: 500 }),
    ];
    const result = rankDeepCuts(nodes);
    expect(result[0].node.id).toBe("Obscure Gem");
    expect(result[1].node.id).toBe("Huge Popular Act");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("truncates to the limit when more than the limit of candidates are present", () => {
    const nodes: GraphNode[] = Array.from({ length: 15 }, (_, i) =>
      candidate({ id: `Candidate ${i}`, relevance: (i + 1) / 15, listeners: 1000 * (i + 1) })
    );
    const result = rankDeepCuts(nodes);
    expect(result).toHaveLength(10);
  });

  it("respects a custom limit", () => {
    const nodes: GraphNode[] = Array.from({ length: 5 }, (_, i) =>
      candidate({ id: `Candidate ${i}`, relevance: (i + 1) / 5, listeners: 1000 })
    );
    const result = rankDeepCuts(nodes, 3);
    expect(result).toHaveLength(3);
  });

  it("does not divide by zero when a single candidate is present", () => {
    const nodes: GraphNode[] = [candidate({ id: "Only One", relevance: 0.7, listeners: 12345 })];
    const result = rankDeepCuts(nodes);
    expect(result).toHaveLength(1);
    expect(Number.isFinite(result[0].score)).toBe(true);
    // With no listener spread to normalize against, normalizedListeners is
    // treated as 0 so score reduces to relevance.
    expect(result[0].score).toBeCloseTo(0.7);
  });

  it("does not divide by zero when all candidates share the same listener count", () => {
    const nodes: GraphNode[] = [
      candidate({ id: "A", relevance: 0.4, listeners: 9999 }),
      candidate({ id: "B", relevance: 0.9, listeners: 9999 }),
    ];
    const result = rankDeepCuts(nodes);
    expect(result.every((d) => Number.isFinite(d.score))).toBe(true);
    expect(result[0].node.id).toBe("B");
  });
});

import type { GraphNode } from "../types";

export interface DeepCut {
  node: GraphNode;
  score: number;
}

export function rankDeepCuts(nodes: GraphNode[], limit = 10): DeepCut[] {
  const candidates = nodes.filter((n) => n.kind === "candidate");
  if (candidates.length === 0) return [];

  const logListeners = candidates.map((n) => Math.log10(n.listeners + 1));
  const min = Math.min(...logListeners);
  const max = Math.max(...logListeners);
  const range = max - min;

  const scored = candidates.map((node, i) => {
    const normalizedListeners = range === 0 ? 0 : (logListeners[i] - min) / range;
    return { node, score: node.relevance * (1 - normalizedListeners) };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

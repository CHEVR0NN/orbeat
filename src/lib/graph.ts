import type { GraphDataBundle, GraphNode, GraphLink, Graph } from "../types";

export function buildGraph(bundle: GraphDataBundle): Graph {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const seenCandidates = new Map<string, GraphNode>();

  for (const artist of bundle.core) {
    const info = bundle.infoByArtist[artist.name];
    nodes.push({
      id: artist.name,
      kind: "core",
      relevance: 1,
      listeners: info?.listeners ?? 0,
    });
  }

  for (const coreArtist of bundle.core) {
    const similar = bundle.similarByArtist[coreArtist.name] ?? [];
    for (const s of similar) {
      if (bundle.core.some((c) => c.name === s.name)) continue;
      const info = bundle.infoByArtist[s.name];
      if (!info) continue;

      const existing = seenCandidates.get(s.name);
      if (existing && existing.relevance >= s.match) {
        links.push({ source: coreArtist.name, target: s.name });
        continue;
      }

      const node: GraphNode = {
        id: s.name,
        kind: "candidate",
        relevance: s.match,
        listeners: info.listeners,
        sourceCoreArtist: coreArtist.name,
        match: s.match,
      };
      if (existing) {
        nodes[nodes.indexOf(existing)] = node;
      } else {
        nodes.push(node);
      }
      seenCandidates.set(s.name, node);
      links.push({ source: coreArtist.name, target: s.name });
    }
  }

  return { nodes, links };
}

import { describe, it, expect } from "vitest";
import { buildGraph } from "./graph";
import type { GraphDataBundle } from "../types";

describe("buildGraph", () => {
  it("includes one node per core artist with relevance 1", () => {
    const bundle: GraphDataBundle = {
      core: [
        { name: "Radiohead", mbid: "", playcount: 500, rank: 1 },
        { name: "Aphex Twin", mbid: "", playcount: 300, rank: 2 },
      ],
      tagsByArtist: {},
      similarByArtist: { Radiohead: [], "Aphex Twin": [] },
      infoByArtist: {
        Radiohead: { name: "Radiohead", listeners: 4000000, playcount: 900000000 },
        "Aphex Twin": { name: "Aphex Twin", listeners: 500000, playcount: 90000000 },
      },
    };
    const { nodes } = buildGraph(bundle);
    const coreNodes = nodes.filter((n) => n.kind === "core");
    expect(coreNodes).toHaveLength(2);
    expect(coreNodes.every((n) => n.relevance === 1)).toBe(true);
  });

  it("omits a similar artist when Last.fm has no info for it", () => {
    const bundle: GraphDataBundle = {
      core: [{ name: "Radiohead", mbid: "", playcount: 500, rank: 1 }],
      tagsByArtist: {},
      similarByArtist: { Radiohead: [{ name: "Obscure Act", match: 0.5 }] },
      infoByArtist: {
        Radiohead: { name: "Radiohead", listeners: 4000000, playcount: 900000000 },
      },
    };
    const { nodes } = buildGraph(bundle);
    expect(nodes.find((n) => n.id === "Obscure Act")).toBeUndefined();
  });

  it("excludes a similar artist that is already a core artist", () => {
    const bundle: GraphDataBundle = {
      core: [
        { name: "Radiohead", mbid: "", playcount: 500, rank: 1 },
        { name: "Aphex Twin", mbid: "", playcount: 300, rank: 2 },
      ],
      tagsByArtist: {},
      similarByArtist: {
        Radiohead: [{ name: "Aphex Twin", match: 0.8 }],
        "Aphex Twin": [],
      },
      infoByArtist: {
        Radiohead: { name: "Radiohead", listeners: 4000000, playcount: 900000000 },
        "Aphex Twin": { name: "Aphex Twin", listeners: 500000, playcount: 90000000 },
      },
    };
    const { nodes } = buildGraph(bundle);
    expect(nodes.filter((n) => n.id === "Aphex Twin")).toHaveLength(1);
    expect(nodes.find((n) => n.id === "Aphex Twin")!.kind).toBe("core");
  });

  it("dedupes a candidate shared by two core artists, keeping the higher match score, and links both", () => {
    const bundle: GraphDataBundle = {
      core: [
        { name: "Radiohead", mbid: "", playcount: 500, rank: 1 },
        { name: "Sigur Ros", mbid: "", playcount: 300, rank: 2 },
      ],
      tagsByArtist: {},
      similarByArtist: {
        Radiohead: [{ name: "Boards of Canada", match: 0.6 }],
        "Sigur Ros": [{ name: "Boards of Canada", match: 0.9 }],
      },
      infoByArtist: {
        Radiohead: { name: "Radiohead", listeners: 4000000, playcount: 900000000 },
        "Sigur Ros": { name: "Sigur Ros", listeners: 1000000, playcount: 90000000 },
        "Boards of Canada": { name: "Boards of Canada", listeners: 300000, playcount: 5000000 },
      },
    };
    const { nodes, links } = buildGraph(bundle);
    const candidateNodes = nodes.filter((n) => n.id === "Boards of Canada");
    expect(candidateNodes).toHaveLength(1);
    expect(candidateNodes[0].relevance).toBe(0.9);
    expect(links.filter((l) => l.target === "Boards of Canada")).toHaveLength(2);
  });
});

import type { TopArtist } from "../types";

export interface DriftEntry {
  name: string;
  direction: "rising" | "fading";
  rankRecent: number | null;
  rankBaseline: number | null;
}

export function computeDrift(recent: TopArtist[], baseline: TopArtist[]): DriftEntry[] {
  const baselineByName = new Map(baseline.map((a) => [a.name, a.rank]));
  const recentByName = new Map(recent.map((a) => [a.name, a.rank]));
  const entries: DriftEntry[] = [];

  for (const artist of recent) {
    const rankBaseline = baselineByName.get(artist.name) ?? null;
    if (rankBaseline === null || artist.rank < rankBaseline) {
      entries.push({
        name: artist.name,
        direction: "rising",
        rankRecent: artist.rank,
        rankBaseline,
      });
    }
  }

  for (const artist of baseline) {
    const rankRecent = recentByName.get(artist.name) ?? null;
    if (rankRecent === null || artist.rank < rankRecent) {
      entries.push({
        name: artist.name,
        direction: "fading",
        rankRecent,
        rankBaseline: artist.rank,
      });
    }
  }

  return entries;
}

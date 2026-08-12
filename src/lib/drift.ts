import type { Period, TopArtist } from "../types";

export interface DriftEntry {
  name: string;
  direction: "rising" | "fading";
  rankRecent: number | null;
  rankBaseline: number | null;
}

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "7day", label: "7 Day" },
  { value: "1month", label: "1 Month" },
  { value: "3month", label: "3 Month" },
  { value: "6month", label: "6 Month" },
  { value: "12month", label: "12 Month" },
  { value: "overall", label: "Overall" },
];

// Whichever rank is defined displays first (baseline takes priority when
// both are known); the second slot is either the other rank or the word
// describing the missing side.
export function rankReadout(entry: DriftEntry): string {
  if (entry.rankBaseline !== null && entry.rankRecent !== null) {
    return `#${entry.rankBaseline} → #${entry.rankRecent}`;
  }
  if (entry.rankBaseline !== null) {
    return `#${entry.rankBaseline} → gone`;
  }
  return `#${entry.rankRecent} → new`;
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

import type { ArtistTag } from "../types";

export function topGenre(tagsByArtist: Record<string, ArtistTag[]>): string | null {
  const counts = new Map<string, number>();
  for (const tags of Object.values(tagsByArtist)) {
    for (const tag of tags) {
      counts.set(tag.name, (counts.get(tag.name) ?? 0) + tag.count);
    }
  }

  let best: string | null = null;
  let bestCount = -1;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

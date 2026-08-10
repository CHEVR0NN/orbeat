import type { ArtistTag, GenreCount } from "../types";

function countTags(tagsByArtist: Record<string, ArtistTag[]>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tags of Object.values(tagsByArtist)) {
    for (const tag of tags) {
      counts.set(tag.name, (counts.get(tag.name) ?? 0) + tag.count);
    }
  }
  return counts;
}

export function topGenre(tagsByArtist: Record<string, ArtistTag[]>): string | null {
  const counts = countTags(tagsByArtist);

  let best: string | null = null;
  let bestCount = -1;
  for (const [name, count] of counts) {
    // strict > (not >=) means the first-seen tag wins ties, matching
    // Object.values/Map iteration order
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

export function topGenres(tagsByArtist: Record<string, ArtistTag[]>, limit = 4): GenreCount[] {
  const counts = countTags(tagsByArtist);
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

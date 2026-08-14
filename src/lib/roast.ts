import type { ScrobbleEvent } from "../types";
import {
  buildHourDayMatrix,
  longestStreak,
  deriveArchetype,
  daypartBreakdown,
  weekdayWeekendSplit,
  sessionStats,
  topArtistsInWindow,
  HOUR_BUCKETS,
} from "./rhythm";

export interface Roast {
  id: string;
  text: string;
}

const MIN_DECK_SIZE = 2;
const LOW_DATA_THRESHOLD = 15;
const HIGH_VOLUME_THRESHOLD = 500;
const DAYPART_MAJORITY_SHARE = 0.5;
const DAYPART_MIN_BUCKET_SIZE = 5;
const ARTIST_DOMINANCE_SHARE = 0.4;
const ARTIST_DOMINANCE_MIN_SCROBBLES = 20;
const SHORT_STREAK_MIN_SCROBBLES = 20;

function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const period = h < 12 ? "am" : "pm";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${period}`;
}

function countByArtist(scrobbles: ScrobbleEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of scrobbles) counts.set(s.artist, (counts.get(s.artist) ?? 0) + 1);
  return counts;
}

const FALLBACK_ROASTS: Roast[] = [
  {
    id: "fallback-diary",
    text: "Your scrobbles are basically a diary you didn't mean to write in public.",
  },
  {
    id: "fallback-elitist",
    text: "Somewhere, a music elitist is judging this library. They're probably right.",
  },
];

export function generateRoasts(scrobbles: ScrobbleEvent[]): Roast[] {
  const roasts: Roast[] = [];

  const matrix = buildHourDayMatrix(scrobbles);
  const streak = longestStreak(scrobbles);
  const archetype = deriveArchetype(matrix);
  const dayparts = daypartBreakdown(scrobbles);
  const split = weekdayWeekendSplit(scrobbles);
  const sessions = sessionStats(scrobbles);
  const [topArtist] = topArtistsInWindow(scrobbles, 1);

  if (archetype === "Not enough data yet" || scrobbles.length < LOW_DATA_THRESHOLD) {
    roasts.push({
      id: "not-enough-data",
      text: "Not enough listening history to roast you properly. Suspiciously restrained of you.",
    });
  }

  if (streak >= 7) {
    roasts.push({
      id: "streak",
      text: `${streak}-day streak. At what point does this stop being a hobby and start being a personality trait?`,
    });
  } else if (streak <= 1 && scrobbles.length >= SHORT_STREAK_MIN_SCROBBLES) {
    roasts.push({
      id: "short-streak",
      text: `Longest streak on record: ${streak} day. Consistency is clearly not your genre.`,
    });
  }

  if (archetype === "Night owl") {
    const bucket = HOUR_BUCKETS.find((b) => b.label === "Night owl")!;
    roasts.push({
      id: "archetype-night-owl",
      text: `Peak listening hours: ${formatHour(bucket.hours[0])} to ${formatHour(bucket.hours[bucket.hours.length - 1])}. Your circadian rhythm has filed a complaint.`,
    });
  }

  if (archetype === "Early bird") {
    const bucket = HOUR_BUCKETS.find((b) => b.label === "Early bird")!;
    roasts.push({
      id: "archetype-early-bird",
      text: `Peak hours before ${formatHour(bucket.hours[bucket.hours.length - 1] + 1)}. Who hurt you before breakfast.`,
    });
  }

  if (archetype === "Nine-to-fiver") {
    roasts.push({
      id: "archetype-nine-to-fiver",
      text: "Peak hours land smack in the middle of the workday. Somewhere, a manager is side-eyeing your headphones.",
    });
  }

  if (archetype === "Evening wind-down") {
    roasts.push({
      id: "archetype-evening",
      text: "Peak hours are your evening wind-down. Congratulations on having a normal circadian rhythm, how boring.",
    });
  }

  if (split.weekday.avgPerDay > 0 && split.weekend.avgPerDay > split.weekday.avgPerDay * 1.5) {
    const ratio = Math.round((split.weekend.avgPerDay / split.weekday.avgPerDay) * 10) / 10;
    roasts.push({
      id: "weekend-heavy",
      text: `You listen ${ratio}x more on weekends. Weekday-you and weekend-you clearly aren't on speaking terms.`,
    });
  } else if (split.weekday.avgPerDay > split.weekend.avgPerDay * 1.5) {
    roasts.push({
      id: "weekday-heavy",
      text: "Weekdays out-scrobble weekends. Using music to survive the 9-to-5, are we.",
    });
  }

  if (sessions.longestSessionLength >= 20) {
    roasts.push({
      id: "long-session",
      text: `${sessions.longestSessionLength} tracks in one sitting, no breaks. That's not a listening session, that's a hostage situation.`,
    });
  }

  if (sessions.sessionCount >= 15) {
    roasts.push({
      id: "many-sessions",
      text: `${sessions.sessionCount} separate sessions. You don't listen to music, you interrupt silence.`,
    });
  }

  const dominantDaypart = dayparts.find((d) => d.count >= DAYPART_MIN_BUCKET_SIZE && d.topArtist);
  if (dominantDaypart?.topArtist) {
    const dayScrobbles = scrobbles.filter((s) =>
      HOUR_BUCKETS.find((b) => b.label === dominantDaypart.label)!.hours.includes(new Date(s.timestamp).getHours())
    );
    const artistCount = dayScrobbles.filter((s) => s.artist === dominantDaypart.topArtist).length;
    if (artistCount / dominantDaypart.count >= DAYPART_MAJORITY_SHARE) {
      roasts.push({
        id: "daypart-obsession",
        text: `Mostly ${dominantDaypart.topArtist} during your ${dominantDaypart.label.toLowerCase()} hours. Does ${dominantDaypart.topArtist} know they're your emotional support artist?`,
      });
    }
  }

  if (topArtist && scrobbles.length >= ARTIST_DOMINANCE_MIN_SCROBBLES) {
    const counts = countByArtist(scrobbles);
    const share = (counts.get(topArtist) ?? 0) / scrobbles.length;
    if (share >= ARTIST_DOMINANCE_SHARE) {
      const pct = Math.round(share * 100);
      roasts.push({
        id: "artist-dominance",
        text: `${topArtist} makes up ${pct}% of everything you've listened to. At what point does this become a stalking charge?`,
      });
    }
  }

  if (scrobbles.length >= HIGH_VOLUME_THRESHOLD) {
    roasts.push({
      id: "high-volume",
      text: `${scrobbles.length} scrobbles in this window and you still weren't done. The play button needs a rest.`,
    });
  }

  for (const fallback of FALLBACK_ROASTS) {
    if (roasts.length >= MIN_DECK_SIZE) break;
    roasts.push(fallback);
  }

  return roasts;
}

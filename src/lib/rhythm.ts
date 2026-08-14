import type { ScrobbleEvent } from "../types";

export function buildHourDayMatrix(scrobbles: ScrobbleEvent[]): number[][] {
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const s of scrobbles) {
    const date = new Date(s.timestamp);
    matrix[date.getDay()][date.getHours()]++;
  }
  return matrix;
}

export function longestStreak(scrobbles: ScrobbleEvent[]): number {
  if (scrobbles.length === 0) return 0;

  const days = Array.from(
    new Set(scrobbles.map((s) => new Date(s.timestamp).toDateString()))
  )
    .map((d) => new Date(d))
    .sort((a, b) => a.getTime() - b.getTime());

  let longest = 1;
  let current = 1;
  for (let i = 1; i < days.length; i++) {
    const diffDays = Math.round((days[i].getTime() - days[i - 1].getTime()) / 86400000);
    current = diffDays === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

export const HOUR_BUCKETS: { hours: number[]; label: string }[] = [
  { hours: [22, 23, 0, 1, 2, 3], label: "Night owl" },
  { hours: [5, 6, 7, 8], label: "Early bird" },
  { hours: [9, 10, 11, 12, 13, 14, 15, 16, 17], label: "Nine-to-fiver" },
  { hours: [18, 19, 20, 21], label: "Evening wind-down" },
];

export function deriveArchetype(matrix: number[][]): string {
  const hourTotals = Array(24).fill(0);
  for (const day of matrix) {
    for (let hour = 0; hour < 24; hour++) {
      hourTotals[hour] += day[hour];
    }
  }

  const totalCount = hourTotals.reduce((sum, c) => sum + c, 0);
  if (totalCount === 0) return "Not enough data yet";

  const peakHour = hourTotals.indexOf(Math.max(...hourTotals));
  const bucket = HOUR_BUCKETS.find((b) => b.hours.includes(peakHour));
  return bucket?.label ?? "Balanced listener";
}

function topArtistOf(group: ScrobbleEvent[]): string | null {
  if (group.length === 0) return null;
  const counts = new Map<string, number>();
  for (const s of group) {
    counts.set(s.artist, (counts.get(s.artist) ?? 0) + 1);
  }
  let topArtist = group[0].artist;
  let topCount = 0;
  for (const [artist, count] of counts) {
    if (count > topCount) {
      topArtist = artist;
      topCount = count;
    }
  }
  return topArtist;
}

export function topArtistPerCell(scrobbles: ScrobbleEvent[]): (string | null)[][] {
  const buckets: ScrobbleEvent[][][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => [] as ScrobbleEvent[])
  );
  for (const s of scrobbles) {
    const date = new Date(s.timestamp);
    buckets[date.getDay()][date.getHours()].push(s);
  }
  return buckets.map((day) => day.map((cell) => topArtistOf(cell)));
}

export function topArtistsInWindow(scrobbles: ScrobbleEvent[], n = 4): string[] {
  const counts = new Map<string, number>();
  for (const s of scrobbles) {
    counts.set(s.artist, (counts.get(s.artist) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([artist]) => artist);
}

export interface DaypartBreakdown {
  label: string;
  topArtist: string | null;
  count: number;
}

export function daypartBreakdown(scrobbles: ScrobbleEvent[]): DaypartBreakdown[] {
  return HOUR_BUCKETS.map((bucket) => {
    const inBucket = scrobbles.filter((s) => bucket.hours.includes(new Date(s.timestamp).getHours()));
    return { label: bucket.label, topArtist: topArtistOf(inBucket), count: inBucket.length };
  });
}

export interface WeekdayWeekendSplit {
  weekday: { avgPerDay: number; topArtist: string | null };
  weekend: { avgPerDay: number; topArtist: string | null };
}

function summarizeDayGroup(group: ScrobbleEvent[]): { avgPerDay: number; topArtist: string | null } {
  if (group.length === 0) return { avgPerDay: 0, topArtist: null };
  const days = new Set(group.map((s) => new Date(s.timestamp).toDateString()));
  return { avgPerDay: Math.round((group.length / days.size) * 10) / 10, topArtist: topArtistOf(group) };
}

export function weekdayWeekendSplit(scrobbles: ScrobbleEvent[]): WeekdayWeekendSplit {
  const weekday: ScrobbleEvent[] = [];
  const weekend: ScrobbleEvent[] = [];
  for (const s of scrobbles) {
    const day = new Date(s.timestamp).getDay();
    (day === 0 || day === 6 ? weekend : weekday).push(s);
  }
  return { weekday: summarizeDayGroup(weekday), weekend: summarizeDayGroup(weekend) };
}

export interface SessionStats {
  sessionCount: number;
  avgSessionLength: number;
  longestSessionLength: number;
}

export function sessionStats(scrobbles: ScrobbleEvent[], gapMinutesThreshold = 30): SessionStats {
  if (scrobbles.length === 0) {
    return { sessionCount: 0, avgSessionLength: 0, longestSessionLength: 0 };
  }

  const sorted = [...scrobbles].sort((a, b) => a.timestamp - b.timestamp);
  const sessionLengths: number[] = [];
  let currentLength = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gapMinutes = (sorted[i].timestamp - sorted[i - 1].timestamp) / 60000;
    if (gapMinutes > gapMinutesThreshold) {
      sessionLengths.push(currentLength);
      currentLength = 1;
    } else {
      currentLength++;
    }
  }
  sessionLengths.push(currentLength);

  return {
    sessionCount: sessionLengths.length,
    avgSessionLength: Math.round((scrobbles.length / sessionLengths.length) * 10) / 10,
    longestSessionLength: Math.max(...sessionLengths),
  };
}

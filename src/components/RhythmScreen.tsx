import { useMemo, useState } from "react";
import type { ScrobbleEvent } from "../types";
import {
  buildHourDayMatrix,
  longestStreak,
  deriveArchetype,
  daypartBreakdown,
  weekdayWeekendSplit,
  sessionStats,
  topArtistPerCell,
  topArtistsInWindow,
  HOUR_BUCKETS,
} from "../lib/rhythm";
import { generateRoasts } from "../lib/roast";

interface RhythmScreenProps {
  scrobbles: ScrobbleEvent[];
  isLoading: boolean;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_DAYS = [1, 2, 3, 4, 5];
const WEEKEND_DAYS = [0, 6];

function cellKey(day: number, hour: number): string {
  return `${day}-${hour}`;
}

function cellsForHours(hours: number[]): Set<string> {
  const set = new Set<string>();
  for (let day = 0; day < 7; day++) {
    for (const hour of hours) set.add(cellKey(day, hour));
  }
  return set;
}

function cellsForDays(days: number[]): Set<string> {
  const set = new Set<string>();
  for (const day of days) {
    for (let hour = 0; hour < 24; hour++) set.add(cellKey(day, hour));
  }
  return set;
}

// Positions the hover popover within its row's cell track: anchored to the
// hovered cell's left/center/right edge depending on which third of the
// 0-23 hour range it falls in, so it never overflows at either end without
// needing to measure DOM rects.
function popoverStyle(hour: number): { left: string; transform: string } {
  const third = Math.floor(hour / 8);
  if (third === 0) return { left: `${(hour / 24) * 100}%`, transform: "translateX(0)" };
  if (third === 2) return { left: `${((hour + 1) / 24) * 100}%`, transform: "translateX(-100%)" };
  return { left: `${((hour + 0.5) / 24) * 100}%`, transform: "translateX(-50%)" };
}

export default function RhythmScreen({ scrobbles, isLoading }: RhythmScreenProps) {
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<Set<string> | null>(null);
  const [metric, setMetric] = useState<"count" | "artist">("count");
  const [roastIndex, setRoastIndex] = useState(0);

  const roasts = useMemo(() => generateRoasts(scrobbles), [scrobbles]);
  const matrix = useMemo(() => buildHourDayMatrix(scrobbles), [scrobbles]);
  const streak = useMemo(() => longestStreak(scrobbles), [scrobbles]);
  const archetype = useMemo(() => deriveArchetype(matrix), [matrix]);
  const dayparts = useMemo(() => daypartBreakdown(scrobbles), [scrobbles]);
  const split = useMemo(() => weekdayWeekendSplit(scrobbles), [scrobbles]);
  const sessions = useMemo(() => sessionStats(scrobbles), [scrobbles]);
  const maxCount = useMemo(() => Math.max(0, ...matrix.flat()), [matrix]);
  const cellArtists = useMemo(() => topArtistPerCell(scrobbles), [scrobbles]);
  const topArtists = useMemo(() => topArtistsInWindow(scrobbles), [scrobbles]);

  const archetypeArtist = dayparts.find((d) => d.label === archetype)?.topArtist ?? null;
  const archetypeBucket = HOUR_BUCKETS.find((b) => b.label === archetype);

  return (
    <section className="rhythm-screen">
      <p className="rhythm-screen-header">When you actually listen, broken down by hour and day.</p>

      {isLoading ? (
        <p className="rhythm-screen-empty">Reading your listening rhythm…</p>
      ) : scrobbles.length === 0 ? (
        <p className="rhythm-screen-empty">No listening history yet. Keep listening.</p>
      ) : (
        <>
          {roasts.length > 0 && (
            <div className="rhythm-roast-card">
              <span className="rhythm-roast-label">Roast Mode</span>
              <p className="rhythm-roast-text">{roasts[roastIndex % roasts.length].text}</p>
              <button
                type="button"
                className="rhythm-roast-next"
                onClick={() => setRoastIndex((i) => (i + 1) % roasts.length)}
              >
                Next roast
              </button>
            </div>
          )}

          <div className="rhythm-tiles">
            <div
              className="rhythm-tile"
              onMouseEnter={() => archetypeBucket && setHighlightedCells(cellsForHours(archetypeBucket.hours))}
              onMouseLeave={() => setHighlightedCells(null)}
            >
              <span className="rhythm-tile-label">Archetype</span>
              <span className="rhythm-tile-value">{archetype}</span>
              {archetypeArtist && <span className="rhythm-tile-sub">mostly {archetypeArtist}</span>}
            </div>

            <div className="rhythm-tile">
              <span className="rhythm-tile-label">Streak</span>
              <span className="rhythm-tile-value">
                {streak}
                <span className="rhythm-tile-value-unit">day{streak === 1 ? "" : "s"}</span>
              </span>
              <span className="rhythm-tile-sub">longest run without a gap</span>
            </div>

            <div className="rhythm-tile">
              <span className="rhythm-tile-label">Weekday vs weekend</span>
              <div className="rhythm-tile-split-row">
                <div
                  className="rhythm-tile-split-side"
                  onMouseEnter={() => setHighlightedCells(cellsForDays(WEEKDAY_DAYS))}
                  onMouseLeave={() => setHighlightedCells(null)}
                >
                  <span className="rhythm-tile-split-heading">Weekday</span>
                  <span className="rhythm-tile-split-value">{split.weekday.avgPerDay}/day</span>
                  <span className="rhythm-tile-split-artist">{split.weekday.topArtist ?? "—"}</span>
                </div>
                <div
                  className="rhythm-tile-split-side"
                  onMouseEnter={() => setHighlightedCells(cellsForDays(WEEKEND_DAYS))}
                  onMouseLeave={() => setHighlightedCells(null)}
                >
                  <span className="rhythm-tile-split-heading">Weekend</span>
                  <span className="rhythm-tile-split-value">{split.weekend.avgPerDay}/day</span>
                  <span className="rhythm-tile-split-artist">{split.weekend.topArtist ?? "—"}</span>
                </div>
              </div>
            </div>

            <div className="rhythm-tile">
              <span className="rhythm-tile-label">Sessions</span>
              <span className="rhythm-tile-value">{sessions.sessionCount}</span>
              <span className="rhythm-tile-sub">longest: {sessions.longestSessionLength} tracks in a row</span>
            </div>
          </div>

          <div className="rhythm-metric-toggle" role="group" aria-label="Heatmap metric">
            <button
              type="button"
              className={`rhythm-metric-toggle-btn${metric === "count" ? " is-active" : ""}`}
              onClick={() => setMetric("count")}
              aria-pressed={metric === "count"}
            >
              Count
            </button>
            <button
              type="button"
              className={`rhythm-metric-toggle-btn${metric === "artist" ? " is-active" : ""}`}
              onClick={() => setMetric("artist")}
              aria-pressed={metric === "artist"}
            >
              Top Artist
            </button>
          </div>

          <div className="rhythm-screen-heatmap">
            {matrix.map((hours, day) => (
              <div className="rhythm-screen-heatmap-row" key={DAY_LABELS[day]}>
                <span className="rhythm-screen-day-label">{DAY_LABELS[day]}</span>
                <div className="rhythm-screen-heatmap-cells">
                  {hours.map((count, hour) => {
                    const topArtist = cellArtists[day][hour];
                    const artistIndex = topArtist ? topArtists.indexOf(topArtist) : -1;
                    const dimmed = highlightedCells !== null && !highlightedCells.has(cellKey(day, hour));
                    const isHovered = hoveredCell?.day === day && hoveredCell?.hour === hour;
                    const baseOpacity = maxCount ? count / maxCount : 0;

                    return (
                      <div
                        className={`rhythm-screen-cell${
                          metric === "artist" ? ` rhythm-screen-cell-artist-${artistIndex >= 0 ? artistIndex : "muted"}` : ""
                        }`}
                        key={hour}
                        style={{ opacity: dimmed ? baseOpacity * 0.25 : baseOpacity }}
                        aria-label={`${DAY_LABELS[day]} ${hour}:00, ${count} scrobbles${topArtist ? `, mostly ${topArtist}` : ""}`}
                        onMouseEnter={() => setHoveredCell({ day, hour })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {isHovered && (
                          <div className="rhythm-cell-popover" style={popoverStyle(hour)}>
                            <span className="rhythm-cell-popover-title">
                              {DAY_LABELS[day]} {hour}:00
                            </span>
                            <span className="rhythm-cell-popover-line">{count} scrobbles</span>
                            {topArtist && <span className="rhythm-cell-popover-line">mostly {topArtist}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {metric === "artist" && (
            <div className="profile-card-legend rhythm-artist-legend">
              {topArtists.map((artist, i) => (
                <span key={artist} className="profile-card-legend-item">
                  <span className={`profile-card-legend-dot rhythm-screen-cell-artist-${i}`} />
                  {artist}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

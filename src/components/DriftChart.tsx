import { Fragment, useState } from "react";
import type { DriftEntry } from "../lib/drift";
import { rankReadout } from "../lib/drift";

interface DriftChartProps {
  entries: DriftEntry[];
  recentLabel?: string;
  baselineLabel?: string;
}

const ROW_HEIGHT = 40;
const AXIS_HEIGHT = 28;
// The plot only uses the left portion of the row's width; the rest is a
// reserved "off-chart" stub zone for new/gone artists (see xPercent below).
const PLOT_RIGHT = 68;
const STUB_END = 90;
const STUB_LABEL_X = 93;

// Maps a rank (1 = best) onto a percentage position within the plot area.
// Percentages resolve against each row's own <svg> pixel width (no viewBox
// is set), so this stays a true horizontal position regardless of the
// container's responsive width, without distorting circle/stroke geometry.
function xPercent(rank: number, maxRank: number): number {
  if (maxRank <= 1) return 0;
  return ((rank - 1) / (maxRank - 1)) * PLOT_RIGHT;
}

export default function DriftChart({ entries, recentLabel = "Recent", baselineLabel = "Baseline" }: DriftChartProps) {
  const [showTable, setShowTable] = useState(false);
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <p className="drift-chart-empty">
        No movement between these two windows — try a wider comparison.
      </p>
    );
  }

  const maxRank = Math.max(
    ...entries.flatMap((e) => [e.rankRecent, e.rankBaseline].filter((r): r is number => r !== null))
  );

  // Row order: best-recent-rank-first, falling back to the baseline rank for
  // artists that dropped out of the recent window entirely. This is an
  // explicit implementer's call (the spec leaves ordering open) — "recent"
  // is what the listener is looking at right now, so their current top
  // artists read most naturally at the top of the list.
  const rows = [...entries].sort(
    (a, b) => (a.rankRecent ?? a.rankBaseline ?? Infinity) - (b.rankRecent ?? b.rankBaseline ?? Infinity)
  );

  const ticks = Array.from({ length: maxRank }, (_, i) => i + 1);

  return (
    <div className="drift-chart">
      <div className="drift-chart-legend">
        <span className="drift-chart-legend-item">
          <span className="drift-chart-legend-dot drift-chart-legend-dot-rising" />
          Rising
        </span>
        <span className="drift-chart-legend-item">
          <span className="drift-chart-legend-dot drift-chart-legend-dot-fading" />
          Fading
        </span>
        <span className="drift-chart-legend-item">
          <span className="drift-chart-legend-shape drift-chart-legend-shape-ring" />
          {baselineLabel}
        </span>
        <span className="drift-chart-legend-item">
          <span className="drift-chart-legend-shape drift-chart-legend-shape-solid" />
          {recentLabel}
        </span>
      </div>

      <button type="button" className="drift-chart-toggle" onClick={() => setShowTable((v) => !v)}>
        {showTable ? "View as chart" : "View as table"}
      </button>

      {showTable ? (
        <table className="drift-chart-table">
          <thead>
            <tr>
              <th>Artist</th>
              <th>Direction</th>
              <th>Baseline rank</th>
              <th>Recent rank</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.name}>
                <td>{entry.name}</td>
                <td>{entry.direction === "rising" ? "Rising" : "Fading"}</td>
                <td>{entry.rankBaseline !== null ? `#${entry.rankBaseline}` : "new"}</td>
                <td>{entry.rankRecent !== null ? `#${entry.rankRecent}` : "gone"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="drift-chart-plot">
          <div className="drift-chart-grid">
            {rows.map((entry, index) => {
              const isActive = hoveredName === entry.name;
              const dimmed = hoveredName !== null && !isActive;
              const opacity = dimmed ? 0.35 : 1;
              const color = entry.direction === "rising" ? "var(--accent-cyan)" : "var(--accent-coral)";

              const hasBoth = entry.rankBaseline !== null && entry.rankRecent !== null;
              // Both ranks are always labeled (not hover-gated) so the full
              // baseline -> recent movement reads at a glance. The "better"
              // (numerically lower) rank sits above the dot line, the other
              // below it, so the two labels never collide vertically even
              // when their x positions land close together.
              const betterRank = hasBoth
                ? Math.min(entry.rankBaseline as number, entry.rankRecent as number)
                : (entry.rankRecent ?? entry.rankBaseline) as number;
              const worseRank = hasBoth
                ? Math.max(entry.rankBaseline as number, entry.rankRecent as number)
                : null;

              return (
                <Fragment key={entry.name}>
                  <div className="drift-chart-label" style={{ opacity }} title={entry.name}>
                    {entry.name}
                  </div>
                  <svg className="drift-chart-row-svg" width="100%" height={ROW_HEIGHT} style={{ opacity }}>
                    <rect
                      className="drift-chart-row-hit"
                      x={0}
                      y={0}
                      width="100%"
                      height={ROW_HEIGHT}
                      fill="transparent"
                      tabIndex={0}
                      role="button"
                      aria-label={`${entry.name}: ${rankReadout(entry)}`}
                      onMouseEnter={() => setHoveredName(entry.name)}
                      onMouseLeave={() => setHoveredName(null)}
                      onFocus={() => setHoveredName(entry.name)}
                      onBlur={() => setHoveredName(null)}
                    />

                    {hasBoth && (
                      <line
                        x1={`${xPercent(entry.rankBaseline as number, maxRank)}%`}
                        y1={ROW_HEIGHT / 2}
                        x2={`${xPercent(entry.rankRecent as number, maxRank)}%`}
                        y2={ROW_HEIGHT / 2}
                        stroke={color}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    )}

                    {/* Solo dot (new/dropped artist): a null rank means the artist
                        wasn't in that period's top 5 at all — i.e. its rank there
                        is worse than any tracked rank (all <= 5). Worse is to the
                        right on this axis (1 = best = left), so the stub always
                        points right off-chart, never left. */}
                    {!hasBoth && (
                      <>
                        <line
                          x1={`${xPercent(betterRank, maxRank)}%`}
                          y1={ROW_HEIGHT / 2}
                          x2={`${STUB_END}%`}
                          y2={ROW_HEIGHT / 2}
                          stroke={color}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeDasharray="2 5"
                          opacity={0.7}
                        />
                        <text x={`${STUB_LABEL_X}%`} y={ROW_HEIGHT / 2 + 4} className="drift-chart-stub-label">
                          {entry.rankBaseline === null ? "new" : "gone"}
                        </text>
                      </>
                    )}

                    {entry.rankBaseline !== null && (
                      <circle
                        cx={`${xPercent(entry.rankBaseline, maxRank)}%`}
                        cy={ROW_HEIGHT / 2}
                        r={6}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                      />
                    )}
                    {entry.rankRecent !== null && (
                      <circle
                        cx={`${xPercent(entry.rankRecent, maxRank)}%`}
                        cy={ROW_HEIGHT / 2}
                        r={6}
                        fill={color}
                      />
                    )}

                    <text
                      x={`${xPercent(betterRank, maxRank)}%`}
                      y={ROW_HEIGHT / 2 - 11}
                      textAnchor="middle"
                      className="drift-chart-rank-label"
                    >
                      #{betterRank}
                    </text>
                    {worseRank !== null && (
                      <text
                        x={`${xPercent(worseRank, maxRank)}%`}
                        y={ROW_HEIGHT / 2 + 17}
                        textAnchor="middle"
                        className="drift-chart-rank-label drift-chart-rank-label-secondary"
                      >
                        #{worseRank}
                      </text>
                    )}
                  </svg>

                  {isActive && (
                    <div className="drift-chart-tooltip" style={{ gridRow: index + 1, gridColumn: 2 }}>
                      <div className="drift-chart-tooltip-name">{entry.name}</div>
                      <div>{baselineLabel}: {entry.rankBaseline !== null ? `#${entry.rankBaseline}` : "—"}</div>
                      <div>{recentLabel}: {entry.rankRecent !== null ? `#${entry.rankRecent}` : "—"}</div>
                      <div className="drift-chart-tooltip-readout">{rankReadout(entry)}</div>
                    </div>
                  )}
                </Fragment>
              );
            })}

            <div />
            <svg className="drift-chart-axis-svg" width="100%" height={AXIS_HEIGHT}>
              <line
                x1="0%"
                y1={0}
                x2={`${PLOT_RIGHT}%`}
                y2={0}
                stroke="var(--accent-cyan)"
                strokeWidth={1}
                opacity={0.5}
              />
              {ticks.map((rank) => (
                <g key={rank}>
                  <line
                    x1={`${xPercent(rank, maxRank)}%`}
                    y1={0}
                    x2={`${xPercent(rank, maxRank)}%`}
                    y2={6}
                    stroke="var(--accent-cyan)"
                    strokeWidth={1}
                    opacity={0.6}
                  />
                  <text x={`${xPercent(rank, maxRank)}%`} y={20} textAnchor="middle" className="drift-chart-axis-label">
                    {rank}
                  </text>
                </g>
              ))}
            </svg>
            <div />
            <div className="drift-chart-axis-title">Rank (1 = most played)</div>
          </div>
        </div>
      )}
    </div>
  );
}

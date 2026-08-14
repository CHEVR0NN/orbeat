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
// Layout constants for the SVG hover tooltip rendered inside each row's own
// <svg>. Sized from .drift-chart-tooltip's former padding/font-size so the
// SVG version keeps the same visual footprint as the HTML div it replaces.
const TOOLTIP_PADDING_X = 10;
const TOOLTIP_PADDING_Y = 8;
const TOOLTIP_LINE_HEIGHT = 14;
const TOOLTIP_CHAR_WIDTH = 6.5;
const TOOLTIP_TEXT_BASELINE_OFFSET = 10;
const TOOLTIP_GAP = 6;
const TOOLTIP_EDGE_MARGIN = 4;
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

// Left edge of a `boxWidth`-px-wide box centered under `anchorPercent`,
// clamped to stay inside the row's own bounds ([edgeMargin, 100% - box -
// edgeMargin]). Only shapes (not <text>, which parses x as a list of
// coordinates rather than a CSS length) accept this calc()/min()/max() mix,
// so it's applied to the tooltip's nested <svg> wrapper -- see its usage.
function clampedLeftEdge(anchorPercent: number, boxWidth: number): string {
  return `max(${TOOLTIP_EDGE_MARGIN}px, min(calc(100% - ${boxWidth + TOOLTIP_EDGE_MARGIN}px), calc(${anchorPercent}% - ${boxWidth / 2}px)))`;
}

export default function DriftChart({ entries, recentLabel = "Recent", baselineLabel = "Baseline" }: DriftChartProps) {
  const [showTable, setShowTable] = useState(false);
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <p className="drift-chart-empty">
        No movement between these two windows. Try a wider comparison.
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
            {rows.map((entry) => {
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

              // Hover tooltip content/geometry, computed as SVG marks inside
              // this row's own <svg> (instead of an HTML sibling positioned
              // via CSS grid coordinates) so it can never drift onto another
              // row. Anchored under betterRank's x position, clamped so the
              // box stays within the row's own bounds at either edge.
              const tooltipLines = [
                entry.name,
                `${baselineLabel}: ${entry.rankBaseline !== null ? `#${entry.rankBaseline}` : "—"}`,
                `${recentLabel}: ${entry.rankRecent !== null ? `#${entry.rankRecent}` : "—"}`,
                rankReadout(entry),
              ];
              const tooltipWidth =
                Math.max(...tooltipLines.map((line) => line.length)) * TOOLTIP_CHAR_WIDTH + TOOLTIP_PADDING_X * 2;
              const tooltipHeight = tooltipLines.length * TOOLTIP_LINE_HEIGHT + TOOLTIP_PADDING_Y * 2;
              const tooltipAnchorPercent = xPercent(betterRank, maxRank);
              const tooltipLeftEdge = clampedLeftEdge(tooltipAnchorPercent, tooltipWidth);
              const tooltipY = ROW_HEIGHT + TOOLTIP_GAP;

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

                    <line
                      x1={`${PLOT_RIGHT}%`}
                      y1={4}
                      x2={`${PLOT_RIGHT}%`}
                      y2={ROW_HEIGHT - 4}
                      stroke="var(--accent-cyan)"
                      strokeWidth={1}
                      opacity={0.2}
                      pointerEvents="none"
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
                        pointerEvents="none"
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
                          pointerEvents="none"
                        />
                        <text x={`${STUB_LABEL_X}%`} y={ROW_HEIGHT / 2 + 4} className="drift-chart-stub-label" pointerEvents="none">
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
                        pointerEvents="none"
                      />
                    )}
                    {entry.rankRecent !== null && (
                      <circle
                        cx={`${xPercent(entry.rankRecent, maxRank)}%`}
                        cy={ROW_HEIGHT / 2}
                        r={6}
                        fill={color}
                        pointerEvents="none"
                      />
                    )}

                    <text
                      x={`${xPercent(betterRank, maxRank)}%`}
                      y={ROW_HEIGHT / 2 - 11}
                      textAnchor="middle"
                      className="drift-chart-rank-label"
                      pointerEvents="none"
                    >
                      #{betterRank}
                    </text>
                    {worseRank !== null && (
                      <text
                        x={`${xPercent(worseRank, maxRank)}%`}
                        y={ROW_HEIGHT / 2 + 17}
                        textAnchor="middle"
                        className="drift-chart-rank-label drift-chart-rank-label-secondary"
                        pointerEvents="none"
                      >
                        #{worseRank}
                      </text>
                    )}

                    {isActive && (
                      // A nested <svg> (rather than a <g>) so its x/y clamp
                      // expression -- which needs calc()/min()/max() -- only
                      // has to be resolved once, on an element that supports
                      // it. Chromium accepts calc()/min()/max() for a shape's
                      // x/y (confirmed working on the rect below), but NOT
                      // for <text>'s x, which uses a separate list-of-
                      // coordinates grammar and silently resets to 0 if given
                      // one. Nesting an <svg> here gives its children a fresh
                      // local origin, so the text lines can use plain pixel
                      // numbers instead of needing that same clamp math.
                      <svg
                        x={tooltipLeftEdge}
                        y={tooltipY}
                        width={tooltipWidth}
                        height={tooltipHeight}
                        overflow="visible"
                        pointerEvents="none"
                      >
                        <rect
                          x={0}
                          y={0}
                          width={tooltipWidth}
                          height={tooltipHeight}
                          rx={8}
                          fill="var(--bg-card)"
                          stroke="var(--accent-cyan)"
                          strokeWidth={2}
                        />
                        {tooltipLines.map((line, lineIndex) => (
                          <text
                            key={lineIndex}
                            x={TOOLTIP_PADDING_X}
                            y={TOOLTIP_PADDING_Y + TOOLTIP_TEXT_BASELINE_OFFSET + lineIndex * TOOLTIP_LINE_HEIGHT}
                            className={
                              lineIndex === 0
                                ? "drift-chart-tooltip-name"
                                : lineIndex === tooltipLines.length - 1
                                  ? "drift-chart-tooltip-readout"
                                  : "drift-chart-tooltip-line"
                            }
                          >
                            {line}
                          </text>
                        ))}
                      </svg>
                    )}
                  </svg>
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

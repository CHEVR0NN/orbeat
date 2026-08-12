import type { DriftEntry } from "../lib/drift";
import type { Period } from "../types";

interface DriftPanelProps {
  entries: DriftEntry[];
  recentPeriod: Period;
  baselinePeriod: Period;
  onRecentPeriodChange: (period: Period) => void;
  onBaselinePeriodChange: (period: Period) => void;
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
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
function rankReadout(entry: DriftEntry): string {
  if (entry.rankBaseline !== null && entry.rankRecent !== null) {
    return `#${entry.rankBaseline} → #${entry.rankRecent}`;
  }
  if (entry.rankBaseline !== null) {
    return `#${entry.rankBaseline} → gone`;
  }
  return `#${entry.rankRecent} → new`;
}

export default function DriftPanel({
  entries,
  recentPeriod,
  baselinePeriod,
  onRecentPeriodChange,
  onBaselinePeriodChange,
}: DriftPanelProps) {
  const rising = entries.filter((e) => e.direction === "rising");
  const fading = entries.filter((e) => e.direction === "fading");

  return (
    <aside className="drift-panel">
      <h2>Drift</h2>
      <div className="drift-panel-periods">
        <label className="drift-panel-period-field">
          Recent
          <select
            value={recentPeriod}
            onChange={(e) => onRecentPeriodChange(e.target.value as Period)}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="drift-panel-period-field">
          Compared to
          <select
            value={baselinePeriod}
            onChange={(e) => onBaselinePeriodChange(e.target.value as Period)}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="drift-panel-note">
        Comparing your top artists across two windows — not calendar before/after.
      </p>
      <div className="drift-panel-section">
        <h3>Rising</h3>
        {rising.length === 0 ? (
          <p className="drift-panel-empty">Nothing rising this window.</p>
        ) : (
          <ul className="drift-panel-rows">
            {rising.map((entry) => (
              <li key={entry.name} className="drift-panel-row drift-panel-row-rising">
                <span className="drift-panel-row-name">{entry.name}</span>
                <span className="drift-panel-row-rank">{rankReadout(entry)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="drift-panel-section">
        <h3>Fading</h3>
        {fading.length === 0 ? (
          <p className="drift-panel-empty">Nothing fading this window.</p>
        ) : (
          <ul className="drift-panel-rows">
            {fading.map((entry) => (
              <li key={entry.name} className="drift-panel-row drift-panel-row-fading">
                <span className="drift-panel-row-name">{entry.name}</span>
                <span className="drift-panel-row-rank">{rankReadout(entry)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

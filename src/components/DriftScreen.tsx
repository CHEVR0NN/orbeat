import type { Period } from "../types";
import type { DriftEntry } from "../lib/drift";
import { PERIOD_OPTIONS } from "../lib/drift";
import DriftChart from "./DriftChart";

interface DriftScreenProps {
  entries: DriftEntry[];
  recentPeriod: Period;
  baselinePeriod: Period;
  onRecentPeriodChange: (p: Period) => void;
  onBaselinePeriodChange: (p: Period) => void;
}

export default function DriftScreen({
  entries,
  recentPeriod,
  baselinePeriod,
  onRecentPeriodChange,
  onBaselinePeriodChange,
}: DriftScreenProps) {
  const recentLabel = PERIOD_OPTIONS.find((opt) => opt.value === recentPeriod)?.label;
  const baselineLabel = PERIOD_OPTIONS.find((opt) => opt.value === baselinePeriod)?.label;

  return (
    <section className="drift-screen">
      <p className="drift-screen-header">
        Drift — which artists are climbing your rotation and which are fading out
      </p>

      <div className="drift-panel-periods">
        <label className="drift-panel-period-field">
          Recent
          <select value={recentPeriod} onChange={(e) => onRecentPeriodChange(e.target.value as Period)}>
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="drift-panel-period-field">
          Compared to
          <select value={baselinePeriod} onChange={(e) => onBaselinePeriodChange(e.target.value as Period)}>
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

      <DriftChart entries={entries} recentLabel={recentLabel} baselineLabel={baselineLabel} />
    </section>
  );
}

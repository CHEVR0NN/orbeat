interface ViewToggleProps {
  lens: "map" | "deepCuts" | "drift";
  onChange: (lens: "map" | "deepCuts" | "drift") => void;
}

export default function ViewToggle({ lens, onChange }: ViewToggleProps) {
  return (
    <div className="view-toggle" role="group" aria-label="Map view">
      <button
        type="button"
        className={`view-toggle-btn${lens === "map" ? " is-active" : ""}`}
        onClick={() => onChange("map")}
        aria-pressed={lens === "map"}
      >
        Map
      </button>
      <button
        type="button"
        className={`view-toggle-btn${lens === "deepCuts" ? " is-active" : ""}`}
        onClick={() => onChange("deepCuts")}
        aria-pressed={lens === "deepCuts"}
      >
        Deep Cuts
      </button>
      <button
        type="button"
        className={`view-toggle-btn${lens === "drift" ? " is-active" : ""}`}
        onClick={() => onChange("drift")}
        aria-pressed={lens === "drift"}
      >
        Drift
      </button>
    </div>
  );
}

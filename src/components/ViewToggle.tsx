interface ViewToggleProps {
  lens: "map" | "charts" | "drift";
  onChange: (lens: "map" | "charts" | "drift") => void;
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
        className={`view-toggle-btn${lens === "charts" ? " is-active" : ""}`}
        onClick={() => onChange("charts")}
        aria-pressed={lens === "charts"}
      >
        Charts
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

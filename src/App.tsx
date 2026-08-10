import { useEffect, useState } from "react";
import SettingsPanel from "./components/SettingsPanel";
import TasteMap from "./components/TasteMap";
import { readSettings } from "./lib/settings";
import { fetchGraphData } from "./lib/fetchGraphData";
import { buildGraph } from "./lib/graph";
import type { Settings, Graph, GraphNode } from "./types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; graph: Graph };

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(() => readSettings());
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [selected, setSelected] = useState<GraphNode | null>(null);

  useEffect(() => {
    if (!settings) return;
    let cancelled = false;
    setLoadState({ status: "loading" });
    fetchGraphData(settings, "overall")
      .then((bundle) => {
        if (cancelled) return;
        setLoadState({ status: "ready", graph: buildGraph(bundle) });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load your taste map.";
        setLoadState({ status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [settings]);

  if (!settings) {
    return <SettingsPanel onSaved={setSettings} />;
  }

  if (loadState.status === "loading") {
    return <div className="status-message">Mapping {settings.username}'s taste...</div>;
  }

  if (loadState.status === "error") {
    return (
      <div className="status-message" role="alert">
        {loadState.message}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TasteMap graph={loadState.graph} onSelectNode={setSelected} />
      {selected && (
        <aside className="node-detail">
          <h2>{selected.id}</h2>
          <p>
            {selected.kind === "core"
              ? "Core artist"
              : `Because you listen to ${selected.sourceCoreArtist}`}
          </p>
          <p>{selected.listeners.toLocaleString()} listeners</p>
          <button onClick={() => setSelected(null)}>Close</button>
        </aside>
      )}
    </div>
  );
}

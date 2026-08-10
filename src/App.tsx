import { useState } from "react";
import SettingsPanel from "./components/SettingsPanel";
import TasteMap from "./components/TasteMap";
import { readSettings } from "./lib/settings";
import type { Settings, Graph } from "./types";

const sampleGraph: Graph = {
  nodes: [
    { id: "Radiohead", kind: "core", relevance: 1, listeners: 4000000 },
    {
      id: "Boards of Canada",
      kind: "candidate",
      relevance: 0.8,
      listeners: 300000,
      sourceCoreArtist: "Radiohead",
      match: 0.8,
    },
    {
      id: "Obscure Deep Cut",
      kind: "candidate",
      relevance: 0.4,
      listeners: 5000,
      sourceCoreArtist: "Radiohead",
      match: 0.4,
    },
  ],
  links: [
    { source: "Radiohead", target: "Boards of Canada" },
    { source: "Radiohead", target: "Obscure Deep Cut" },
  ],
};

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(() => readSettings());

  if (!settings) {
    return <SettingsPanel onSaved={setSettings} />;
  }

  return <TasteMap graph={sampleGraph} onSelectNode={() => {}} />;
}

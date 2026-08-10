import { useState } from "react";
import SettingsPanel from "./components/SettingsPanel";
import { readSettings } from "./lib/settings";
import type { Settings } from "./types";

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(() => readSettings());

  if (!settings) {
    return <SettingsPanel onSaved={setSettings} />;
  }

  return <div>Map coming soon for {settings.username}</div>;
}

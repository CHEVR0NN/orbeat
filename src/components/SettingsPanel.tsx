import { useState, type FormEvent } from "react";
import { writeSettings } from "../lib/settings";
import { getTopArtists, LastfmError } from "../lib/lastfm";
import type { Settings } from "../types";

interface SettingsPanelProps {
  onSaved: (settings: Settings) => void;
}

export default function SettingsPanel({ onSaved }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!apiKey.trim() || !username.trim()) {
      setError("Enter both an API key and a Last.fm username.");
      return;
    }

    setChecking(true);
    try {
      await getTopArtists(apiKey.trim(), username.trim(), "overall");
      const settings: Settings = { apiKey: apiKey.trim(), username: username.trim() };
      writeSettings(settings);
      onSaved(settings);
    } catch (err) {
      if (err instanceof LastfmError) {
        setError(`Last.fm rejected that key/username: ${err.message}`);
      } else {
        setError("Couldn't reach Last.fm. Check your connection and try again.");
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="settings-panel">
      <h1>Orbeat</h1>
      <p>
        Enter your Last.fm API key and username to build your taste map. Get a
        free key at{" "}
        <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer">
          last.fm/api/account/create
        </a>
        .
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          API key
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </label>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={checking}>
          {checking ? "Checking..." : "Build my map"}
        </button>
      </form>
    </div>
  );
}

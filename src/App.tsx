import { useEffect, useState } from "react";
import SettingsPanel from "./components/SettingsPanel";
import TasteMap from "./components/TasteMap";
import ProfileCard from "./components/ProfileCard";
import { readSettings, clearSettings } from "./lib/settings";
import { fetchGraphData } from "./lib/fetchGraphData";
import { fetchProfileData } from "./lib/fetchProfileData";
import { buildGraph } from "./lib/graph";
import { topGenre } from "./lib/profileStats";
import type { Settings, Graph, GraphNode, UserProfile, TopAlbum } from "./types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      graph: Graph;
      topArtistName: string | null;
      topGenreName: string | null;
    };

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(() => readSettings());
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [topAlbum, setTopAlbum] = useState<TopAlbum | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!settings) return;
    let cancelled = false;
    setLoadState({ status: "loading" });

    fetchGraphData(settings, "overall")
      .then((bundle) => {
        if (cancelled) return;
        setLoadState({
          status: "ready",
          graph: buildGraph(bundle),
          topArtistName: bundle.core[0]?.name ?? null,
          topGenreName: topGenre(bundle.tagsByArtist),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load your taste map.";
        setLoadState({ status: "error", message });
      });

    fetchProfileData(settings)
      .then((bundle) => {
        if (cancelled) return;
        setProfile(bundle.profile);
        setTopAlbum(bundle.topAlbum);
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
        setTopAlbum(null);
      });

    return () => {
      cancelled = true;
    };
  }, [settings]);

  async function handleRefresh() {
    if (!settings) return;
    setRefreshing(true);
    try {
      const [bundle, profileBundle] = await Promise.all([
        fetchGraphData(settings, "overall", undefined, undefined, true),
        fetchProfileData(settings, undefined, true).catch(() => null),
      ]);
      setLoadState({
        status: "ready",
        graph: buildGraph(bundle),
        topArtistName: bundle.core[0]?.name ?? null,
        topGenreName: topGenre(bundle.tagsByArtist),
      });
      if (profileBundle) {
        setProfile(profileBundle.profile);
        setTopAlbum(profileBundle.topAlbum);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to refresh your taste map.";
      setLoadState({ status: "error", message });
    } finally {
      setRefreshing(false);
    }
  }

  function handleChangeAccount() {
    clearSettings();
    setSettings(null);
    setProfile(null);
    setTopAlbum(null);
  }

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
    <div className="app-shell-layout">
      <ProfileCard
        username={profile?.name || settings.username}
        avatarUrl={profile?.image ?? null}
        topArtistName={loadState.topArtistName}
        topAlbumName={topAlbum?.name ?? null}
        totalScrobbles={profile?.playcount ?? null}
        topGenreName={loadState.topGenreName}
        onRefresh={handleRefresh}
        onChangeAccount={handleChangeAccount}
        refreshing={refreshing}
      />
      <div className="map-area">
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
            {selected.match !== undefined && <p>{Math.round(selected.match * 100)}% similar</p>}
            <button onClick={() => setSelected(null)}>Close</button>
          </aside>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import SettingsPanel from "./components/SettingsPanel";
import TasteMap from "./components/TasteMap";
import ProfileCard from "./components/ProfileCard";
import DeepCutsList from "./components/DeepCutsList";
import LoadingAstronaut from "./components/LoadingAstronaut";
import FloatingDecor from "./components/FloatingDecor";
import { readSettings, clearSettings } from "./lib/settings";
import { fetchGraphData } from "./lib/fetchGraphData";
import { fetchProfileData } from "./lib/fetchProfileData";
import { buildGraph } from "./lib/graph";
import { topGenre, topGenres } from "./lib/profileStats";
import { getRecentTracks } from "./lib/lastfm";
import { rankDeepCuts } from "./lib/deepCuts";
import type {
  Settings,
  Graph,
  GraphNode,
  UserProfile,
  TopAlbum,
  NowPlayingTrack,
  GenreCount,
} from "./types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      graph: Graph;
      topArtistName: string | null;
      topGenreName: string | null;
      topGenres: GenreCount[];
    };

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(() => readSettings());
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [topAlbum, setTopAlbum] = useState<TopAlbum | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<NowPlayingTrack | null>(null);
  const [lens, setLens] = useState<"map" | "deepCuts">("map");
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  const deepCuts = useMemo(
    () => (loadState.status === "ready" ? rankDeepCuts(loadState.graph.nodes) : []),
    [loadState]
  );
  const deepCutIds = useMemo(() => new Set(deepCuts.map((d) => d.node.id)), [deepCuts]);

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
          topGenres: topGenres(bundle.tagsByArtist),
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

  useEffect(() => {
    if (!settings) return;
    let cancelled = false;

    function poll() {
      if (!settings) return;
      getRecentTracks(settings.apiKey, settings.username)
        .then((tracks) => {
          if (cancelled) return;
          const current = tracks[0];
          setNowPlaying(current?.nowPlaying ? current : null);
        })
        .catch(() => {
          // live poll — swallow errors and leave nowPlaying as-is
        });
    }

    poll();
    const interval = setInterval(poll, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [settings]);

  // Clears focusNodeId back to null right after TasteMap has had a chance to
  // consume it, so clicking the same Deep Cuts row twice still re-triggers
  // the zoom (a no-op state change wouldn't re-fire TasteMap's effect).
  useEffect(() => {
    if (focusNodeId === null) return;
    const id = setTimeout(() => setFocusNodeId(null), 0);
    return () => clearTimeout(id);
  }, [focusNodeId]);

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
        topGenres: topGenres(bundle.tagsByArtist),
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
    setLoadState({ status: "loading" });
    setSelected(null);
  }

  function handleDeepCutSelect(node: GraphNode) {
    setSelected(node);
    setFocusNodeId(node.id);
  }

  if (!settings) {
    return (
      <>
        <FloatingDecor />
        <SettingsPanel onSaved={setSettings} />
      </>
    );
  }

  if (loadState.status === "loading") {
    return <LoadingAstronaut message={`Mapping ${settings.username}'s taste...`} />;
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
      <FloatingDecor />
      <ProfileCard
        username={profile?.name || settings.username}
        avatarUrl={profile?.image ?? null}
        topArtistName={loadState.topArtistName}
        topAlbumName={topAlbum?.name ?? null}
        totalScrobbles={profile?.playcount ?? null}
        topGenreName={loadState.topGenreName}
        nowPlaying={nowPlaying}
        topGenres={loadState.topGenres}
        onRefresh={handleRefresh}
        onChangeAccount={handleChangeAccount}
        refreshing={refreshing}
        lens={lens}
        onLensChange={setLens}
      />
      <div className="map-area">
        <TasteMap
          graph={loadState.graph}
          onSelectNode={setSelected}
          lens={lens}
          deepCutIds={deepCutIds}
          focusNodeId={focusNodeId}
        />
        {selected ? (
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
        ) : (
          lens === "deepCuts" && <DeepCutsList deepCuts={deepCuts} onSelect={handleDeepCutSelect} />
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import SettingsPanel from "./components/SettingsPanel";
import TasteMap from "./components/TasteMap";
import ProfileCard from "./components/ProfileCard";
import RhythmScreen from "./components/RhythmScreen";
import DriftScreen from "./components/DriftScreen";
import LoadingAstronaut from "./components/LoadingAstronaut";
import FloatingDecor from "./components/FloatingDecor";
import ViewToggle from "./components/ViewToggle";
import { readSettings, clearSettings } from "./lib/settings";
import { fetchGraphData } from "./lib/fetchGraphData";
import { fetchProfileData } from "./lib/fetchProfileData";
import { fetchDriftData } from "./lib/fetchDrift";
import { fetchRhythmData } from "./lib/fetchRhythmData";
import { buildGraph } from "./lib/graph";
import { topGenre, topGenres } from "./lib/profileStats";
import { getRecentTracks } from "./lib/lastfm";
import { computeDrift } from "./lib/drift";
import type {
  Settings,
  Graph,
  GraphNode,
  UserProfile,
  TopAlbum,
  NowPlayingTrack,
  GenreCount,
  TopArtist,
  Period,
  ScrobbleEvent,
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
  const [topAlbums, setTopAlbums] = useState<TopAlbum[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<NowPlayingTrack | null>(null);
  const [lens, setLens] = useState<"map" | "rhythm" | "drift">("map");
  const [recentPeriod, setRecentPeriod] = useState<Period>("3month");
  const [baselinePeriod, setBaselinePeriod] = useState<Period>("12month");
  const [driftData, setDriftData] = useState<{ recent: TopArtist[]; baseline: TopArtist[] }>({
    recent: [],
    baseline: [],
  });
  const [rhythmData, setRhythmData] = useState<ScrobbleEvent[]>([]);
  const [rhythmLoading, setRhythmLoading] = useState(false);

  const driftEntries = useMemo(
    () => computeDrift(driftData.recent, driftData.baseline),
    [driftData]
  );

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
        setTopAlbums(bundle.topAlbums);
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
        setTopAlbums([]);
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

  // Fetches Drift's two-period comparison only while the Drift lens is
  // active -- no need to prefetch it while on the Map/Rhythm lenses.
  useEffect(() => {
    if (!settings || lens !== "drift") return;
    let cancelled = false;

    fetchDriftData(settings, recentPeriod, baselinePeriod)
      .then((bundle) => {
        if (cancelled) return;
        setDriftData(bundle);
      })
      .catch(() => {
        if (cancelled) return;
        setDriftData({ recent: [], baseline: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [settings, lens, recentPeriod, baselinePeriod]);

  // Fetches Rhythm's scrobble history only while the Rhythm lens is
  // active -- no need to prefetch it while on the Map/Drift lenses.
  useEffect(() => {
    if (!settings || lens !== "rhythm") return;
    let cancelled = false;
    setRhythmLoading(true);

    fetchRhythmData(settings)
      .then((bundle) => {
        if (cancelled) return;
        setRhythmData(bundle);
        setRhythmLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRhythmData([]);
        setRhythmLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [settings, lens]);

  // Clears the selected node's detail overlay when leaving the Map tab, so
  // it isn't left open (but hidden) as stale state if the user tabs back in.
  useEffect(() => {
    if (lens !== "map") setSelected(null);
  }, [lens]);

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
        setTopAlbums(profileBundle.topAlbums);
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
    setTopAlbums([]);
    setLoadState({ status: "loading" });
    setSelected(null);
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
        topAlbumName={topAlbums[0]?.name ?? null}
        totalScrobbles={profile?.playcount ?? null}
        topGenreName={loadState.topGenreName}
        nowPlaying={nowPlaying}
        topGenres={loadState.topGenres}
        onRefresh={handleRefresh}
        onChangeAccount={handleChangeAccount}
        refreshing={refreshing}
      />
      <div className="app-main">
        <div className="app-tabbar">
          <ViewToggle lens={lens} onChange={setLens} />
        </div>
        {lens === "map" ? (
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
                {selected.match !== undefined && (
                  <p>{Math.round(selected.match * 100)}% similar</p>
                )}
                <button onClick={() => setSelected(null)}>Close</button>
              </aside>
            )}
          </div>
        ) : lens === "rhythm" ? (
          <div className="map-area">
            <RhythmScreen scrobbles={rhythmData} isLoading={rhythmLoading} />
          </div>
        ) : (
          <div className="map-area">
            <DriftScreen
              entries={driftEntries}
              recentPeriod={recentPeriod}
              baselinePeriod={baselinePeriod}
              onRecentPeriodChange={setRecentPeriod}
              onBaselinePeriodChange={setBaselinePeriod}
            />
          </div>
        )}
      </div>
    </div>
  );
}

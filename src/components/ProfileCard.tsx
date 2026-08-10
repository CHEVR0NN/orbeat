import { Radio } from "lucide-react";
import type { NowPlayingTrack, GenreCount } from "../types";

interface ProfileCardProps {
  username: string;
  avatarUrl: string | null;
  topArtistName: string | null;
  topAlbumName: string | null;
  totalScrobbles: number | null;
  topGenreName: string | null;
  nowPlaying: NowPlayingTrack | null;
  topGenres: GenreCount[];
  onRefresh: () => void;
  onChangeAccount: () => void;
  refreshing: boolean;
}

const SECTORS = ["SECTOR 7-G", "SECTOR 12-B", "SECTOR 3-K", "SECTOR 9-R"];

// Deterministic per-username ID/sector: same username always maps to the
// same values, no randomness.
function deriveIdentity(username: string): { systemId: string; sector: string } {
  let sum = 0;
  for (let i = 0; i < username.length; i++) {
    sum += username.charCodeAt(i);
  }
  const systemId = `#ORB-${String(sum % 10000).padStart(4, "0")}-${sum % 10}`;
  const sector = SECTORS[sum % SECTORS.length];
  return { systemId, sector };
}

export default function ProfileCard({
  username,
  avatarUrl,
  topArtistName,
  topAlbumName,
  totalScrobbles,
  topGenreName,
  nowPlaying,
  topGenres,
  onRefresh,
  onChangeAccount,
  refreshing,
}: ProfileCardProps) {
  const { systemId, sector } = deriveIdentity(username);
  const maxGenreCount = topGenres[0]?.count ?? 0;

  return (
    <aside className="profile-card">
      {/* 1. Identity block */}
      <div className="profile-card-identity">
        {avatarUrl ? (
          <img className="profile-card-avatar" src={avatarUrl} alt="" />
        ) : (
          <div className="profile-card-avatar profile-card-avatar-placeholder" aria-hidden="true">
            👽
          </div>
        )}
        <div className="profile-card-identity-text">
          <span className="profile-card-species">Species identified: {username}</span>
          <span className="profile-card-identity-meta">{systemId}</span>
          <span className="profile-card-identity-meta">{sector}</span>
        </div>
      </div>

      {/* 2. Now Scrobbling block */}
      <div className={`profile-card-now-playing${nowPlaying ? "" : " is-standby"}`}>
        <Radio className="profile-card-now-playing-icon" size={20} aria-hidden="true" />
        <div className="profile-card-now-playing-info">
          <span className="profile-card-now-playing-label">Now Scrobbling</span>
          <span className="profile-card-now-playing-track">
            {nowPlaying ? `${nowPlaying.name} — ${nowPlaying.artist}` : "NO SIGNAL // STANDBY"}
          </span>
        </div>
      </div>

      {/* 3. Core Metrics block */}
      <dl className="profile-card-stats">
        <div className="profile-card-stat">
          <dt>Top Artist</dt>
          <dd>{topArtistName ?? "—"}</dd>
        </div>
        <div className="profile-card-stat">
          <dt>Top Album</dt>
          <dd>{topAlbumName ?? "—"}</dd>
        </div>
        <div className="profile-card-stat">
          <dt>Top Genre</dt>
          <dd>{topGenreName ?? "—"}</dd>
        </div>
        <div className="profile-card-stat">
          <dt>Total Scrobbles</dt>
          <dd>{totalScrobbles !== null ? totalScrobbles.toLocaleString() : "—"}</dd>
        </div>
      </dl>

      {/* 4. Genre Visualizer block */}
      <div className="profile-card-genres">
        <span className="profile-card-genres-title">Genre Distribution</span>
        <div className="profile-card-genre-bars">
          {topGenres.map((genre, i) => (
            <div
              key={genre.name}
              className={`profile-card-genre-bar profile-card-genre-color-${i % 4}`}
              style={{ height: maxGenreCount ? `${(genre.count / maxGenreCount) * 100}%` : "0%" }}
              title={genre.name}
            />
          ))}
        </div>
      </div>

      {/* 5. Legend block */}
      <div className="profile-card-genre-legend">
        {topGenres.map((genre, i) => (
          <span key={genre.name} className="profile-card-legend-item">
            <span className={`profile-card-legend-dot profile-card-genre-color-${i % 4}`} />
            {genre.name}
          </span>
        ))}
      </div>

      {/* Footer: taste-map legend + controls, subordinate to the 5 blocks above */}
      <div className="profile-card-footer">
        <div className="profile-card-legend">
          <span className="profile-card-legend-item">
            <span className="profile-card-legend-dot profile-card-legend-dot-core" /> core
          </span>
          <span className="profile-card-legend-item">
            <span className="profile-card-legend-dot profile-card-legend-dot-candidate" /> candidate
          </span>
        </div>

        <div className="profile-card-controls">
          <button type="button" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" onClick={onChangeAccount}>
            Change Account
          </button>
        </div>
      </div>
    </aside>
  );
}

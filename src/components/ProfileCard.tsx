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
function deriveIdentity(username: string): { systemId: string; sector: string; licenseNo: string } {
  let sum = 0;
  for (let i = 0; i < username.length; i++) {
    sum += username.charCodeAt(i);
  }
  const systemId = `#ORB-${String(sum % 10000).padStart(4, "0")}-${sum % 10}`;
  const sector = SECTORS[sum % SECTORS.length];
  const licenseNo = `ORB-2026-${String(10 + (sum % 90))}${String.fromCharCode(65 + (sum % 26))}`;
  return { systemId, sector, licenseNo };
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
  const { systemId, sector, licenseNo } = deriveIdentity(username);
  const maxGenreCount = topGenres[0]?.count ?? 0;
  const today = new Date();
  const todayLabel = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(
    today.getDate()
  ).padStart(2, "0")}`;

  return (
    <aside className="profile-card">
      <div className="profile-card-topstrip" aria-hidden="true" />

      {/* 1. Identity band */}
      <div className="profile-card-identity">
        {avatarUrl ? (
          <img className="profile-card-avatar" src={avatarUrl} alt="" />
        ) : (
          <div className="profile-card-avatar profile-card-avatar-placeholder" aria-hidden="true">
            👽
          </div>
        )}
        <div className="profile-card-identity-text">
          <span className="profile-card-species-label">[Species identified]</span>
          <div className="profile-card-stamp-wrap">
            <span className="profile-card-stamp">{username}</span>
            <span className="profile-card-verified-badge" aria-hidden="true">
              ✓
            </span>
          </div>
          <span className="profile-card-identity-meta">System ID: {systemId}</span>
          <span className="profile-card-identity-meta">License No: {licenseNo}</span>
          <span className="profile-card-identity-meta">Sector: {sector}</span>
        </div>
      </div>

      {/* 2. Now-scrobbling band */}
      <div className={`profile-card-now-playing${nowPlaying ? "" : " is-standby"}`}>
        <div className="profile-card-now-playing-track">
          <Radio className="profile-card-now-playing-icon" size={16} aria-hidden="true" />
          <span className="profile-card-now-playing-text">
            {nowPlaying ? `[Live frequency] ${nowPlaying.name} — ${nowPlaying.artist}` : "[No signal] Standby"}
          </span>
        </div>
        <span className="profile-card-now-playing-signal">
          Signal: 108.4 MHz // {nowPlaying ? "Audio freq active" : "Awaiting feed"}
        </span>
      </div>

      {/* 3. Metrics band */}
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

      {/* 4. Genre visualizer band */}
      <div className="profile-card-genre-band">
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
        <div className="profile-card-genre-legend">
          {topGenres.map((genre, i) => (
            <span key={genre.name} className="profile-card-legend-item">
              <span className={`profile-card-legend-dot profile-card-genre-color-${i % 4}`} />
              {genre.name}
            </span>
          ))}
        </div>
      </div>

      {/* 5. Footer band: status readout + taste-map legend + controls */}
      <div className="profile-card-footer">
        <div className="profile-card-footer-status">
          <span className="profile-card-status-dot" aria-hidden="true" />
          <span>System online // {todayLabel}</span>
          <span className="profile-card-signal-readout" aria-hidden="true">
            ▂▄▆█
          </span>
        </div>

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

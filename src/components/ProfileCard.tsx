interface ProfileCardProps {
  username: string;
  avatarUrl: string | null;
  topArtistName: string | null;
  topAlbumName: string | null;
  totalScrobbles: number | null;
  topGenreName: string | null;
  onRefresh: () => void;
  onChangeAccount: () => void;
  refreshing: boolean;
}

export default function ProfileCard({
  username,
  avatarUrl,
  topArtistName,
  topAlbumName,
  totalScrobbles,
  topGenreName,
  onRefresh,
  onChangeAccount,
  refreshing,
}: ProfileCardProps) {
  return (
    <aside className="profile-card">
      <div className="profile-card-identity">
        {avatarUrl ? (
          <img className="profile-card-avatar" src={avatarUrl} alt="" />
        ) : (
          <div className="profile-card-avatar profile-card-avatar-placeholder" aria-hidden="true">
            👽
          </div>
        )}
        <span className="profile-card-username">{username}</span>
      </div>

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
          <dt>Total Scrobbles</dt>
          <dd>{totalScrobbles !== null ? totalScrobbles.toLocaleString() : "—"}</dd>
        </div>
        <div className="profile-card-stat">
          <dt>Top Genre</dt>
          <dd>{topGenreName ?? "—"}</dd>
        </div>
      </dl>

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
    </aside>
  );
}

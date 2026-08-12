import type { TopArtist, TopAlbum, GenreCount } from "../types";

interface ChartsScreenProps {
  topArtists: TopArtist[];
  topAlbums: TopAlbum[];
  topGenres: GenreCount[];
}

export default function ChartsScreen({ topArtists, topAlbums, topGenres }: ChartsScreenProps) {
  const maxGenreCount = topGenres[0]?.count ?? 0;

  return (
    <section className="charts-screen">
      <p className="charts-screen-header">Charts — your top artists, albums, and genres, ranked</p>

      <div className="charts-screen-section">
        <h2 className="charts-screen-section-title">Top Artists</h2>
        {topArtists.length === 0 ? (
          <p className="charts-screen-empty">No top artists yet — keep listening.</p>
        ) : (
          <ol className="charts-screen-artist-list">
            {topArtists.map((artist, i) => (
              <li className="charts-screen-artist-row" key={artist.name}>
                <span className="charts-screen-rank-badge">#{i + 1}</span>
                <span className="charts-screen-artist-name">{artist.name}</span>
                <span className="charts-screen-artist-playcount">
                  {artist.playcount.toLocaleString()} plays
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="charts-screen-section">
        <h2 className="charts-screen-section-title">Top Albums</h2>
        {topAlbums.length === 0 ? (
          <p className="charts-screen-empty">No top albums yet — keep listening.</p>
        ) : (
          <div className="charts-screen-album-grid">
            {topAlbums.map((album, i) => (
              <div className="charts-screen-album-card" key={`${album.artist}—${album.name}`}>
                <span className="charts-screen-rank-badge">#{i + 1}</span>
                {album.image ? (
                  <img className="charts-screen-album-cover" src={album.image} alt="" />
                ) : (
                  <div
                    className="charts-screen-album-cover charts-screen-album-cover-placeholder"
                    aria-hidden="true"
                  >
                    💿
                  </div>
                )}
                <span className="charts-screen-album-name">{album.name}</span>
                <span className="charts-screen-album-artist">{album.artist}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="charts-screen-section">
        <h2 className="charts-screen-section-title">Top Genres</h2>
        {topGenres.length === 0 ? (
          <p className="charts-screen-empty">No top genres yet — keep listening.</p>
        ) : (
          <div className="charts-screen-genre-bars">
            {topGenres.map((genre, i) => (
              <div className="charts-screen-genre-row" key={genre.name}>
                <span className="charts-screen-genre-label">{genre.name}</span>
                <div className="charts-screen-genre-track">
                  <div
                    className={`charts-screen-genre-bar profile-card-genre-color-${i % 4}`}
                    style={{ width: maxGenreCount ? `${(genre.count / maxGenreCount) * 100}%` : "0%" }}
                  />
                </div>
                <span className="charts-screen-genre-count">{genre.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

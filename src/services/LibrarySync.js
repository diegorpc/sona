import SubsonicAPI from './SubsonicAPI';
import CacheService from './CacheService';

// Background warm-up for LibraryScreen's cache. LibraryScreen only hits the
// network for a given tab when its CacheService entry is empty (or on a
// manual pull-to-refresh) — so on a cold app launch, before the user has
// ever opened Library, those entries don't exist yet and every tab is a
// cold network fetch. Calling this after login pre-populates the ones that
// matter most (default-sort albums, liked songs, playlists) so Library is
// instant and already reflects anything new on the server.
//
// Deliberately does NOT touch the 'artists' cache key — LibraryScreen
// enriches artists with per-artist image URLs the first time it fetches them
// itself, and pre-seeding a plain artist list here would make it take the
// cached-fast-path and skip that enrichment, leaving artist rows imageless
// until a manual refresh.

const MIN_INTERVAL_MS = 5 * 60 * 1000; // throttle re-syncs (app re-checks login on every nav change)
let lastSyncAt = 0;
let inFlight = null;

export function syncLibrary({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastSyncAt < MIN_INTERVAL_MS) return inFlight || Promise.resolve();

  lastSyncAt = now;
  inFlight = (async () => {
    try {
      const [albums, starred, playlistsResp] = await Promise.all([
        SubsonicAPI.getAllAlbums('newest', 2000).catch(() => null),
        SubsonicAPI.getStarred().catch(() => null),
        SubsonicAPI.getPlaylists().catch(() => null),
      ]);

      if (albums) await CacheService.set('albums_newest', albums);
      if (starred) await CacheService.set('likedSongs', starred.song || []);
      if (playlistsResp?.playlist) await CacheService.set('playlists', playlistsResp.playlist);
    } catch (error) {
      console.error('Error syncing library:', error);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

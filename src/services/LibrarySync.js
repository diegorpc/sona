import SubsonicAPI from './SubsonicAPI';
import CacheService from './CacheService';

/**
 * @fileoverview Background warm-up for LibraryScreen's cache.
 *
 * LibraryScreen only hits the network for a given tab when its CacheService
 * entry is empty (or on a manual pull-to-refresh) — so without this, a
 * populated Library would never notice new albums/songs/playlists on the
 * server, and a cold first launch would fetch every tab on open. Running
 * this after login keeps the keys that matter most (default-sort albums,
 * liked songs, playlists) warm and current.
 *
 * The `artists` cache key is deliberately skipped: LibraryScreen fetches
 * and caches that list itself the first time the tab is opened, and
 * re-seeding it here would just duplicate that write.
 */

const MIN_INTERVAL_MS = 5 * 60 * 1000;
let lastSyncAt = 0;
let inFlight = null;

/**
 * Refresh LibraryScreen's core cache keys from the network. Fire-and-forget
 * from App.js after every successful login-status check; internally
 * throttled to once per 5 minutes because that check re-runs on every
 * navigation-state change. Individual fetch failures are swallowed —
 * whatever succeeds is cached.
 *
 * @param {Object} [options]
 * @param {boolean} [options.force] Bypass the throttle.
 * @returns {Promise<void>} Resolves when the sync (or the already-running
 *   one) finishes.
 */
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

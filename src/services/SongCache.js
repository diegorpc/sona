import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SubsonicAPI from './SubsonicAPI';
import { getAppSettings } from './AppSettings';

/**
 * @fileoverview Disk cache for full song files (the "Music" cache in
 * Settings → Storage), exported as a singleton.
 *
 * Files live in `documentDirectory/music/`; the index (per-song size,
 * last-played timestamp, format, plus the user-set budget) is one
 * AsyncStorage record under `@sona_music_cache_index`.
 *
 * Cached songs are **never evicted automatically** — a song persists until
 * removed explicitly (`removeSong`, `clearAll`) or until the user lowers the
 * budget via `setMaxSize`, which prunes least-recently-played-first to fit.
 * There is deliberately no LRU sweep on download: a song file can't go
 * "stale" the way list metadata can.
 *
 * Download quality follows the `originalQualityCaching` app setting: the
 * original server file (`format=raw`) or an MP3 320 kbps transcode.
 *
 * The download entry points (`cacheSong` / `cacheSongs` / `cacheAlbum` /
 * `cachePlaylist`) are not yet wired to any UI — they exist for future
 * download menus. `getCachedUri` is live: AudioPlayer uses it to prefer
 * local playback over streaming.
 */

const MUSIC_DIR = `${FileSystem.documentDirectory}music/`;
const INDEX_KEY = '@sona_music_cache_index';
const DEFAULT_MAX_SIZE_MB = 2048;
const TRANSCODE_OPTIONS = { format: 'mp3', maxBitRate: 320 };

class SongCache {
  constructor() {
    this.index = null; // { entries: { [songId]: { size, timestamp, format } }, totalSizeBytes, maxSizeMB }
    this.pendingDownloads = new Map(); // songId -> Promise
    this.initPromise = null;
  }

  /**
   * Local file path for a song id, with unsafe characters sanitized.
   * @param {string} songId
   * @param {string} format `'mp3'` or `'raw'` (stored as `.audio`).
   * @returns {string}
   */
  fileUri(songId, format) {
    const safeId = String(songId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${MUSIC_DIR}${safeId}.${format === 'mp3' ? 'mp3' : 'audio'}`;
  }

  /**
   * Create the music directory and load the index. Called lazily by every
   * public method; concurrent calls share one in-flight promise.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.index) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        await FileSystem.makeDirectoryAsync(MUSIC_DIR, { intermediates: true }).catch(() => {});
        const raw = await AsyncStorage.getItem(INDEX_KEY);
        this.index = raw
          ? JSON.parse(raw)
          : { entries: {}, totalSizeBytes: 0, maxSizeMB: DEFAULT_MAX_SIZE_MB };
        if (!this.index.maxSizeMB) this.index.maxSizeMB = DEFAULT_MAX_SIZE_MB;
      } catch (error) {
        console.error('Error initializing song cache:', error);
        this.index = { entries: {}, totalSizeBytes: 0, maxSizeMB: DEFAULT_MAX_SIZE_MB };
      }
    })();
    return this.initPromise;
  }

  /** Persist the index to AsyncStorage. @returns {Promise<void>} */
  async saveIndex() {
    try {
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(this.index));
    } catch (error) {
      console.error('Error saving song cache index:', error);
    }
  }

  /**
   * Whether a song has an index entry (does not verify the file on disk;
   * use {@link SongCache#getCachedUri} for that).
   * @param {string} songId
   * @returns {Promise<boolean>}
   */
  async isCached(songId) {
    await this.initialize();
    return !!this.index.entries[songId];
  }

  /**
   * Resolve a playable local URI for a cached song. Verifies the file still
   * exists (dropping the index entry if the OS or user deleted it) and
   * touches the LRU timestamp used by the `setMaxSize` prune path.
   * @param {string} songId
   * @returns {Promise<?string>} Local `file://` URI, or null when not cached.
   */
  async getCachedUri(songId) {
    await this.initialize();
    const entry = this.index.entries[songId];
    if (!entry) return null;

    const uri = this.fileUri(songId, entry.format);
    const info = await FileSystem.getInfoAsync(uri).catch(() => null);
    if (!info?.exists) {
      // File vanished (OS cleanup, manual delete) — drop the stale entry
      this.index.totalSizeBytes -= entry.size;
      delete this.index.entries[songId];
      await this.saveIndex();
      return null;
    }

    entry.timestamp = Date.now();
    this.saveIndex();
    return uri;
  }

  /**
   * Download one track into the cache. Concurrent requests for the same
   * song share a single download.
   * @param {Object|string} track Track object or bare song id.
   * @returns {Promise<?string>} Local URI, or null on failure.
   */
  async cacheSong(track) {
    const songId = typeof track === 'object' ? track?.id : track;
    if (!songId) return null;

    await this.initialize();
    const existing = await this.getCachedUri(songId);
    if (existing) return existing;
    if (this.pendingDownloads.has(songId)) return this.pendingDownloads.get(songId);

    const promise = (async () => {
      try {
        const settings = await getAppSettings();
        const transcode = !settings.originalQualityCaching;
        const format = transcode ? 'mp3' : 'raw';
        const streamUrl = SubsonicAPI.getStreamUrl(
          songId,
          transcode ? TRANSCODE_OPTIONS : { format: 'raw' }
        );

        const target = this.fileUri(songId, format);
        const result = await FileSystem.downloadAsync(streamUrl, target);
        if (result.status !== 200) {
          await FileSystem.deleteAsync(target, { idempotent: true });
          return null;
        }

        const info = await FileSystem.getInfoAsync(target);
        const bytes = info.size || 0;
        this.index.entries[songId] = { size: bytes, timestamp: Date.now(), format };
        this.index.totalSizeBytes += bytes;
        await this.saveIndex();
        return target;
      } catch (error) {
        console.error(`Error caching song ${songId}:`, error);
        return null;
      } finally {
        this.pendingDownloads.delete(songId);
      }
    })();

    this.pendingDownloads.set(songId, promise);
    return promise;
  }

  /**
   * Download multiple tracks sequentially (one at a time, to keep server
   * load and bandwidth bounded).
   * @param {Object[]} tracks
   * @returns {Promise<number>} Count of songs now present in the cache.
   */
  async cacheSongs(tracks) {
    let cached = 0;
    for (const track of tracks || []) {
      const uri = await this.cacheSong(track);
      if (uri) cached += 1;
    }
    return cached;
  }

  /**
   * Download every track of an album.
   * @param {string} albumId
   * @returns {Promise<number>} Count of songs now present in the cache.
   */
  async cacheAlbum(albumId) {
    const album = await SubsonicAPI.getAlbum(albumId);
    return this.cacheSongs(album?.song || []);
  }

  /**
   * Download every track of a playlist.
   * @param {string} playlistId
   * @returns {Promise<number>} Count of songs now present in the cache.
   */
  async cachePlaylist(playlistId) {
    const playlist = await SubsonicAPI.getPlaylist(playlistId);
    return this.cacheSongs(playlist?.entry || []);
  }

  /**
   * Delete one cached song file and its index entry.
   * @param {string} songId
   * @returns {Promise<void>}
   */
  async removeSong(songId) {
    await this.initialize();
    const entry = this.index.entries[songId];
    if (!entry) return;
    await FileSystem.deleteAsync(this.fileUri(songId, entry.format), { idempotent: true }).catch(() => {});
    this.index.totalSizeBytes -= entry.size;
    delete this.index.entries[songId];
    await this.saveIndex();
  }

  /**
   * Evict least-recently-played songs until the cache fits its budget.
   * Never runs automatically on download — only when the user explicitly
   * lowers the budget via {@link SongCache#setMaxSize}.
   * @returns {Promise<void>}
   */
  async pruneToBudget() {
    const maxBytes = this.index.maxSizeMB * 1024 * 1024;
    if (this.index.totalSizeBytes <= maxBytes) return;

    const entries = Object.entries(this.index.entries)
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (const [songId, entry] of entries) {
      if (this.index.totalSizeBytes <= maxBytes) break;
      await FileSystem.deleteAsync(this.fileUri(songId, entry.format), { idempotent: true }).catch(() => {});
      this.index.totalSizeBytes -= entry.size;
      delete this.index.entries[songId];
    }
    await this.saveIndex();
  }

  /**
   * Usage statistics for the Settings → Storage card.
   * @returns {Promise<{totalSizeMB: string, totalSizeBytes: number,
   *   maxSizeMB: number, entryCount: number}>}
   */
  async getStats() {
    await this.initialize();
    return {
      totalSizeMB: (this.index.totalSizeBytes / (1024 * 1024)).toFixed(2),
      totalSizeBytes: this.index.totalSizeBytes,
      maxSizeMB: this.index.maxSizeMB,
      entryCount: Object.keys(this.index.entries).length,
    };
  }

  /**
   * Change the budget, pruning least-recently-played songs if the cache now
   * exceeds it.
   * @param {number} sizeMB
   * @returns {Promise<void>}
   */
  async setMaxSize(sizeMB) {
    await this.initialize();
    this.index.maxSizeMB = sizeMB;
    await this.pruneToBudget();
    await this.saveIndex();
  }

  /**
   * Delete every cached song file, preserving the configured budget.
   * @returns {Promise<void>}
   */
  async clearAll() {
    await this.initialize();
    try {
      await FileSystem.deleteAsync(MUSIC_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(MUSIC_DIR, { intermediates: true }).catch(() => {});
      const maxSizeMB = this.index.maxSizeMB;
      this.index = { entries: {}, totalSizeBytes: 0, maxSizeMB };
      await this.saveIndex();
    } catch (error) {
      console.error('Error clearing song cache:', error);
    }
  }
}

const songCache = new SongCache();

export default songCache;

import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SubsonicAPI from './SubsonicAPI';
import { getAppSettings } from './AppSettings';

// Disk cache for full song files (the "music cache"). Files live in
// documentDirectory/music/, index in AsyncStorage. Cached songs are never
// evicted automatically — they persist until removed manually (removeSong,
// clearAll, or lowering the budget via setMaxSize). There is no background
// LRU sweep on download, since a song can't be "stale" the way list data can.
//
// Not yet wired to any menus/UI — exposed for later use:
//   cacheSong(track) / cacheSongs(tracks) / cacheAlbum(albumId) / cachePlaylist(playlistId)
//   getCachedUri(songId) — used by AudioPlayer to prefer local playback
//
// Quality is controlled by the `originalQualityCaching` app setting:
// original server file, or transcoded to MP3 320 kbps.

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

  fileUri(songId, format) {
    const safeId = String(songId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${MUSIC_DIR}${safeId}.${format === 'mp3' ? 'mp3' : 'audio'}`;
  }

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

  async saveIndex() {
    try {
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(this.index));
    } catch (error) {
      console.error('Error saving song cache index:', error);
    }
  }

  async isCached(songId) {
    await this.initialize();
    return !!this.index.entries[songId];
  }

  // Returns a playable local file URI, or null if not cached.
  // Touches the LRU timestamp on hit.
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

  // Download one track into the cache. Resolves to the local URI (or null on
  // failure). Deduplicates concurrent requests for the same song.
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

  // Sequential download of multiple tracks; returns count of newly cached songs.
  async cacheSongs(tracks) {
    let cached = 0;
    for (const track of tracks || []) {
      const uri = await this.cacheSong(track);
      if (uri) cached += 1;
    }
    return cached;
  }

  async cacheAlbum(albumId) {
    const album = await SubsonicAPI.getAlbum(albumId);
    return this.cacheSongs(album?.song || []);
  }

  async cachePlaylist(playlistId) {
    const playlist = await SubsonicAPI.getPlaylist(playlistId);
    return this.cacheSongs(playlist?.entry || []);
  }

  async removeSong(songId) {
    await this.initialize();
    const entry = this.index.entries[songId];
    if (!entry) return;
    await FileSystem.deleteAsync(this.fileUri(songId, entry.format), { idempotent: true }).catch(() => {});
    this.index.totalSizeBytes -= entry.size;
    delete this.index.entries[songId];
    await this.saveIndex();
  }

  // Evict least-recently-used songs until under budget. Not called
  // automatically on download — only when the user explicitly lowers the
  // budget (setMaxSize) or triggers a manual eviction from the UI.
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

  async getStats() {
    await this.initialize();
    return {
      totalSizeMB: (this.index.totalSizeBytes / (1024 * 1024)).toFixed(2),
      totalSizeBytes: this.index.totalSizeBytes,
      maxSizeMB: this.index.maxSizeMB,
      entryCount: Object.keys(this.index.entries).length,
    };
  }

  async setMaxSize(sizeMB) {
    await this.initialize();
    this.index.maxSizeMB = sizeMB;
    await this.pruneToBudget();
    await this.saveIndex();
  }

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

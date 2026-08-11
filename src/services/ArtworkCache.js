import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SubsonicAPI from './SubsonicAPI';
import CacheService from './CacheService';

// Disk cache for cover art files. Shares the metadata cache budget with
// CacheService: (artwork bytes + JSON metadata bytes) <= CacheService max size.
// Files live in cacheDirectory/artwork/, index in AsyncStorage.

const ART_DIR = `${FileSystem.cacheDirectory}artwork/`;
const INDEX_KEY = '@sona_artwork_index';

class ArtworkCache {
  constructor() {
    this.index = null; // { entries: { [key]: { size, timestamp } }, totalSizeBytes, missing: { [key]: timestamp } }
    this.memoryUris = new Map(); // key -> local file URI, for sync lookup
    this.pendingDownloads = new Map(); // key -> Promise
    this.initPromise = null;
  }

  cacheKey(coverArtId, size) {
    return `${String(coverArtId).replace(/[^a-zA-Z0-9_-]/g, '_')}_${size}`;
  }

  fileUri(key) {
    return `${ART_DIR}${key}.img`;
  }

  async initialize() {
    if (this.index) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        await FileSystem.makeDirectoryAsync(ART_DIR, { intermediates: true }).catch(() => {});
        const raw = await AsyncStorage.getItem(INDEX_KEY);
        this.index = raw ? JSON.parse(raw) : { entries: {}, totalSizeBytes: 0, missing: {} };
        if (!this.index.missing) this.index.missing = {};
        for (const key of Object.keys(this.index.entries)) {
          this.memoryUris.set(key, this.fileUri(key));
        }
      } catch (error) {
        console.error('Error initializing artwork cache:', error);
        this.index = { entries: {}, totalSizeBytes: 0, missing: {} };
      }
    })();
    return this.initPromise;
  }

  async saveIndex() {
    try {
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(this.index));
    } catch (error) {
      console.error('Error saving artwork index:', error);
    }
  }

  // Synchronous lookup for render paths. Returns a local file URI or null.
  getLocalUriSync(coverArtId, size) {
    if (!coverArtId) return null;
    return this.memoryUris.get(this.cacheKey(coverArtId, size)) || null;
  }

  // Returns the local URI if cached. Otherwise starts a background download
  // (deduplicated) and returns null — callers should render the remote URL.
  // Known-missing ids (a prior fetch 404'd — common for artists without a
  // photo) are not retried.
  getArtwork(coverArtId, size = 300) {
    if (!coverArtId) return null;
    const key = this.cacheKey(coverArtId, size);
    const local = this.memoryUris.get(key);
    if (local) return local;
    if (this.index?.missing?.[key]) return null;
    this.download(coverArtId, size).catch(() => {});
    return null;
  }

  // Same as getArtwork, but returns an Image-source object ({ uri }) for call
  // sites that don't render through <CachedImage> (ScreenBackground, MiniPlayer,
  // Image.getSize aspect-ratio probes, etc). Falls back to the remote URL (and
  // to `fallback`, e.g. a required local asset) when nothing is cached yet —
  // or straight to `fallback` when the id is known-missing, since retrying
  // the remote URL would just fail again too.
  getArtworkSource(coverArtId, size = 300, fallback = null) {
    if (!coverArtId) return fallback;
    const local = this.getArtwork(coverArtId, size);
    if (local) return { uri: local };
    const key = this.cacheKey(coverArtId, size);
    if (this.index?.missing?.[key]) return fallback;
    return { uri: SubsonicAPI.getCoverArtUrl(coverArtId, size) };
  }

  // Drops every cached size of a given artwork id and lets the next
  // getArtwork/getArtworkSource call redownload it fresh. Album and artist
  // art never change once fetched, so this is never called for them — it
  // exists for playlist art, which can change while the playlist's coverArt
  // id stays the same (e.g. a regenerated collage or a new custom image).
  async invalidate(coverArtId) {
    if (!coverArtId) return;
    await this.initialize();
    const prefix = `${String(coverArtId).replace(/[^a-zA-Z0-9_-]/g, '_')}_`;
    const entryKeys = Object.keys(this.index.entries).filter(k => k.startsWith(prefix));
    const missingKeys = Object.keys(this.index.missing).filter(k => k.startsWith(prefix));
    if (!entryKeys.length && !missingKeys.length) return;
    for (const key of entryKeys) {
      await FileSystem.deleteAsync(this.fileUri(key), { idempotent: true }).catch(() => {});
      this.index.totalSizeBytes -= this.index.entries[key].size;
      delete this.index.entries[key];
      this.memoryUris.delete(key);
    }
    for (const key of missingKeys) {
      delete this.index.missing[key];
    }
    await this.saveIndex();
  }

  async download(coverArtId, size) {
    await this.initialize();
    const key = this.cacheKey(coverArtId, size);
    if (this.memoryUris.has(key)) return this.memoryUris.get(key);
    if (this.index.missing[key]) return null;
    if (this.pendingDownloads.has(key)) return this.pendingDownloads.get(key);

    const promise = (async () => {
      try {
        const remoteUrl = SubsonicAPI.getCoverArtUrl(coverArtId, size);
        const target = this.fileUri(key);
        const result = await FileSystem.downloadAsync(remoteUrl, target);
        if (result.status !== 200) {
          await FileSystem.deleteAsync(target, { idempotent: true });
          // Remember the miss (e.g. an artist with no photo) so we don't
          // re-attempt the download on every render.
          this.index.missing[key] = Date.now();
          await this.saveIndex();
          return null;
        }
        const info = await FileSystem.getInfoAsync(target);
        const bytes = info.size || 0;

        this.index.entries[key] = { size: bytes, timestamp: Date.now() };
        this.index.totalSizeBytes += bytes;
        delete this.index.missing[key];
        this.memoryUris.set(key, target);
        await this.pruneToBudget();
        await this.saveIndex();
        return target;
      } catch (error) {
        return null;
      } finally {
        this.pendingDownloads.delete(key);
      }
    })();

    this.pendingDownloads.set(key, promise);
    return promise;
  }

  // Enforce the shared metadata budget: artwork bytes must fit within
  // CacheService's max size minus its JSON usage. Evicts oldest art first.
  async pruneToBudget() {
    const metaStats = await CacheService.getStats();
    const budgetBytes = Math.max(
      0,
      metaStats.maxSizeMB * 1024 * 1024 - metaStats.totalSizeBytes
    );
    if (this.index.totalSizeBytes <= budgetBytes) return;

    const entries = Object.entries(this.index.entries)
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (const [key, entry] of entries) {
      if (this.index.totalSizeBytes <= budgetBytes) break;
      await FileSystem.deleteAsync(this.fileUri(key), { idempotent: true }).catch(() => {});
      this.index.totalSizeBytes -= entry.size;
      delete this.index.entries[key];
      this.memoryUris.delete(key);
    }
    await this.saveIndex();
  }

  async getStats() {
    await this.initialize();
    return {
      totalSizeBytes: this.index.totalSizeBytes,
      entryCount: Object.keys(this.index.entries).length,
    };
  }

  async clearAll() {
    await this.initialize();
    try {
      await FileSystem.deleteAsync(ART_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(ART_DIR, { intermediates: true }).catch(() => {});
      this.index = { entries: {}, totalSizeBytes: 0, missing: {} };
      this.memoryUris.clear();
      await this.saveIndex();
    } catch (error) {
      console.error('Error clearing artwork cache:', error);
    }
  }
}

const artworkCache = new ArtworkCache();

export default artworkCache;
